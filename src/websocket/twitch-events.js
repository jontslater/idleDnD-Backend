/**
 * Twitch Event Handlers
 * Handles chat commands, channel point redeems, and extension purchases
 * Routes events to appropriate WebSocket rooms
 */

import { broadcastToRoom } from './server.js';
import fetch from 'node-fetch';
import { db } from '../index.js';

// tmi.js is CommonJS, so we need to use createRequire
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const tmi = require('tmi.js');

let twitchClient = null; // Legacy bot client (fallback)
const streamerClients = new Map(); // streamerUsername -> tmi.Client
const botJoinedChannels = new Set(); // Track channels TNEWBOT has joined
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

// Active chatter tracking: channelName -> Map<userId, lastChatTimestamp>
// Tracks users who chatted in the last hour for viewer bonuses
const activeChatters = new Map(); // channelName -> Map<userId, timestamp>
const channelToStreamerId = new Map(); // channelName -> streamerTwitchId (for broadcasting)
const CHATTER_TIMEOUT_MS = 60 * 60 * 1000; // 1 hour

/**
 * Track chat activity for a user in a channel
 * Updates active chatters and broadcasts updates
 */
async function trackChatActivity(channelName, userId, username, streamerTwitchId) {
  // Initialize channel tracking if needed
  if (!activeChatters.has(channelName)) {
    activeChatters.set(channelName, new Map());
  }
  
  const chatters = activeChatters.get(channelName);
  const now = Date.now();
  
  // Update or add user's last chat time
  chatters.set(userId, now);
  
  // Clean up old chatters (older than 1 hour)
  const oneHourAgo = now - CHATTER_TIMEOUT_MS;
  for (const [chatterUserId, lastChat] of chatters.entries()) {
    if (lastChat < oneHourAgo) {
      chatters.delete(chatterUserId);
    }
  }
  
  // Get current count
  const count = chatters.size;
  
  // Broadcast chatter count update
  if (streamerTwitchId) {
    broadcastToRoom(String(streamerTwitchId), {
      type: 'chatter_count_update',
      count: count,
      timestamp: now
    });
    console.log(`📡 [Chatter Tracking] ${channelName}: ${count} active chatters (updated from ${username})`);
  }
  
  // Also broadcast chat_activity event for rested XP bonuses
  // Look up heroId from userId (async, but don't block, with caching)
  if (streamerTwitchId) {
    // Use cache to reduce Firestore reads
    (async () => {
      try {
        const { getHeroByTwitchIdCache } = await import('../utils/heroCache.js');
        const twitchIdCache = getHeroByTwitchIdCache();
        
        // Check cache first
        let heroId = twitchIdCache.get(userId);
        
        if (!heroId) {
          // Cache miss - query Firestore
          const snapshot = await db.collection('heroes')
            .where('twitchUserId', '==', userId)
            .limit(1)
            .get();
          
          if (!snapshot.empty) {
            heroId = snapshot.docs[0].id;
            // Cache the mapping
            twitchIdCache.set(userId, heroId);
          }
        }
        
        broadcastToRoom(String(streamerTwitchId), {
          type: 'chat_activity',
          username: username,
          userId: userId,
          heroId: heroId, // Include heroId if found
          timestamp: now
        });
      } catch (error) {
        console.error('[WebSocket] Error looking up hero for chat activity:', error);
        // Still broadcast without heroId
        broadcastToRoom(String(streamerTwitchId), {
          type: 'chat_activity',
          username: username,
          userId: userId,
          heroId: null,
          timestamp: now
        });
      }
    })();
  }
  
  return count;
}

/**
 * Get active chatter count for a channel
 */
function getActiveChatterCount(channelName) {
  const chatters = activeChatters.get(channelName);
  if (!chatters) return 0;
  
  // Clean up old chatters before counting
  const now = Date.now();
  const oneHourAgo = now - CHATTER_TIMEOUT_MS;
  for (const [userId, lastChat] of chatters.entries()) {
    if (lastChat < oneHourAgo) {
      chatters.delete(userId);
    }
  }
  
  return chatters.size;
}

/**
 * Broadcast chatter counts for all active channels
 * Called periodically to ensure browser sources stay updated
 */
