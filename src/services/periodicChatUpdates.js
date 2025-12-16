/**
 * Periodic Chat Updates Service
 * Sends periodic stats updates to Twitch chat when streamers are live
 */

import { db } from '../index.js';
import { sendChatMessageAsBot } from '../websocket/twitch-events.js';
import { getStats, resetStats } from './streamStatsService.js';
import fetch from 'node-fetch';

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

let updateInterval = null;
let twitchAccessToken = null;

/**
 * Get Twitch API access token
 */
async function getTwitchAccessToken() {
  if (twitchAccessToken) {
    // Check if token is still valid (simple check - in production, verify expiry)
    return twitchAccessToken;
  }

  if (!TWITCH_CLIENT_ID || !TWITCH_CLIENT_SECRET) {
    console.warn('[Periodic Updates] ⚠️ Twitch API credentials not configured');
    return null;
  }

  try {
    const response = await fetch('https://id.twitch.tv/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: TWITCH_CLIENT_ID,
        client_secret: TWITCH_CLIENT_SECRET,
        grant_type: 'client_credentials'
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to get Twitch token: ${response.status}`);
    }

    const data = await response.json();
    twitchAccessToken = data.access_token;
    console.log('[Periodic Updates] ✅ Obtained Twitch API access token');
    return twitchAccessToken;
  } catch (error) {
    console.error('[Periodic Updates] ❌ Error getting Twitch access token:', error);
    return null;
  }
}

/**
 * Check if a streamer is currently live
 * @param {string} twitchId - Streamer's Twitch user ID
 * @returns {Promise<boolean>}
 */
async function checkStreamStatus(twitchId) {
  try {
    const token = await getTwitchAccessToken();
    if (!token) {
      console.warn('[Periodic Updates] ⚠️ No Twitch token available, assuming offline');
      return false;
    }

    const response = await fetch(`https://api.twitch.tv/helix/streams?user_id=${twitchId}`, {
      headers: {
        'Client-ID': TWITCH_CLIENT_ID,
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      console.error(`[Periodic Updates] ❌ Failed to check stream status: ${response.status}`);
      return false;
    }

    const data = await response.json();
    const isLive = data.data && data.data.length > 0;
    return isLive;
  } catch (error) {
    console.error(`[Periodic Updates] ❌ Error checking stream status for ${twitchId}:`, error);
    return false;
  }
}

/**
 * Get streamer's chat update settings
 * @param {string} twitchId - Streamer's Twitch ID
 * @returns {Promise<Object|null>}
 */
async function getStreamerSettings(twitchId) {
  try {
    // Try to find in streamerSettings collection first
    const settingsDoc = await db.collection('streamerSettings').doc(twitchId).get();
    if (settingsDoc.exists) {
      return settingsDoc.data().chatUpdates || null;
    }

    // Fallback: try to find in user document
    const userDoc = await db.collection('users').doc(twitchId).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      return userData.chatUpdates || null;
    }

    return null;
  } catch (error) {
    console.error(`[Periodic Updates] ❌ Error getting settings for ${twitchId}:`, error);
    return null;
  }
}

/**
 * Format update message based on stats and settings
 * @param {Object} stats - Stats object
 * @param {Object} settings - Chat update settings
 * @returns {string}
 */
function formatUpdateMessage(stats, settings) {
  const parts = [];
  
  // Calculate time period
  const periodStart = stats.periodStart?.toMillis?.() || new Date(stats.periodStart).getTime();
  const minutes = Math.floor((Date.now() - periodStart) / 60000);
  const timeStr = minutes === 1 ? '1 minute' : `${minutes} minutes`;

  // Build message parts based on enabled stats
  if (settings.showWaves && stats.wavesCompleted > 0) {
    parts.push(`${stats.wavesCompleted} wave${stats.wavesCompleted !== 1 ? 's' : ''} completed`);
  }
  
  if (settings.showXp && stats.totalXpGained > 0) {
    const xpStr = stats.totalXpGained.toLocaleString();
    parts.push(`${xpStr} XP gained`);
  }
  
  if (settings.showLevelUps && stats.heroesLeveledUp > 0) {
    parts.push(`${stats.heroesLeveledUp} hero${stats.heroesLeveledUp !== 1 ? 'es' : ''} leveled up`);
  }
  
  if (settings.showGold && stats.goldGained > 0) {
    const goldStr = stats.goldGained.toLocaleString();
    parts.push(`${goldStr} gold gained`);
  }

  // Use custom message template if provided
  if (settings.customMessage) {
    let message = settings.customMessage;
    message = message.replace(/{time}/g, timeStr);
    message = message.replace(/{waves}/g, stats.wavesCompleted || 0);
    message = message.replace(/{xp}/g, (stats.totalXpGained || 0).toLocaleString());
    message = message.replace(/{levelups}/g, stats.heroesLeveledUp || 0);
    message = message.replace(/{gold}/g, (stats.goldGained || 0).toLocaleString());
    return message;
  }

  // Default format
  if (parts.length === 0) {
    return null; // No stats to show
  }

  return `📊 Last ${timeStr}: ${parts.join(', ')}!`;
}

