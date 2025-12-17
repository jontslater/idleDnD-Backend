/**
 * Stream Stats Tracking Service
 * Tracks statistics for periodic chat updates (waves, XP, level ups, etc.)
 */

import { db } from '../index.js';
import admin from 'firebase-admin';

const COLLECTION_NAME = 'streamStats';

/**
 * Track a wave completion for a streamer
 * @param {string} twitchId - Streamer's Twitch ID
 */
export async function trackWaveCompleted(twitchId) {
  try {
    const statsRef = db.collection(COLLECTION_NAME).doc(twitchId);
    // Use merge to avoid read-before-write pattern (reduces operations by 50%)
    // FieldValue.increment works even if field doesn't exist (creates it as 0 then increments)
    await statsRef.set({
      twitchId,
      wavesCompleted: admin.firestore.FieldValue.increment(1),
      lastUpdateTime: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    
    // Initialize periodStart lazily - only set if not already set (one-time per period)
    // We use a separate merge call but this is rare (only on first write per period)
    // Could be optimized further with transactions, but this is acceptable
    const statsDoc = await statsRef.get();
    if (!statsDoc.exists || !statsDoc.data().periodStart) {
      await statsRef.set({
        periodStart: admin.firestore.FieldValue.serverTimestamp()
      }, { merge: true });
    }
  } catch (error) {
    console.error(`[StreamStats] ❌ Error tracking wave completion for ${twitchId}:`, error);
  }
}

/**
 * Track XP gained for a streamer
 * @param {string} twitchId - Streamer's Twitch ID
 * @param {number} amount - Amount of XP gained
 */
export async function trackXpGained(twitchId, amount) {
  if (!amount || amount <= 0) return;
  
  try {
    const statsRef = db.collection(COLLECTION_NAME).doc(twitchId);
    // Use merge to avoid read-before-write pattern (reduces operations by 50%)
    await statsRef.set({
      twitchId,
      totalXpGained: admin.firestore.FieldValue.increment(amount),
      lastUpdateTime: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error(`[StreamStats] ❌ Error tracking XP gain for ${twitchId}:`, error);
  }
}

/**
 * Track a hero level up for a streamer
 * @param {string} twitchId - Streamer's Twitch ID
 */
export async function trackLevelUp(twitchId) {
  try {
    const statsRef = db.collection(COLLECTION_NAME).doc(twitchId);
    // Use merge to avoid read-before-write pattern (reduces operations by 50%)
    await statsRef.set({
      twitchId,
      heroesLeveledUp: admin.firestore.FieldValue.increment(1),
      lastUpdateTime: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error(`[StreamStats] ❌ Error tracking level up for ${twitchId}:`, error);
  }
}

/**
 * Track gold gained for a streamer (optional)
 * @param {string} twitchId - Streamer's Twitch ID
 * @param {number} amount - Amount of gold gained
 */
export async function trackGoldGained(twitchId, amount) {
  if (!amount || amount <= 0) return;
  
  try {
    const statsRef = db.collection(COLLECTION_NAME).doc(twitchId);
    // Use merge to avoid read-before-write pattern (reduces operations by 50%)
    await statsRef.set({
      twitchId,
      goldGained: admin.firestore.FieldValue.increment(amount),
      lastUpdateTime: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
  } catch (error) {
    console.error(`[StreamStats] ❌ Error tracking gold gain for ${twitchId}:`, error);
  }
}

/**
 * Get current stats for a streamer
 * @param {string} twitchId - Streamer's Twitch ID
 * @returns {Promise<Object|null>} Stats object or null if not found
 */
export async function getStats(twitchId) {
  try {
    const statsDoc = await db.collection(COLLECTION_NAME).doc(twitchId).get();
    
    if (statsDoc.exists) {
      const data = statsDoc.data();
      return {
        twitchId: data.twitchId,
        periodStart: data.periodStart,
        wavesCompleted: data.wavesCompleted || 0,
        totalXpGained: data.totalXpGained || 0,
        heroesLeveledUp: data.heroesLeveledUp || 0,
        goldGained: data.goldGained || 0,
        lastUpdateTime: data.lastUpdateTime
      };
    }
    
    return null;
  } catch (error) {
    console.error(`[StreamStats] ❌ Error getting stats for ${twitchId}:`, error);
    return null;
  }
}

/**
 * Reset stats for a new period
 * @param {string} twitchId - Streamer's Twitch ID
 */
export async function resetStats(twitchId) {
  try {
    const statsRef = db.collection(COLLECTION_NAME).doc(twitchId);
    await statsRef.set({
      twitchId,
      periodStart: admin.firestore.FieldValue.serverTimestamp(),
      wavesCompleted: 0,
      totalXpGained: 0,
      heroesLeveledUp: 0,
      goldGained: 0,
      lastUpdateTime: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: false }); // Overwrite completely
  } catch (error) {
    console.error(`[StreamStats] ❌ Error resetting stats for ${twitchId}:`, error);
  }
}