function broadcastAllChatterCounts() {
  activeChatters.forEach((chatters, channelName) => {
    // Clean up old chatters
    const now = Date.now();
    const oneHourAgo = now - CHATTER_TIMEOUT_MS;
    for (const [userId, lastChat] of chatters.entries()) {
      if (lastChat < oneHourAgo) {
        chatters.delete(userId);
      }
    }
    
    const count = chatters.size;
    
    // Get streamer Twitch ID for this channel
    const streamerTwitchId = channelToStreamerId.get(channelName);
    if (streamerTwitchId) {
      // Broadcast even if count is 0 to keep browser sources updated
      broadcastToRoom(String(streamerTwitchId), {
        type: 'chatter_count_update',
        count: count,
        timestamp: now
      });
    }
  });
}

// Start periodic broadcast of chatter counts (every 30 seconds)
let chatterBroadcastInterval = null;
function startChatterBroadcast() {
  if (chatterBroadcastInterval) return; // Already started
  
  chatterBroadcastInterval = setInterval(() => {
    broadcastAllChatterCounts();
  }, 30000); // Every 30 seconds
  
  console.log('📡 Started periodic chatter count broadcasts (every 30s)');
}

/**
 * Initialize Twitch event handlers
 * This will be called from the main server
 * 
 * NOTE: The bot account is now OPTIONAL. Streamers who log in via OAuth will
 * automatically have their chat monitored using their own tokens.
 * The bot account is only used as a fallback for streamers who haven't logged in yet.
 */