/**
 * Get streamer's Twitch username from their Twitch ID
 * @param {string} twitchId - Streamer's Twitch user ID
 * @returns {Promise<string|null>}
 */
async function getStreamerUsername(twitchId) {
  try {
    // Try to find hero with this twitchId to get username
    const heroesSnapshot = await db.collection('heroes')
      .where('twitchUserId', '==', twitchId)
      .limit(1)
      .get();

    if (!heroesSnapshot.empty) {
      const hero = heroesSnapshot.docs[0].data();
      return hero.twitchUsername || hero.name || null;
    }

    // Fallback: try user document
    const userDoc = await db.collection('users').doc(twitchId).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      return userData.twitchUsername || userData.username || null;
    }

    return null;
  } catch (error) {
    console.error(`[Periodic Updates] ❌ Error getting username for ${twitchId}:`, error);
    return null;
  }
}

/**
 * Send chat update for a single streamer
 * @param {string} twitchId - Streamer's Twitch ID
 */
async function sendChatUpdateForStreamer(twitchId) {
  try {
    // Check if streamer is live
    const isLive = await checkStreamStatus(twitchId);
    if (!isLive) {
      console.log(`[Periodic Updates] ⏭️ Streamer ${twitchId} is offline, skipping`);
      return;
    }

    // Get streamer's settings
    const settings = await getStreamerSettings(twitchId);
    if (!settings || !settings.enabled) {
      return; // Chat updates disabled for this streamer
    }

    // Get current stats
    const stats = await getStats(twitchId);
    if (!stats) {
      return; // No stats to report
    }

    // Format message
    const message = formatUpdateMessage(stats, settings);
    if (!message) {
      return; // No message to send
    }

    // Get streamer's username for channel name
    const username = await getStreamerUsername(twitchId);
    if (!username) {
      console.warn(`[Periodic Updates] ⚠️ Could not find username for Twitch ID ${twitchId}`);
      return;
    }

    // Send message via TNEWBOT
    await sendChatMessageAsBot(username, message);
    console.log(`[Periodic Updates] ✅ Sent update to ${username}: ${message}`);

    // Reset stats for next period
    await resetStats(twitchId);
  } catch (error) {
    console.error(`[Periodic Updates] ❌ Error sending update for ${twitchId}:`, error);
  }
}

/**
 * Run periodic updates for all enabled streamers
 */
async function runPeriodicUpdates() {
  try {
    console.log('[Periodic Updates] 🔄 Running periodic chat updates...');

    // Get all streamers with chat updates enabled
    // Check streamerSettings collection
    const settingsSnapshot = await db.collection('streamerSettings')
      .where('chatUpdates.enabled', '==', true)
      .get();

    const streamerIds = new Set();
    
    settingsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.chatUpdates && data.chatUpdates.enabled) {
        streamerIds.add(doc.id);
      }
    });

    // Also check users collection for settings
    const usersSnapshot = await db.collection('users')
      .where('chatUpdates.enabled', '==', true)
      .get();

    usersSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.chatUpdates && data.chatUpdates.enabled) {
        streamerIds.add(doc.id);
      }
    });

    if (streamerIds.size === 0) {
      console.log('[Periodic Updates] ℹ️ No streamers with chat updates enabled');
      return;
    }

    console.log(`[Periodic Updates] 📊 Processing ${streamerIds.size} streamer(s)...`);

    // Process each streamer
    const promises = Array.from(streamerIds).map(twitchId => 
      sendChatUpdateForStreamer(twitchId).catch(err => {
        console.error(`[Periodic Updates] ❌ Error processing ${twitchId}:`, err);
      })
    );

    await Promise.all(promises);
    console.log('[Periodic Updates] ✅ Completed periodic updates');
  } catch (error) {
    console.error('[Periodic Updates] ❌ Error running periodic updates:', error);
  }
}

/**
 * Initialize periodic chat updates service
 * @param {number} intervalMinutes - Update interval in minutes (default: 5)
 */
export function initializePeriodicChatUpdates(intervalMinutes = 5) {
  if (updateInterval) {
    console.log('[Periodic Updates] ⚠️ Service already initialized');
    return;
  }

  console.log(`[Periodic Updates] ✅ Initializing periodic chat updates (every ${intervalMinutes} minutes)`);

  // Run immediately on startup (after a short delay to let server initialize)
  setTimeout(() => {
    runPeriodicUpdates();
  }, 30000); // Wait 30 seconds after server start

  // Then run at specified interval
  const intervalMs = intervalMinutes * 60 * 1000;
  updateInterval = setInterval(() => {
    runPeriodicUpdates();
  }, intervalMs);

  console.log(`[Periodic Updates] ✅ Service started (interval: ${intervalMinutes} minutes)`);
}

/**
 * Stop periodic chat updates service
 */
export function stopPeriodicChatUpdates() {
  if (updateInterval) {
    clearInterval(updateInterval);
    updateInterval = null;
    console.log('[Periodic Updates] 🛑 Service stopped');
  }
}
