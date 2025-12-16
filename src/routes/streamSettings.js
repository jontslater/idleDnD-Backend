/**
 * Stream Settings Routes
 * Handle configuration for periodic chat updates
 */

import express from 'express';
import { db } from '../index.js';
import admin from 'firebase-admin';

const router = express.Router();

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
 *   intervalMinutes: number (5-10),
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
      customMessage
    } = req.body;

    // Validate interval
    if (intervalMinutes !== undefined && (intervalMinutes < 5 || intervalMinutes > 10)) {
      return res.status(400).json({ 
        error: 'intervalMinutes must be between 5 and 10' 
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
      customMessage: customMessage || null
    };

    // Save to streamerSettings collection
    await db.collection('streamerSettings').doc(twitchId).set({
      twitchId,
      chatUpdates,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    console.log(`[Stream Settings] ✅ Updated settings for ${twitchId}`);

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
    customMessage: null
  };
}

export default router;