export function handleTwitchEvents() {
  console.log('📡 Initializing Twitch event handlers...');
  console.log('   Streamers will connect automatically when they log in via OAuth.');
  
  // Get TNEWBOT credentials from environment (OPTIONAL - only for fallback and periodic updates)
  const TNEWBOT_USERNAME = process.env.TNEWBOT_USERNAME || process.env.TWITCH_USERNAME || process.env.TWITCH_BOT_USERNAME;
  const TNEWBOT_OAUTH_TOKEN = process.env.TNEWBOT_OAUTH_TOKEN || process.env.TWITCH_OAUTH_TOKEN || process.env.TWITCH_ACCESS_TOKEN;
  const INITIAL_CHANNELS = process.env.TWITCH_CHANNELS ? process.env.TWITCH_CHANNELS.split(',').map(c => c.trim().toLowerCase()) : [];
  
  // Bot account is optional - only use if provided
  if (!TNEWBOT_USERNAME || !TNEWBOT_OAUTH_TOKEN) {
    console.log('   ℹ️  TNEWBOT account not configured (optional). Streamers will connect automatically when they log in.');
    return;
  }
  
  // Create Twitch client for TNEWBOT (can start with empty channels - will join dynamically)
  const client = new tmi.Client({
    options: { debug: process.env.NODE_ENV === 'development' },
    connection: {
      reconnect: true,
      secure: true
    },
    identity: {
      username: TNEWBOT_USERNAME,
      password: TNEWBOT_OAUTH_TOKEN
    },
    channels: INITIAL_CHANNELS.length > 0 ? INITIAL_CHANNELS : [] // Start with initial channels, but can join more dynamically
  });
  
  // Track initial channels
  INITIAL_CHANNELS.forEach(channel => botJoinedChannels.add(channel));
  
  // Connect to Twitch
  client.connect().catch(err => {
    console.error('❌ Failed to connect to Twitch:', err);
  });
  
  // Start periodic chatter count broadcasts
  startChatterBroadcast();
  
  // Listen for chat messages
  client.on('message', async (channel, tags, message, self) => {
    // Ignore messages from the bot itself
    if (self) return;
    
    const username = tags.username;
    const userId = tags['user-id'];
    const channelName = channel.replace('#', '').toLowerCase();
    const streamerTwitchId = tags['room-id'] || tags['user-id']; // Room ID is the streamer's Twitch ID
    
    // Track chat activity for viewer bonuses (track ALL messages, not just commands)
    if (streamerTwitchId) {
      // Map channel to streamer ID for periodic broadcasts
      channelToStreamerId.set(channelName, streamerTwitchId);
      trackChatActivity(channelName, userId, username, streamerTwitchId);
    }
    
    // Log all messages for debugging
    if (message.trim().startsWith('!')) {
      console.log(`📨 [${channelName}] Received command: ${message} from ${username}`);
    }
    
    // Skip if streamer has their own client connected (to avoid duplicate processing)
    if (streamerClients.has(channelName)) {
      console.log(`⏭️  Skipping bot account handler for ${channelName} - streamer client is active`);
      return;
    }
    
    // Parse command
    const commandMatch = message.trim().match(/^!(\w+)(?:\s+(.+))?$/);
    if (!commandMatch) {
      if (message.trim().startsWith('!')) {
        console.log(`⚠️  [${channelName}] Command pattern didn't match: ${message}`);
      }
      return;
    }
    
    const command = commandMatch[1].toLowerCase();
    const args = commandMatch[2] ? commandMatch[2].trim().split(/\s+/) : [];
    
    console.log(`💬 [${channelName}] ${username}: !${command} ${args.join(' ')}`);
    
    // Handle !join command
    if (command === 'join') {
      try {
        // Check if first argument is a number (hero index)
        const firstArg = args[0];
        const heroIndex = firstArg && !isNaN(parseInt(firstArg, 10)) ? parseInt(firstArg, 10) : null;
        const classKey = heroIndex === null ? firstArg : null; // Only use as class if not a number
        
        console.log(`📤 [Join] Sending request to ${API_BASE_URL}/api/chat/join`, {
          viewerUsername: username,
          viewerId: userId,
          streamerUsername: channelName,
          heroIndex,
          classKey
        });
        
        const response = await fetch(`${API_BASE_URL}/api/chat/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            viewerUsername: username,
            viewerId: userId,
            streamerUsername: channelName,
            streamerId: tags['room-id'], // Channel ID
            class: classKey, // Optional class name (only if not a number)
            heroIndex: heroIndex // Optional hero index (1-based)
          })
        });
        
        console.log(`📥 [Join] Response status: ${response.status}`);
        
        let result;
        try {
          result = await response.json();
        } catch (parseError) {
          console.error(`❌ Failed to parse response:`, parseError);
          const text = await response.text();
          console.error(`Response text:`, text);
          throw new Error(`Invalid response from server: ${text}`);
        }
        
        console.log(`📥 [Join] Response data:`, result);
        
        if (response.ok) {
          console.log(`✅ ${username} joined ${channelName}'s battlefield`);
          
          // Send response to chat
          if (result.message) {
            console.log(`💬 [Join] Sending message to chat: ${result.message}`);
            await client.say(channel, result.message).catch(err => {
              console.error(`❌ Failed to send chat message:`, err);
            });
          } else {
            console.warn(`⚠️ [Join] No message in response, sending default`);
            await client.say(channel, `@${username} Joined the battlefield!`).catch(err => {
              console.error(`❌ Failed to send default message:`, err);
            });
          }
          
          // Broadcast update to WebSocket clients
          // Use streamer's Twitch ID (from room-id tag) for broadcast
          // The streamer's browser source connects with their twitchId, not battlefieldId
          const streamerTwitchId = tags['room-id'] || tags['user-id'];
          if (streamerTwitchId) {
            console.log(`📡 Broadcasting hero_joined to streamer Twitch ID: ${streamerTwitchId}`);
            broadcastToRoom(streamerTwitchId, {
              type: 'hero_joined',
              hero: result.hero,
              message: result.message,
              timestamp: Date.now()
            });
          } else {
            console.warn(`⚠️ Could not determine streamer Twitch ID for broadcast. Channel: ${channelName}`);
            // Fallback: try using battlefieldId (won't work but logs the attempt)
            const battlefieldId = `twitch:${channelName}`;
            broadcastToRoom(battlefieldId, {
              type: 'hero_joined',
              hero: result.hero,
              message: result.message,
              timestamp: Date.now()
            });
          }
        } else {
          console.error(`❌ Failed to join: ${result.error || result.message || 'Unknown error'}`);
          // Send error message to chat
          const errorMsg = result.error || result.message || `@${username} Failed to join battlefield. Try again!`;
          console.log(`💬 [Join] Sending error to chat: ${errorMsg}`);
          await client.say(channel, errorMsg).catch(err => {
            console.error(`❌ Failed to send error message:`, err);
          });
        }
      } catch (error) {
        console.error('❌ Error processing !join command:', error);
        // Send error message to chat
        client.say(channel, `@${username} Error processing !join command. Please try again.`).catch(err => {
          console.error(`❌ Failed to send error message:`, err);
        });
      }
    } else {
      // Process other game commands via backend
      try {
        const { processCommand } = await import('../services/commandHandler.js');
        // Get streamer's numeric Twitch ID from room-id tag for queue system
        const streamerId = tags['room-id'];
        const result = await processCommand(command, args, username, userId, channelName, streamerId);
        
        if (result.success) {
          console.log(`✅ Command !${command} processed for ${username}: ${result.message}`);
          
          // Send response to chat
          if (result.message) {
            client.say(channel, result.message).catch(err => {
              console.error(`❌ Failed to send chat message:`, err);
            });
          }
          
          // Broadcast command result to WebSocket clients
          const battlefieldId = `twitch:${channelName}`;
          broadcastToRoom(battlefieldId, {
            type: 'chat_command',
            command: `!${command}`,
            args: args,
            user: username,
            userId: userId,
            result: result,
            timestamp: Date.now()
          });
        } else {
          console.log(`⚠️ Command !${command} failed for ${username}: ${result.message}`);
          // Send error message to chat
          if (result.message) {
            client.say(channel, result.message).catch(err => {
              console.error(`❌ Failed to send error message:`, err);
            });
          }
        }
      } catch (error) {
        console.error(`❌ Error processing command !${command} for ${username}:`, error);
        // Send error message to chat
        client.say(channel, `@${username} Error processing !${command} command. Please try again.`).catch(err => {
          console.error(`❌ Failed to send error message:`, err);
        });
      }
    }
  });
  
  // Handle connection events
  client.on('connected', (addr, port) => {
    console.log(`✅ Bot account connected to Twitch IRC at ${addr}:${port}`);
    if (INITIAL_CHANNELS.length > 0) {
      console.log(`📺 Initially listening to channels: ${INITIAL_CHANNELS.join(', ')}`);
    } else {
      console.log(`📺 Bot ready - will join channels dynamically as streamers enable chat updates`);
    }
    console.log('   (Note: Streamers who log in will use their own tokens automatically)');
  });
  
  client.on('disconnected', (reason) => {
    console.warn(`⚠️ Disconnected from Twitch: ${reason}`);
  });
  
  client.on('reconnect', () => {
    console.log('🔄 Reconnecting to Twitch...');
  });
  
  twitchClient = client;
  
  return client;
}

