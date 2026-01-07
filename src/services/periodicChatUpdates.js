/**
 * Periodic Chat Updates Service
 * Sends periodic stats updates to Twitch chat when streamers are live
 */

import { db } from '../index.js';
import admin from 'firebase-admin';
import { sendChatMessageAsBot } from '../websocket/twitch-events.js';
import { getStats, resetStats } from './streamStatsService.js';
import fetch from 'node-fetch';

const TWITCH_CLIENT_ID = process.env.TWITCH_CLIENT_ID;
const TWITCH_CLIENT_SECRET = process.env.TWITCH_CLIENT_SECRET;

let updateInterval = null;
let twitchAccessToken = null;

// Cache for streamer settings to reduce Firestore reads
const streamerSettingsCache = {
  data: new Map(),
  expiresAt: new Map(),
  ttl: 5 * 60 * 1000 // 5 minutes
};

// Cache for usernames to reduce Firestore reads
const usernameCache = {
  data: new Map(),
  expiresAt: new Map(),
  ttl: 10 * 60 * 1000 // 10 minutes
};

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
 * Get streamer's chat update settings (with caching)
 * @param {string} twitchId - Streamer's Twitch ID
 * @returns {Promise<Object|null>}
 */
async function getStreamerSettings(twitchId) {
  // Check cache first
  const cached = streamerSettingsCache.data.get(twitchId);
  const expiresAt = streamerSettingsCache.expiresAt.get(twitchId);
  if (cached !== undefined && expiresAt && Date.now() < expiresAt) {
    return cached;
  }

  try {
    // Try to find in streamerSettings collection first
    const settingsDoc = await db.collection('streamerSettings').doc(twitchId).get();
    let settings = null;
    
    if (settingsDoc.exists) {
      settings = settingsDoc.data().chatUpdates || null;
    } else {
      // Fallback: try to find in user document
      const userDoc = await db.collection('users').doc(twitchId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        settings = userData.chatUpdates || null;
      }
    }

    // Update cache
    streamerSettingsCache.data.set(twitchId, settings);
    streamerSettingsCache.expiresAt.set(twitchId, Date.now() + streamerSettingsCache.ttl);

    return settings;
  } catch (error) {
    // Handle quota errors - return cached if available
    if (error.code === 8 || error.message?.includes('Quota exceeded')) {
      if (cached !== undefined) {
        console.warn(`[Periodic Updates] ⚠️ Quota exceeded, using cached settings for ${twitchId}`);
        return cached;
      }
    }
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
  let minutes = Math.floor((Date.now() - periodStart) / 60000);
  
  // Cap the time at the configured interval (to avoid showing "Last 30264 minutes" if stats accumulated for days)
  const maxMinutes = settings.intervalMinutes || 7;
  if (minutes > maxMinutes) {
    minutes = maxMinutes;
  }
  
  // Format time string
  let timeStr;
  if (minutes === 1) {
    timeStr = '1 minute';
  } else if (minutes < 60) {
    timeStr = `${minutes} minutes`;
  } else if (minutes === 60) {
    timeStr = '1 hour';
  } else {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (remainingMinutes === 0) {
      timeStr = hours === 1 ? '1 hour' : `${hours} hours`;
    } else {
      timeStr = `${hours} hour${hours !== 1 ? 's' : ''} and ${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`;
    }
  }

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
 * Get streamer's Twitch username from their Twitch ID (with caching)
 * @param {string} twitchId - Streamer's Twitch user ID
 * @returns {Promise<string|null>}
 */
async function getStreamerUsername(twitchId) {
  // Check cache first
  const cached = usernameCache.data.get(twitchId);
  const expiresAt = usernameCache.expiresAt.get(twitchId);
  if (cached !== undefined && expiresAt && Date.now() < expiresAt) {
    return cached;
  }

  try {
    // Try to find hero with this twitchId to get username
    const heroesSnapshot = await db.collection('heroes')
      .where('twitchUserId', '==', twitchId)
      .limit(1)
      .get();

    let username = null;

    if (!heroesSnapshot.empty) {
      const hero = heroesSnapshot.docs[0].data();
      username = hero.twitchUsername || hero.name || null;
    } else {
      // Fallback: try user document
      const userDoc = await db.collection('users').doc(twitchId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        username = userData.twitchUsername || userData.username || null;
      }
    }

    // Update cache
    usernameCache.data.set(twitchId, username);
    usernameCache.expiresAt.set(twitchId, Date.now() + usernameCache.ttl);

    return username;
  } catch (error) {
    // Handle quota errors - return cached if available
    if (error.code === 8 || error.message?.includes('Quota exceeded')) {
      if (cached !== undefined) {
        console.warn(`[Periodic Updates] ⚠️ Quota exceeded, using cached username for ${twitchId}`);
        return cached;
      }
    }
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
    // Get streamer's settings first (needed to check sendWhenOffline)
    const settings = await getStreamerSettings(twitchId);
    if (!settings || !settings.enabled) {
      console.log(`[Periodic Updates] ⏭️ Streamer ${twitchId} has chat updates disabled in settings`);
      return; // Chat updates disabled for this streamer
    }

    // Check if streamer is live (unless sendWhenOffline is enabled)
    if (!settings.sendWhenOffline) {
      const isLive = await checkStreamStatus(twitchId);
      if (!isLive) {
        console.log(`[Periodic Updates] ⏭️ Streamer ${twitchId} is offline and sendWhenOffline is disabled, skipping`);
        return;
      }
    } else {
      // Log that we're sending even though offline (for testing)
      const isLive = await checkStreamStatus(twitchId);
      if (!isLive) {
        console.log(`[Periodic Updates] 📤 Streamer ${twitchId} is offline but sendWhenOffline is enabled, sending update anyway`);
      }
    }

    // Get current stats
    const stats = await getStats(twitchId);
    if (!stats) {
      console.log(`[Periodic Updates] ⏭️ Streamer ${twitchId} has no stats to report`);
      return; // No stats to report
    }

    // If periodStart is very old (more than 2x the interval), reset it to now
    // This handles cases where stats accumulated for days before updates were enabled
    if (stats.periodStart) {
      const periodStart = stats.periodStart?.toMillis?.() || new Date(stats.periodStart).getTime();
      const minutesSinceStart = Math.floor((Date.now() - periodStart) / 60000);
      const maxAge = (settings.intervalMinutes || 7) * 2;
      
      if (minutesSinceStart > maxAge) {
        console.log(`[Periodic Updates] ⚠️ Stats period is ${minutesSinceStart} minutes old (max: ${maxAge}), resetting periodStart to now`);
        // Update periodStart to now while keeping accumulated stats
        const statsRef = db.collection('streamStats').doc(twitchId);
        await statsRef.set({
          periodStart: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
        // Re-fetch stats to get the updated periodStart
        const updatedStats = await getStats(twitchId);
        if (updatedStats && updatedStats.periodStart) {
          stats.periodStart = updatedStats.periodStart;
        } else {
          // Fallback: use current time
          stats.periodStart = { toMillis: () => Date.now() };
        }
      }
    }

    // Format message (will cap time display to interval)
    const message = formatUpdateMessage(stats, settings);
    if (!message) {
      console.log(`[Periodic Updates] ⏭️ Streamer ${twitchId} has no message to send (no enabled stats with values)`);
      return; // No message to send
    }

    // Get streamer's username for channel name
    const username = await getStreamerUsername(twitchId);
    if (!username) {
      console.warn(`[Periodic Updates] ⚠️ Could not find username for Twitch ID ${twitchId}`);
      return;
    }

    // Send message via TNEWBOT
    try {
      await sendChatMessageAsBot(username, message);
      console.log(`[Periodic Updates] ✅ Sent update to ${username}: ${message}`);

      // Reset stats for next period
      await resetStats(twitchId);
    } catch (error) {
      // Check if it's a connection error
      if (error.message && error.message.includes('No available Twitch client')) {
        console.error(`[Periodic Updates] ❌ Cannot send update to ${username} (${twitchId}): Bot client not connected.`);
        console.error(`[Periodic Updates] 💡 To fix: Ensure TNEWBOT_USERNAME and TNEWBOT_OAUTH_TOKEN are set, or the streamer needs to log in via OAuth.`);
      } else {
        throw error; // Re-throw other errors
      }
    }
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
    let settingsSnapshot, usersSnapshot;
    
    try {
      settingsSnapshot = await db.collection('streamerSettings')
        .where('chatUpdates.enabled', '==', true)
        .get();
    } catch (error) {
      if (error.code === 8 || error.message?.includes('Quota exceeded') || error.message?.includes('RESOURCE_EXHAUSTED')) {
        console.warn('[Periodic Updates] ⚠️ Firestore quota exceeded, skipping updates');
        return;
      }
      throw error;
    }

    const streamerIds = new Set();
    
    settingsSnapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.chatUpdates && data.chatUpdates.enabled) {
        streamerIds.add(doc.id);
      }
    });

    // Also check users collection for settings
    try {
      usersSnapshot = await db.collection('users')
        .where('chatUpdates.enabled', '==', true)
        .get();
    } catch (error) {
      if (error.code === 8 || error.message?.includes('Quota exceeded') || error.message?.includes('RESOURCE_EXHAUSTED')) {
        console.warn('[Periodic Updates] ⚠️ Firestore quota exceeded on users query, continuing with streamerSettings only');
        // Continue with what we have
      } else {
        throw error;
      }
    }

    if (usersSnapshot) {
      usersSnapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.chatUpdates && data.chatUpdates.enabled) {
          streamerIds.add(doc.id);
        }
      });
    }

    if (streamerIds.size === 0) {
      console.log('[Periodic Updates] ℹ️ No streamers with chat updates enabled');
      return;
    }

    console.log(`[Periodic Updates] 📊 Found ${streamerIds.size} streamer(s) with chat updates enabled: ${Array.from(streamerIds).join(', ')}`);
    console.log(`[Periodic Updates] 🔄 Processing updates...`);

    // Process each streamer
    const promises = Array.from(streamerIds).map(twitchId => 
      sendChatUpdateForStreamer(twitchId).catch(err => {
        // Don't log quota errors as errors - they're expected
        if (err.code === 8 || err.message?.includes('Quota exceeded') || err.message?.includes('RESOURCE_EXHAUSTED')) {
          console.warn(`[Periodic Updates] ⚠️ Skipping ${twitchId} due to quota`);
        } else {
          console.error(`[Periodic Updates] ❌ Error processing ${twitchId}:`, err);
        }
      })
    );

    await Promise.all(promises);
    console.log('[Periodic Updates] ✅ Completed periodic updates');
  } catch (error) {
    // Handle quota errors at top level
    if (error.code === 8 || error.message?.includes('Quota exceeded') || error.message?.includes('RESOURCE_EXHAUSTED')) {
      console.warn('[Periodic Updates] ⚠️ Firestore quota exceeded, skipping this update cycle');
      return;
    }
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
