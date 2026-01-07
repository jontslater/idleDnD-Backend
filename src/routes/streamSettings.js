/**
 * Stream Settings Routes
 * Handle configuration for periodic chat updates
 */

import express from 'express';
import { db } from '../index.js';
import admin from 'firebase-admin';
import { joinChannelAsBot, leaveChannelAsBot, sendChatMessageAsBot } from '../websocket/twitch-events.js';

const router = express.Router();

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
    console.error(`[Stream Settings] ❌ Error getting username for ${twitchId}:`, error);
    return null;
  }
}

/**
 * Get default chat update settings
 */
function getDefaultSettings() {
  return {
    enabled: false, // Default to disabled (opt-in)
    intervalMinutes: 7,
    showWaves: true,
    showXp: true,
    showLevelUps: true,
    showGold: false,
    customMessage: null,
    sendWhenOffline: false // Default to only sending when live
  };
}

/**
 * Test chat update (sends a test message to chat)
 * POST /api/stream/settings/:twitchId/test
 * Must be before /:twitchId route to avoid route conflicts
 */
router.post('/:twitchId/test', async (req, res) => {
  try {
    const { twitchId } = req.params;

    // Get streamer's settings
    const settingsDoc = await db.collection('streamerSettings').doc(twitchId).get();
    let settings = null;
    
    if (settingsDoc.exists) {
      settings = settingsDoc.data().chatUpdates || getDefaultSettings();
    } else {
      // Fallback: try user document
      const userDoc = await db.collection('users').doc(twitchId).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        settings = userData.chatUpdates || getDefaultSettings();
      } else {
        settings = getDefaultSettings();
      }
    }

    // Get streamer's username
    const username = await getStreamerUsername(twitchId);
    if (!username) {
      return res.status(404).json({
        success: false,
        error: 'Could not find username for this Twitch ID'
      });
    }

    // Create test message based on settings
    const testParts = [];
    
    if (settings.showWaves) {
      testParts.push('5 waves completed');
    }
    
    if (settings.showXp) {
      testParts.push('1,250 XP gained');
    }
    
    if (settings.showLevelUps) {
      testParts.push('2 heroes leveled up');
    }
    
    if (settings.showGold) {
      testParts.push('500 gold gained');
    }

    let testMessage;
    if (settings.customMessage) {
      // Use custom template with test data
      testMessage = settings.customMessage
        .replace(/{time}/g, '1 minute')
        .replace(/{waves}/g, '5')
        .replace(/{xp}/g, '1,250')
        .replace(/{levelups}/g, '2')
        .replace(/{gold}/g, '500');
    } else {
      // Default format
      if (testParts.length === 0) {
        testMessage = '🧪 Test message: No stats enabled to display';
      } else {
        testMessage = `🧪 Test message: Last 1 minute: ${testParts.join(', ')}!`;
      }
    }

    // Send test message via TNEWBOT
    await sendChatMessageAsBot(username, testMessage);
    console.log(`[Stream Settings] ✅ Sent test message to ${username}: ${testMessage}`);

    res.json({
      success: true,
      message: `Test message sent to ${username}'s chat`,
      testMessage: testMessage
    });
  } catch (error) {
    console.error('Error testing chat update:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Failed to send test message'
    });
  }
});

/**
 * Get streamer's chat update settings
 * GET /api/stream/settings/:twitchId
 */
router.get('/:twitchId', async (req, res) => {
  try {
    const { twitchId } = req.params;

    // Try streamerSettings collection first
    const settingsDoc = await db.collection('streamerSettings').doc(twitchId).get();
    
    if (settingsDoc.exists) {
      const data = settingsDoc.data();
      return res.json({
        success: true,
        settings: data.chatUpdates || getDefaultSettings()
      });
    }

    // Fallback: check users collection
    const userDoc = await db.collection('users').doc(twitchId).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      return res.json({
        success: true,
        settings: userData.chatUpdates || getDefaultSettings()
      });
    }

    // Return default settings if not found
    res.json({
      success: true,
      settings: getDefaultSettings()
    });
  } catch (error) {
    console.error('Error getting stream settings:', error);
    res.status(500).json({ error: 'Failed to get stream settings' });
  }
});

/**
 * Update streamer's chat update settings
 * PUT /api/stream/settings/:twitchId
 * Body: {
 *   enabled: boolean,
 *   intervalMinutes: number (5-60),
 *   showWaves: boolean,
 *   showXp: boolean,
 *   showLevelUps: boolean,
 *   showGold: boolean,
 *   customMessage: string (optional)
 * }
 */
router.put('/:twitchId', async (req, res) => {
  try {
    const { twitchId } = req.params;
    const {
      enabled,
      intervalMinutes,
      showWaves,
      showXp,
      showLevelUps,
      showGold,
      customMessage,
      sendWhenOffline
    } = req.body;

    // Validate interval (5 minutes to 1 hour)
    if (intervalMinutes !== undefined && (intervalMinutes < 5 || intervalMinutes > 60)) {
      return res.status(400).json({ 
        error: 'intervalMinutes must be between 5 and 60' 
      });
    }

    // Build settings object
    const chatUpdates = {
      enabled: enabled !== undefined ? enabled : true,
      intervalMinutes: intervalMinutes !== undefined ? intervalMinutes : 7,
      showWaves: showWaves !== undefined ? showWaves : true,
      showXp: showXp !== undefined ? showXp : true,
      showLevelUps: showLevelUps !== undefined ? showLevelUps : true,
      showGold: showGold !== undefined ? showGold : false,
      customMessage: customMessage || null,
      sendWhenOffline: sendWhenOffline !== undefined ? sendWhenOffline : false
    };

    // Get previous settings to check if enabled state changed
    const previousSettingsDoc = await db.collection('streamerSettings').doc(twitchId).get();
    const previousEnabled = previousSettingsDoc.exists && previousSettingsDoc.data().chatUpdates?.enabled;
    const enabledChanged = previousEnabled !== chatUpdates.enabled;

    // Save to streamerSettings collection
    await db.collection('streamerSettings').doc(twitchId).set({
      twitchId,
      chatUpdates,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    console.log(`[Stream Settings] ✅ Updated settings for ${twitchId}`);

    // If enabled state changed, join/leave channel accordingly
    if (enabledChanged) {
      try {
        const username = await getStreamerUsername(twitchId);
        if (username) {
          if (chatUpdates.enabled) {
            // Join channel when enabled
            const joined = await joinChannelAsBot(username);
            if (joined) {
              console.log(`[Stream Settings] ✅ TNEWBOT joined ${username}'s channel`);
            } else {
              console.warn(`[Stream Settings] ⚠️ Failed to join ${username}'s channel (bot may not be configured)`);
            }
          } else {
            // Leave channel when disabled
            const left = await leaveChannelAsBot(username);
            if (left) {
              console.log(`[Stream Settings] ✅ TNEWBOT left ${username}'s channel`);
            }
          }
        } else {
          console.warn(`[Stream Settings] ⚠️ Could not find username for Twitch ID ${twitchId}`);
        }
      } catch (error) {
        console.error(`[Stream Settings] ❌ Error joining/leaving channel:`, error);
        // Don't fail the request if channel join/leave fails
      }
    }

    res.json({
      success: true,
      message: 'Settings updated successfully',
      settings: chatUpdates
    });
  } catch (error) {
    console.error('Error updating stream settings:', error);
    res.status(500).json({ error: 'Failed to update stream settings' });
  }
});

export default router;