/**
 * Handle chat command from Twitch chat
 * This will be called by the Twitch chat integration (tmi.js or EventSub)
 */
export function handleChatCommand(twitchId, command, user) {
  broadcastToRoom(twitchId, {
    type: 'chat_command',
    command,
    user,
    timestamp: Date.now()
  });
}

/**
 * Handle channel point redeem
 * This will be called by Twitch EventSub or similar
 */
export function handleChannelRedeem(twitchId, reward, user) {
  broadcastToRoom(twitchId, {
    type: 'channel_redeem',
    reward,
    user,
    timestamp: Date.now()
  });
}

/**
 * Handle extension purchase (broadcast update)
 * This complements the HTTP API endpoint
 */
export function handleExtensionPurchase(twitchId, userId, item) {
  broadcastToRoom(twitchId, {
    type: 'extension_purchase',
    userId,
    item,
    timestamp: Date.now()
  });
}

/**
 * Initialize chat listener for a specific streamer using their own Twitch token
 * This is called when a streamer logs in via OAuth
 */
export async function initializeStreamerChatListener(streamerUsername, accessToken, refreshToken) {
  const normalizedUsername = streamerUsername.toLowerCase().trim();
  
  // Check if already connected
  if (streamerClients.has(normalizedUsername)) {
    console.log(`📺 Chat listener already active for ${normalizedUsername}`);
    return streamerClients.get(normalizedUsername);
  }
  
  // Convert OAuth token to IRC format (add 'oauth:' prefix if not present)
  const ircToken = accessToken.startsWith('oauth:') ? accessToken : `oauth:${accessToken}`;
  
  console.log(`🔌 Initializing chat listener for streamer: ${normalizedUsername}`);
  
  // Track if authentication failed to prevent reconnect loop
  let authFailed = false;
  
  // Create Twitch client for this streamer
  const client = new tmi.Client({
    options: { debug: process.env.NODE_ENV === 'development' },
    connection: {
      reconnect: true,
      secure: true
    },
    identity: {
      username: normalizedUsername,
      password: ircToken
    },
    channels: [normalizedUsername] // Only listen to their own channel
  });
  
  // Set up event handlers BEFORE connecting to catch all events
  
  // Handle successful logon
  client.on('logon', () => {
    // Reset auth failed flag on successful logon
    authFailed = false;
  });
  
  // Prevent reconnection attempts if authentication failed
  client.on('reconnect', () => {
    if (authFailed) {
      console.warn(`⚠️ Preventing reconnect for ${normalizedUsername} - authentication failed`);
      client.opts.connection.reconnect = false;
      // Safely disconnect - catch errors if already disconnected
      client.disconnect().catch(err => {
        // Ignore disconnect errors - client might already be disconnected or closing
        const errMsg = err?.message || '';
        if (!errMsg.includes('Socket is not opened') && !errMsg.includes('connection is already closing')) {
          console.warn(`⚠️ Error disconnecting client for ${normalizedUsername}:`, errMsg);
        }
      });
      streamerClients.delete(normalizedUsername);
      return;
    }
    console.log(`🔄 Reconnecting streamer ${normalizedUsername} to Twitch...`);
  });
  
  // Handle disconnections
  client.on('disconnected', (reason) => {
    console.warn(`⚠️ Streamer ${normalizedUsername} disconnected from Twitch: ${reason}`);
    
    // If disconnected due to authentication failure, don't try to reconnect
    if (reason && (reason.includes('Login authentication failed') || reason.includes('authentication'))) {
      console.warn(`⚠️ Authentication failure detected - disabling reconnection for ${normalizedUsername}`);
      authFailed = true;
      client.opts.connection.reconnect = false;
    }
    
    streamerClients.delete(normalizedUsername);
  });
  
  // Connect to Twitch
  client.connect().then(() => {
    console.log(`✅ Successfully connected to Twitch IRC for ${normalizedUsername}`);
    console.log(`   Listening to channel: #${normalizedUsername}`);
    console.log(`   Chat commands will be processed automatically`);
  }).catch(err => {
    authFailed = true;
    console.error(`❌ Failed to connect to Twitch for ${normalizedUsername}:`, err);
    console.error(`   Error details:`, err.message || err);
    console.error(`   This usually means the OAuth token doesn't have IRC chat scopes.`);
    console.error(`   The token needs 'chat:read' scope to listen to chat.`);
    console.error(`   Current OAuth scopes requested: user:read:email, chat:read`);
    console.error(`   Solution: Make sure the OAuth flow includes 'chat:read' scope.`);
    
    // Disable reconnection to prevent infinite retry loop
    client.opts.connection.reconnect = false;
    // Safely disconnect - catch errors if already disconnected or closing
    client.disconnect().catch(disconnectErr => {
      // Ignore disconnect errors - client might already be disconnected or closing
      // Only log if it's not the expected "Socket is not opened" error
      if (!disconnectErr.message || !disconnectErr.message.includes('Socket is not opened') && !disconnectErr.message.includes('connection is already closing')) {
        console.warn(`⚠️ Error disconnecting client for ${normalizedUsername}:`, disconnectErr.message);
      }
    });
    streamerClients.delete(normalizedUsername);
    // Don't throw - just log the error so it doesn't crash the server
  });
  
  // Listen for chat messages
  client.on('message', async (channel, tags, message, self) => {
    // Ignore messages from the streamer themselves
    if (self) return;
    
    const username = tags.username;
    const userId = tags['user-id'];
    const channelName = channel.replace('#', '').toLowerCase();
    const streamerTwitchId = tags['room-id'] || tags['user-id']; // Room ID is the streamer's Twitch ID
    
    // Track chat activity for viewer bonuses (track ALL messages, not just commands)
    if (streamerTwitchId) {
      // Map channel to streamer ID for periodic broadcasts
      channelToStreamerId.set(channelName, streamerTwitchId);
      trackChatActivity(channelName, userId, username, streamerTwitchId);
    }
    
    // Log all messages for debugging
    if (message.trim().startsWith('!')) {
      console.log(`📨 [${channelName}] Received command: ${message} from ${username}`);
    }
    
    // Parse command
    const commandMatch = message.trim().match(/^!(\w+)(?:\s+(.+))?$/);
    if (!commandMatch) {
      if (message.trim().startsWith('!')) {
        console.log(`⚠️  [${channelName}] Command pattern didn't match: ${message}`);
      }
      return;
    }
    
    const command = commandMatch[1].toLowerCase();
    const args = commandMatch[2] ? commandMatch[2].trim().split(/\s+/) : [];
    
    console.log(`💬 [${channelName}] ${username}: !${command} ${args.join(' ')}`);
    
    // Handle !join command
    if (command === 'join') {
      try {
        // Check if first argument is a number (hero index)
        const firstArg = args[0];
        const heroIndex = firstArg && !isNaN(parseInt(firstArg, 10)) ? parseInt(firstArg, 10) : null;
        const classKey = heroIndex === null ? firstArg : null; // Only use as class if not a number
        
        console.log(`📤 [Join] Sending request to ${API_BASE_URL}/api/chat/join`, {
          viewerUsername: username,
          viewerId: userId,
          streamerUsername: channelName,
          heroIndex,
          classKey
        });
        
        const response = await fetch(`${API_BASE_URL}/api/chat/join`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            viewerUsername: username,
            viewerId: userId,
            streamerUsername: channelName,
            streamerId: tags['room-id'],
            class: classKey, // Optional class name (only if not a number)
            heroIndex: heroIndex // Optional hero index (1-based)
          })
        });
        
        console.log(`📥 [Join] Response status: ${response.status}`);
        
        let result;
        try {
          result = await response.json();
        } catch (parseError) {
          console.error(`❌ Failed to parse response:`, parseError);
          const text = await response.text();
          console.error(`Response text:`, text);
          throw new Error(`Invalid response from server: ${text}`);
        }
        
        console.log(`📥 [Join] Response data:`, result);
        
        if (response.ok) {
          console.log(`✅ ${username} joined ${channelName}'s battlefield`);
          
          // Send response to chat
          if (result.message) {
            console.log(`💬 [Join] Sending message to chat: ${result.message}`);
            await client.say(channel, result.message).catch(err => {
              console.error(`❌ Failed to send chat message:`, err);
            });
          } else {
            console.warn(`⚠️ [Join] No message in response, sending default`);
            await client.say(channel, `@${username} Joined the battlefield!`).catch(err => {
              console.error(`❌ Failed to send default message:`, err);
            });
          }
          
          // Broadcast update to WebSocket clients
          // Use streamer's Twitch ID (from room-id tag) for broadcast
          // The streamer's browser source connects with their twitchId, not battlefieldId
          const streamerTwitchId = tags['room-id'] || tags['user-id'];
          if (streamerTwitchId) {
            console.log(`📡 Broadcasting hero_joined to streamer Twitch ID: ${streamerTwitchId}`);
            broadcastToRoom(streamerTwitchId, {
              type: 'hero_joined',
              hero: result.hero,
              message: result.message,
              timestamp: Date.now()
            });
          } else {
            console.warn(`⚠️ Could not determine streamer Twitch ID for broadcast. Channel: ${channelName}`);
            // Fallback: try using battlefieldId (won't work but logs the attempt)
            const battlefieldId = `twitch:${channelName}`;
            broadcastToRoom(battlefieldId, {
              type: 'hero_joined',
              hero: result.hero,
              message: result.message,
              timestamp: Date.now()
            });
          }
        } else {
          console.error(`❌ Failed to join: ${result.error || result.message || 'Unknown error'}`);
          // Send error message to chat
          const errorMsg = result.error || result.message || `@${username} Failed to join battlefield. Try again!`;
          console.log(`💬 [Join] Sending error to chat: ${errorMsg}`);
          await client.say(channel, errorMsg).catch(err => {
            console.error(`❌ Failed to send error message:`, err);
          });
        }
      } catch (error) {
        console.error('❌ Error processing !join command:', error);
        // Send error message to chat
        client.say(channel, `@${username} Error processing !join command. Please try again.`).catch(err => {
          console.error(`❌ Failed to send error message:`, err);
        });
      }
    } else {
      // Process other game commands via backend
      try {
        const { processCommand } = await import('../services/commandHandler.js');
        // Get streamer's numeric Twitch ID from room-id tag for queue system
        const streamerId = tags['room-id'];
        const result = await processCommand(command, args, username, userId, channelName, streamerId);
        
        if (result.success) {
          console.log(`✅ Command !${command} processed for ${username}: ${result.message}`);
          
          // Send response to chat
          if (result.message) {
            client.say(channel, result.message).catch(err => {
              console.error(`❌ Failed to send chat message:`, err);
            });
          }
          
          // Broadcast command result to WebSocket clients
          const battlefieldId = `twitch:${channelName}`;
          broadcastToRoom(battlefieldId, {
            type: 'chat_command',
            command: `!${command}`,
            args: args,
            user: username,
            userId: userId,
            result: result,
            timestamp: Date.now()
          });
        } else {
          console.log(`⚠️ Command !${command} failed for ${username}: ${result.message}`);
          // Send error message to chat
          if (result.message) {
            client.say(channel, result.message).catch(err => {
              console.error(`❌ Failed to send error message:`, err);
            });
          }
        }
      } catch (error) {
        console.error(`❌ Error processing command !${command} for ${username}:`, error);
        // Don't send duplicate error message - command handler already returns error messages
        // Only send if it's a truly unexpected error that wasn't caught by the handler
      }
    }
  });
  
  // Handle connection events
  client.on('connected', (addr, port) => {
    console.log(`✅ Streamer ${normalizedUsername} connected to Twitch IRC at ${addr}:${port}`);
    console.log(`   Ready to process chat commands in #${normalizedUsername}`);
  });
  
  // Note: disconnected handler is already set up above (before connect())
  
  // Store client
  streamerClients.set(normalizedUsername, client);
  
  return client;
}

