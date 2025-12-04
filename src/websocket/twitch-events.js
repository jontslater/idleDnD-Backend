/**
 * Twitch Event Handlers
 * Handles chat commands, channel point redeems, and extension purchases
 * Routes events to appropriate WebSocket rooms
 */

import { broadcastToRoom } from './server.js';
import fetch from 'node-fetch';

// tmi.js is CommonJS, so we need to use createRequire
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const tmi = require('tmi.js');

let twitchClient = null; // Legacy bot client (fallback)
const streamerClients = new Map(); // streamerUsername -> tmi.Client
const API_BASE_URL = process.env.API_BASE_URL || 'http://localhost:3001';

// Track active chatters per channel (rolling 1-hour window)
// Map<streamerTwitchId, Map<userId, lastChatTime>>
const activeChattersByChannel = new Map();

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
  
  // Get Twitch credentials from environment (OPTIONAL - only for fallback)
  const TWITCH_USERNAME = process.env.TWITCH_USERNAME || process.env.TWITCH_BOT_USERNAME;
  const TWITCH_OAUTH_TOKEN = process.env.TWITCH_OAUTH_TOKEN || process.env.TWITCH_ACCESS_TOKEN;
  const CHANNELS = process.env.TWITCH_CHANNELS ? process.env.TWITCH_CHANNELS.split(',').map(c => c.trim().toLowerCase()) : [];
  
  // Bot account is optional - only use if provided
  if (!TWITCH_USERNAME || !TWITCH_OAUTH_TOKEN) {
    console.log('   ℹ️  Bot account not configured (optional). Streamers will connect automatically when they log in.');
    return;
  }
  
  if (CHANNELS.length === 0) {
    console.log('   ℹ️  No channels configured for bot account. Streamers will connect automatically when they log in.');
    return;
  }
  
  // Create Twitch client
  const client = new tmi.Client({
    options: { debug: process.env.NODE_ENV === 'development' },
    connection: {
      reconnect: true,
      secure: true
    },
    identity: {
      username: TWITCH_USERNAME,
      password: TWITCH_OAUTH_TOKEN
    },
    channels: CHANNELS
  });
  
  // Connect to Twitch
  client.connect().catch(err => {
    console.error('❌ Failed to connect to Twitch:', err);
  });
  
  // Listen for chat messages
  client.on('message', async (channel, tags, message, self) => {
    // Ignore messages from the bot itself
    if (self) return;
    
    const username = tags.username;
    const userId = tags['user-id'];
    const channelName = channel.replace('#', '').toLowerCase();
    const streamerTwitchId = tags['room-id']; // Numeric Twitch ID of the streamer
    
    console.log(`[Chatter Debug] 📝 Message from ${username} in ${channelName}, room-id: ${streamerTwitchId}`);
    
    // Track this user as active chatter (for viewer bonuses)
    // Use streamerTwitchId as key so broadcasts go to correct WebSocket room
    if (streamerTwitchId) {
      console.log(`[Chatter Tracking] ✅ Tracking ${username} (${userId}) in streamer ${streamerTwitchId}`);
      if (!activeChattersByChannel.has(streamerTwitchId)) {
        activeChattersByChannel.set(streamerTwitchId, new Map());
      }
      const chatters = activeChattersByChannel.get(streamerTwitchId);
      chatters.set(userId, Date.now());
      
      // Find hero ID for this user and broadcast chat activity (for rested XP)
      try {
        const { db } = await import('../index.js');
        const heroSnapshot = await db.collection('heroes')
          .where('twitchUserId', '==', userId)
          .where('currentBattlefieldId', '==', `twitch:${streamerTwitchId}`)
          .limit(1)
          .get();
        
        if (!heroSnapshot.empty) {
          const heroDoc = heroSnapshot.docs[0];
          broadcastToRoom(streamerTwitchId, {
            type: 'chat_activity',
            username,
            userId,
            heroId: heroDoc.id,
            timestamp: Date.now()
          });
        }
      } catch (err) {
        console.error('[Chatter Tracking] Error finding hero for chat activity:', err);
      }
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
    console.log(`📺 Listening to channels: ${CHANNELS.join(', ')}`);
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
    const streamerTwitchId = tags['room-id']; // Numeric Twitch ID of the streamer
    
    console.log(`[Chatter Debug] 📝 Message from ${username} in ${channelName}, room-id: ${streamerTwitchId}`);
    
    // Track this user as active chatter (for viewer bonuses)
    // Use streamerTwitchId as key so broadcasts go to correct WebSocket room
    if (streamerTwitchId) {
      console.log(`[Chatter Tracking] ✅ Tracking ${username} (${userId}) in streamer ${streamerTwitchId}`);
      if (!activeChattersByChannel.has(streamerTwitchId)) {
        activeChattersByChannel.set(streamerTwitchId, new Map());
      }
      const chatters = activeChattersByChannel.get(streamerTwitchId);
      chatters.set(userId, Date.now());
      
      // Find hero ID for this user and broadcast chat activity (for rested XP)
      try {
        const { db } = await import('../index.js');
        const heroSnapshot = await db.collection('heroes')
          .where('twitchUserId', '==', userId)
          .where('currentBattlefieldId', '==', `twitch:${streamerTwitchId}`)
          .limit(1)
          .get();
        
        if (!heroSnapshot.empty) {
          const heroDoc = heroSnapshot.docs[0];
          broadcastToRoom(streamerTwitchId, {
            type: 'chat_activity',
            username,
            userId,
            heroId: heroDoc.id,
            timestamp: Date.now()
          });
        }
      } catch (err) {
        console.error('[Chatter Tracking] Error finding hero for chat activity:', err);
      }
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

// ====== ACTIVE CHATTER TRACKING & BROADCASTING ======

// Clean up inactive chatters (every minute)
setInterval(() => {
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  
  activeChattersByChannel.forEach((chatters, streamerTwitchId) => {
    let removedCount = 0;
    chatters.forEach((lastChatTime, userId) => {
      if (lastChatTime < oneHourAgo) {
        chatters.delete(userId);
        removedCount++;
      }
    });
    
    if (removedCount > 0) {
      console.log(`[Chatter Cleanup] 🧹 Removed ${removedCount} inactive chatters from streamer ${streamerTwitchId} (${chatters.size} remain)`);
    }
  });
}, 60 * 1000); // Every minute

// Broadcast chatter count (every 30 seconds)
const broadcastInterval = setInterval(() => {
  console.log(`[Chatter Broadcast] 🔄 Running broadcast cycle... (${activeChattersByChannel.size} channels tracked)`);
  
  activeChattersByChannel.forEach((chatters, streamerTwitchId) => {
    const count = chatters.size;
    
    console.log(`[Chatter Broadcast] 👥 Streamer ${streamerTwitchId}: ${count} active chatters`);
    
    // Broadcast to browser sources for this streamer
    // Use numeric Twitch ID as room identifier (matches WebSocket connection)
    broadcastToRoom(streamerTwitchId, {
      type: 'chatter_count_update',
      count: count,
      timestamp: Date.now()
    });
  });
}, 30 * 1000); // Every 30 seconds

console.log('[Chatter Tracking] ✅ Initialized active chatter tracking and broadcasting');
console.log('[Chatter Tracking] 📡 Broadcast interval running every 30 seconds');
