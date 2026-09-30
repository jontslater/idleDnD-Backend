/**
 * Quest Update Service
 * Shared logic for batch updating quest progress
 * Used by quest routes and profession routes
 */

import admin from 'firebase-admin';
import { getActiveQuests } from './questService.js';

// Get db lazily to avoid circular dependency
const getDb = () => {
  return admin.firestore();
};

/**
 * Batch update quest progress for a user
 * @param {string} twitchUserId - User's Twitch ID
 * @param {Array} updates - Array of { trackingKey, type, increment }
 * @returns {Promise<Object>} Result with success/error
 */
export async function batchUpdateQuestProgress(twitchUserId, updates) {
  const db = getDb();
  
  if (!Array.isArray(updates) || updates.length === 0) {
    return { success: false, error: 'updates array required' };
  }
  
  // Find hero by twitchUserId or twitchId field
  const heroesSnapshot = await db.collection('heroes')
    .where('twitchUserId', '==', twitchUserId)
    .limit(1)
    .get();
  
  let heroDoc = heroesSnapshot.empty ? null : heroesSnapshot.docs[0];
  
  if (!heroDoc) {
    const heroesSnapshot2 = await db.collection('heroes')
      .where('twitchId', '==', twitchUserId)
      .limit(1)
      .get();
    heroDoc = heroesSnapshot2.empty ? null : heroesSnapshot2.docs[0];
  }
  
  if (!heroDoc) {
    return { success: false, error: 'Hero not found' };
  }
  
  const heroRef = heroDoc.ref;
  const hero = heroDoc.data();
  
  // Initialize quest progress if needed
  if (!hero.questProgress) {
    hero.questProgress = {
      daily: {},
      weekly: {},
      monthly: {},
      lastDailyReset: admin.firestore.Timestamp.now(),
      lastWeeklyReset: admin.firestore.Timestamp.now(),
      lastMonthlyReset: admin.firestore.Timestamp.now(),
      dailiesCompletedThisWeek: 0,
      dailiesCompletedThisMonth: 0,
      weekliesCompletedThisMonth: 0,
      dailyBonusClaimed: false,
      weeklyBonusClaimed: false,
      monthlyBonusClaimed: false
    };
  }
  
  // Load all quest types once (instead of per update)
  const [dailyQuests, weeklyQuests, monthlyQuests] = await Promise.all([
    getActiveQuests('daily'),
    getActiveQuests('weekly'),
    getActiveQuests('monthly')
  ]);
  
  const questDataByType = {
    daily: dailyQuests,
    weekly: weeklyQuests,
    monthly: monthlyQuests
  };
  
  // Process all updates
  const firestoreUpdates = {};
  let totalUpdated = 0;
  let totalCompleted = 0;
  const completedQuests = [];
  
  for (const update of updates) {
    const { trackingKey, type = 'daily', increment = 1 } = update;
    
    if (!trackingKey || !['daily', 'weekly', 'monthly'].includes(type)) {
      console.warn(`Invalid update in batch:`, update);
      continue;
    }
    
    // Find all quests matching this tracking key
    const quests = questDataByType[type];
    const matchingQuests = quests.filter(q => 
      q.objective && q.objective.trackingKey === trackingKey
    );
    
    if (matchingQuests.length === 0) {
      continue;
    }
    
    // Update progress for ALL matching quests
    for (const quest of matchingQuests) {
      // Initialize quest progress if not tracking yet
      if (!hero.questProgress[type][quest.id]) {
        hero.questProgress[type][quest.id] = {
          current: 0,
          completed: false,
          claimedAt: null
        };
      }
      
      const questProgress = hero.questProgress[type][quest.id];
      const oldCurrent = questProgress.current;
      questProgress.current = Math.min(questProgress.current + increment, quest.objective.target);
      
      // Check if completed
      if (questProgress.current >= quest.objective.target && !questProgress.completed) {
        questProgress.completed = true;
        totalCompleted++;
        completedQuests.push({ type, questId: quest.id, questName: quest.name });
      }
      
      // Only update if progress actually changed
      if (questProgress.current !== oldCurrent) {
        firestoreUpdates[`questProgress.${type}.${quest.id}`] = questProgress;
        totalUpdated++;
      }
    }
  }
  
  // Save all updates in a single Firestore write
  if (Object.keys(firestoreUpdates).length > 0) {
    await heroRef.update(firestoreUpdates);
  }
  
  return {
    success: true,
    updated: totalUpdated,
    completed: totalCompleted > 0,
    completedQuests: completedQuests
  };
}