/**
 * Check if a streamer's chat listener is connected
 * @param {string} streamerUsername - The streamer's Twitch username
 * @returns {boolean} True if connected, false otherwise
 */
export function isStreamerChatListenerConnected(streamerUsername) {
  const normalizedUsername = streamerUsername.toLowerCase().trim();
  const client = streamerClients.get(normalizedUsername);
  return client && client.readyState() === 'OPEN';
}

/**
 * Get the streamer client if connected
 * @param {string} streamerUsername - The streamer's Twitch username
 * @returns {tmi.Client|null} The client if connected, null otherwise
 */
export function getStreamerClient(streamerUsername) {
  const normalizedUsername = streamerUsername.toLowerCase().trim();
  const client = streamerClients.get(normalizedUsername);
  if (client && client.readyState() === 'OPEN') {
    return client;
  }
  return null;
}

/**
 * Join a channel with TNEWBOT (if not already joined)
 * @param {string} channel - Channel name (with or without #)
 * @returns {Promise<boolean>} True if joined successfully, false otherwise
 */
export async function joinChannelAsBot(channel) {
  // Normalize channel name (remove # if present, lowercase)
  const channelName = channel.startsWith('#') ? channel.slice(1).toLowerCase() : channel.toLowerCase();
  const normalizedChannel = `#${channelName}`;
  
  // Check if already joined
  if (botJoinedChannels.has(channelName)) {
    console.log(`[TNEWBOT] ℹ️ Already in channel ${normalizedChannel}`);
    return true;
  }
  
  // Check if bot client is available and connected
  if (!twitchClient || twitchClient.readyState() !== 'OPEN') {
    console.warn(`[TNEWBOT] ⚠️ Bot client not connected, cannot join ${normalizedChannel}`);
    return false;
  }
  
  try {
    await twitchClient.join(normalizedChannel);
    botJoinedChannels.add(channelName);
    console.log(`[TNEWBOT] ✅ Joined channel ${normalizedChannel}`);
    return true;
  } catch (error) {
    console.error(`[TNEWBOT] ❌ Failed to join channel ${normalizedChannel}:`, error);
    return false;
  }
}

