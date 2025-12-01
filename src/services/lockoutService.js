/**
 * Weekly Lockout Service
 * Handles weekly lockouts for raids to prevent farming
 */

const admin = require('firebase-admin');

const LOCKOUT_DURATION = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

/**
 * Get user's lockout status for a raid
 * @param {string} userId - User ID
 * @param {string} raidId - Raid ID
 * @returns {Promise<{locked: boolean, resetTime: number | null}>}
 */
async function getLockoutStatus(userId, raidId) {
  try {
    const lockoutRef = admin.firestore().collection('raidLockouts').doc(`${userId}_${raidId}`);
    const lockoutDoc = await lockoutRef.get();

    if (!lockoutDoc.exists) {
      return { locked: false, resetTime: null };
    }

    const lockoutData = lockoutDoc.data();
    const lastCompleted = lockoutData.lastCompleted?.toMillis() || 0;
    const resetTime = lastCompleted + LOCKOUT_DURATION;
    const now = Date.now();

    if (now >= resetTime) {
      // Lockout has expired
      return { locked: false, resetTime: null };
    }

    return {
      locked: true,
      resetTime: resetTime
    };
  } catch (error) {
    console.error(`[LockoutService] Error getting lockout status for ${userId}/${raidId}:`, error);
    return { locked: false, resetTime: null }; // Fail open
  }
}

/**
 * Set lockout for a user after completing a raid
 * @param {string} userId - User ID
 * @param {string} raidId - Raid ID
 * @returns {Promise<void>}
 */
async function setLockout(userId, raidId) {
  try {
    const lockoutRef = admin.firestore().collection('raidLockouts').doc(`${userId}_${raidId}`);
    await lockoutRef.set({
      userId,
      raidId,
      lastCompleted: admin.firestore.FieldValue.serverTimestamp(),
      resetTime: admin.firestore.Timestamp.fromMillis(Date.now() + LOCKOUT_DURATION),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  } catch (error) {
    console.error(`[LockoutService] Error setting lockout for ${userId}/${raidId}:`, error);
    throw error;
  }
}

/**
 * Check if user can start a raid (not locked out)
 * @param {string} userId - User ID
 * @param {string} raidId - Raid ID
 * @returns {Promise<boolean>}
 */
async function canStartRaid(userId, raidId) {
  const status = await getLockoutStatus(userId, raidId);
  return !status.locked;
}

/**
 * Get all lockouts for a user
 * @param {string} userId - User ID
 * @returns {Promise<Array<{raidId: string, resetTime: number}>>}
 */
async function getUserLockouts(userId) {
  try {
    const lockoutsSnapshot = await admin.firestore()
      .collection('raidLockouts')
      .where('userId', '==', userId)
      .get();

    const lockouts = [];
    const now = Date.now();

    lockoutsSnapshot.forEach(doc => {
      const data = doc.data();
      const resetTime = data.resetTime?.toMillis() || 0;
      
      if (now < resetTime) {
        lockouts.push({
          raidId: data.raidId,
          resetTime: resetTime,
          timeRemaining: resetTime - now
        });
      }
    });

    return lockouts;
  } catch (error) {
    console.error(`[LockoutService] Error getting user lockouts for ${userId}:`, error);
    return [];
  }
}

/**
 * Reset lockout for a user (admin function)
 * @param {string} userId - User ID
 * @param {string} raidId - Raid ID
 * @returns {Promise<void>}
 */
async function resetLockout(userId, raidId) {
  try {
    const lockoutRef = admin.firestore().collection('raidLockouts').doc(`${userId}_${raidId}`);
    await lockoutRef.delete();
  } catch (error) {
    console.error(`[LockoutService] Error resetting lockout for ${userId}/${raidId}:`, error);
    throw error;
  }
}

/**
 * Clean up expired lockouts (maintenance function)
 * @returns {Promise<number>} Number of lockouts cleaned up
 */
async function cleanupExpiredLockouts() {
  try {
    const now = Date.now();
    const lockoutsSnapshot = await admin.firestore()
      .collection('raidLockouts')
      .get();

    const batch = admin.firestore().batch();
    let count = 0;

    lockoutsSnapshot.forEach(doc => {
      const data = doc.data();
      const resetTime = data.resetTime?.toMillis() || 0;
      
      if (now >= resetTime) {
        batch.delete(doc.ref);
        count++;
      }
    });

    if (count > 0) {
      await batch.commit();
    }

    return count;
  } catch (error) {
    console.error('[LockoutService] Error cleaning up expired lockouts:', error);
    return 0;
  }
}

module.exports = {
  getLockoutStatus,
  setLockout,
  canStartRaid,
  getUserLockouts,
  resetLockout,
  cleanupExpiredLockouts,
  LOCKOUT_DURATION
};