/**
 * Leave a channel with TNEWBOT
 * @param {string} channel - Channel name (with or without #)
 * @returns {Promise<boolean>} True if left successfully, false otherwise
 */
export async function leaveChannelAsBot(channel) {
  // Normalize channel name (remove # if present, lowercase)
  const channelName = channel.startsWith('#') ? channel.slice(1).toLowerCase() : channel.toLowerCase();
  const normalizedChannel = `#${channelName}`;
  
  // Check if not joined
  if (!botJoinedChannels.has(channelName)) {
    console.log(`[TNEWBOT] ℹ️ Not in channel ${normalizedChannel}`);
    return true;
  }
  
  // Check if bot client is available and connected
  if (!twitchClient || twitchClient.readyState() !== 'OPEN') {
    console.warn(`[TNEWBOT] ⚠️ Bot client not connected, cannot leave ${normalizedChannel}`);
    botJoinedChannels.delete(channelName); // Remove from tracking anyway
    return false;
  }
  
  try {
    await twitchClient.part(normalizedChannel);
    botJoinedChannels.delete(channelName);
    console.log(`[TNEWBOT] ✅ Left channel ${normalizedChannel}`);
    return true;
  } catch (error) {
    console.error(`[TNEWBOT] ❌ Failed to leave channel ${normalizedChannel}:`, error);
    botJoinedChannels.delete(channelName); // Remove from tracking even if part failed
    return false;
  }
}

/**
 * Send a chat message as TNEWBOT to a specific channel
 * This is used for periodic updates and other bot messages
 * Automatically joins the channel if not already joined
 * @param {string} channel - Channel name (with or without #)
 * @param {string} message - Message to send
 * @returns {Promise<void>}
 */
export async function sendChatMessageAsBot(channel, message) {
  // Normalize channel name (add # if missing, lowercase)
  const normalizedChannel = channel.startsWith('#') ? channel.toLowerCase() : `#${channel.toLowerCase()}`;
  const channelName = normalizedChannel.replace('#', '');
  
  // Ensure bot is in the channel before sending
  const joined = await joinChannelAsBot(channelName);
  if (!joined) {
    console.warn(`[TNEWBOT] ⚠️ Could not join ${normalizedChannel}, attempting to send anyway...`);
  }
  
  // Try to use TNEWBOT client (fallback bot)
  if (twitchClient && twitchClient.readyState() === 'OPEN') {
    try {
      await twitchClient.say(normalizedChannel, message);
      console.log(`[TNEWBOT] ✅ Sent message to ${normalizedChannel}: ${message}`);
      return;
    } catch (error) {
      console.error(`[TNEWBOT] ❌ Failed to send message via bot client:`, error);
      // If error is about not being in channel, try joining again
      if (error.message && error.message.includes('not in channel')) {
        console.log(`[TNEWBOT] 🔄 Retrying join and send for ${normalizedChannel}...`);
        const retryJoin = await joinChannelAsBot(channelName);
        if (retryJoin) {
          try {
            await twitchClient.say(normalizedChannel, message);
            console.log(`[TNEWBOT] ✅ Sent message to ${normalizedChannel} after retry: ${message}`);
            return;
          } catch (retryError) {
            console.error(`[TNEWBOT] ❌ Failed to send message after retry:`, retryError);
          }
        }
      }
    }
  }
  
  // If TNEWBOT client not available, try to use streamer's client as fallback
  // (This shouldn't happen in normal operation, but provides a fallback)
  const streamerClient = streamerClients.get(channelName);
  if (streamerClient && streamerClient.readyState() === 'OPEN') {
    try {
      await streamerClient.say(normalizedChannel, message);
      console.log(`[TNEWBOT] ✅ Sent message via streamer client to ${normalizedChannel}: ${message}`);
      return;
    } catch (error) {
      console.error(`[TNEWBOT] ❌ Failed to send message via streamer client:`, error);
    }
  }
  
  console.error(`[TNEWBOT] ❌ No available client to send message to ${normalizedChannel}`);
  throw new Error(`No available Twitch client to send message to ${normalizedChannel}`);
}
