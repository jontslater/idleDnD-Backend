import express from 'express';
import admin from 'firebase-admin';
import { db } from '../index.js';
import { getActiveQuests } from '../services/questService.js';

const router = express.Router();

// Get active daily quests
router.get('/daily', async (req, res) => {
  try {
    const quests = await getActiveQuests('daily');
    res.json(quests);
  } catch (error) {
    console.error('Error fetching daily quests:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get active weekly quests
router.get('/weekly', async (req, res) => {
  try {
    const quests = await getActiveQuests('weekly');
    res.json(quests);
  } catch (error) {
    console.error('Error fetching weekly quests:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get active monthly quests
router.get('/monthly', async (req, res) => {
  try {
    const quests = await getActiveQuests('monthly');
    res.json(quests);
  } catch (error) {
    console.error('Error fetching monthly quests:', error);
    res.status(500).json({ error: error.message });
  }
});

// Get player's quest progress
router.get('/:userId/progress', async (req, res) => {
  try {
    const { userId } = req.params;
    
    // Try to find by document ID first (for website), then by twitchUserId/twitchId (for Electron)
    let heroDoc = await db.collection('heroes').doc(userId).get();
    
    if (!heroDoc.exists) {
      // Try finding by twitchUserId field
      const heroesSnapshot = await db.collection('heroes')
        .where('twitchUserId', '==', userId)
        .limit(1)
        .get();
      
      if (!heroesSnapshot.empty) {
        heroDoc = heroesSnapshot.docs[0];
      } else {
        // Try twitchId field
        const heroesSnapshot2 = await db.collection('heroes')
          .where('twitchId', '==', userId)
          .limit(1)
          .get();
        
        if (!heroesSnapshot2.empty) {
          heroDoc = heroesSnapshot2.docs[0];
        } else {
          return res.status(404).json({ error: 'Hero not found' });
        }
      }
    }
    
    const hero = heroDoc.data();
    
    // Initialize quest progress if it doesn't exist
    if (!hero.questProgress) {
      const questProgress = {
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
      
      await heroDoc.ref.update({ questProgress });
      return res.json(questProgress);
    }
    
    res.json(hero.questProgress);
  } catch (error) {
    console.error('Error fetching quest progress:', error);
    res.status(500).json({ error: error.message });
  }
});

// Update quest progress (called by Electron during gameplay)
// questId is now a "tracking key" like "kill", "dealDamage", etc.
router.post('/:userId/update/:trackingKey', async (req, res) => {
  try {
    const { userId, trackingKey } = req.params;
    const { type, increment = 1 } = req.body; // type: 'daily', 'weekly', 'monthly'
    
    // Find hero by twitchUserId or twitchId field (not document ID)
    const heroesSnapshot = await db.collection('heroes')
      .where('twitchUserId', '==', userId)
      .limit(1)
      .get();
    
    // If not found by twitchUserId, try twitchId
    let heroDoc = heroesSnapshot.empty ? null : heroesSnapshot.docs[0];
    
    if (!heroDoc) {
      const heroesSnapshot2 = await db.collection('heroes')
        .where('twitchId', '==', userId)
        .limit(1)
        .get();
      heroDoc = heroesSnapshot2.empty ? null : heroesSnapshot2.docs[0];
    }
    
    if (!heroDoc) {
      return res.status(404).json({ error: 'Hero not found' });
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
    
    // Get active quests
    const questDoc = await db.collection('quests').doc(type).get();
    if (!questDoc.exists) {
      return res.status(404).json({ error: 'Quest definition not found' });
    }
    
    const questData = questDoc.data();
    
    // Find ALL quests that match this tracking key (objective type)
    // Old format: questId like "kill_enemies_50"
    // New format: objective.type like "kill"
    const matchingQuests = questData.quests.filter(q => {
      // Match by objective type
      return q.objective.type === trackingKey;
    });
    
    if (matchingQuests.length === 0) {
      // No quests of this type are active - silently ignore
      console.log(`ℹ️ No ${type} quests for tracking key "${trackingKey}", skipping`);
      return res.json({ 
        success: true, 
        message: 'No matching quests active',
        updated: 0
      });
    }
    
    // Update progress for ALL matching quests
    const updates = {};
    let completedCount = 0;
    
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
      questProgress.current = Math.min(questProgress.current + increment, quest.objective.target);
      
      // Check if completed
      if (questProgress.current >= quest.objective.target && !questProgress.completed) {
        questProgress.completed = true;
        completedCount++;
        console.log(`✅ Quest completed: ${userId} - ${quest.name} (${questProgress.current}/${quest.objective.target})`);
      }
      
      updates[`questProgress.${type}.${quest.id}`] = questProgress;
    }
    
    // Save to Firestore
    await heroRef.update(updates);
    
    res.json({
      success: true,
      updated: matchingQuests.length,
      completed: completedCount > 0
    });
  } catch (error) {
    console.error('Error updating quest progress:', error);
    res.status(500).json({ error: error.message });
  }
});

// Batch update quest progress (accepts multiple tracking keys at once)
router.post('/:userId/update-batch', async (req, res) => {
  try {
    const { userId } = req.params;
    const { updates } = req.body; // Array of { trackingKey, type, increment }
    
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ error: 'updates array required' });
    }
    
    // Find hero by twitchUserId or twitchId field
    const heroesSnapshot = await db.collection('heroes')
      .where('twitchUserId', '==', userId)
      .limit(1)
      .get();
    
    let heroDoc = heroesSnapshot.empty ? null : heroesSnapshot.docs[0];
    
    if (!heroDoc) {
      const heroesSnapshot2 = await db.collection('heroes')
        .where('twitchId', '==', userId)
        .limit(1)
        .get();
      heroDoc = heroesSnapshot2.empty ? null : heroesSnapshot2.docs[0];
    }
    
    if (!heroDoc) {
      return res.status(404).json({ error: 'Hero not found' });
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
    const questDocs = await Promise.all([
      db.collection('quests').doc('daily').get(),
      db.collection('quests').doc('weekly').get(),
      db.collection('quests').doc('monthly').get()
    ]);
    
    const questDataByType = {
      daily: questDocs[0].exists ? questDocs[0].data() : null,
      weekly: questDocs[1].exists ? questDocs[1].data() : null,
      monthly: questDocs[2].exists ? questDocs[2].data() : null
    };
    
    // Process all updates and collect Firestore updates
    const firestoreUpdates = {};
    let totalUpdated = 0;
    let totalCompleted = 0;
    const completedQuests = [];
    
    for (const update of updates) {
      const { trackingKey, type, increment = 1 } = update;
      
      if (!questDataByType[type] || !questDataByType[type].quests) {
        continue; // Quest type not active
      }
      
      // Find ALL quests that match this tracking key
      const matchingQuests = questDataByType[type].quests.filter(q => {
        return q.objective.type === trackingKey;
      });
      
      if (matchingQuests.length === 0) {
        continue; // No matching quests
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
    
    res.json({
      success: true,
      updated: totalUpdated,
      completed: totalCompleted > 0,
      completedQuests: completedQuests
    });
  } catch (error) {
    console.error('Error batch updating quest progress:', error);
    res.status(500).json({ error: error.message });
  }
});

// Super-batch update: Update quest progress for multiple users at once
router.post('/update-batch-all', async (req, res) => {
  try {
    const { updates } = req.body; // Array of { userId, updates: [{ trackingKey, type, increment }] }
    
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ error: 'updates array required' });
    }
    
    // Load all quest types once (shared across all users)
    // Use getActiveQuests to ensure quests exist (generates them if missing)
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
    
    // Process all users in parallel
    const results = await Promise.all(updates.map(async (userUpdate) => {
      const { userId, updates: userQuestUpdates } = userUpdate;
      
      try {
        // Find hero by twitchUserId or twitchId field
        const heroesSnapshot = await db.collection('heroes')
          .where('twitchUserId', '==', userId)
          .limit(1)
          .get();
        
        let heroDoc = heroesSnapshot.empty ? null : heroesSnapshot.docs[0];
        
        if (!heroDoc) {
          const heroesSnapshot2 = await db.collection('heroes')
            .where('twitchId', '==', userId)
            .limit(1)
            .get();
          heroDoc = heroesSnapshot2.empty ? null : heroesSnapshot2.docs[0];
        }
        
        if (!heroDoc) {
          return { userId, success: false, error: 'Hero not found' };
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
        
        // Ensure each quest type object exists (defensive check)
        if (!hero.questProgress.daily || typeof hero.questProgress.daily !== 'object') {
          hero.questProgress.daily = {};
        }
        if (!hero.questProgress.weekly || typeof hero.questProgress.weekly !== 'object') {
          hero.questProgress.weekly = {};
        }
        if (!hero.questProgress.monthly || typeof hero.questProgress.monthly !== 'object') {
          hero.questProgress.monthly = {};
        }
        
        // Process all updates and collect Firestore updates
        const firestoreUpdates = {};
        let totalUpdated = 0;
        let totalCompleted = 0;
        const completedQuests = [];
        
        for (const update of userQuestUpdates) {
          const { trackingKey, type, increment = 1 } = update;
          
          if (!questDataByType[type] || !questDataByType[type].quests) {
            continue; // Quest type not active
          }
          
          // Ensure quest type exists in questProgress (defensive check)
          if (!hero.questProgress[type] || typeof hero.questProgress[type] !== 'object') {
            hero.questProgress[type] = {};
          }
          
          // Find ALL quests that match this tracking key
          const matchingQuests = questDataByType[type].quests.filter(q => {
            return q.objective.type === trackingKey;
          });
          
          if (matchingQuests.length === 0) {
            continue; // No matching quests
          }
          
          // Update progress for ALL matching quests
          for (const quest of matchingQuests) {
            // Double-check quest type exists (defensive - in case it was modified)
            if (!hero.questProgress || !hero.questProgress[type] || typeof hero.questProgress[type] !== 'object') {
              hero.questProgress = hero.questProgress || {};
              hero.questProgress[type] = {};
            }
            
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
          userId,
          success: true,
          updated: totalUpdated,
          completed: totalCompleted > 0,
          completedQuests: completedQuests
        };
      } catch (error) {
        console.error(`Error batch updating quests for ${userId}:`, error);
        return { userId, success: false, error: error.message };
      }
    }));
    
    res.json({
      success: true,
      results: results
    });
  } catch (error) {
    console.error('Error batch updating quest progress for all users:', error);
    res.status(500).json({ error: error.message });
  }
});

// Claim individual quest reward
router.post('/:userId/claim/:questId', async (req, res) => {
  try {
    const { userId, questId } = req.params;
    const { type } = req.body; // 'daily', 'weekly', 'monthly'
    
    // Try to find by document ID first (for website), then by twitchUserId/twitchId (for Electron)
    let heroDoc = await db.collection('heroes').doc(userId).get();
    
    if (!heroDoc.exists) {
      // Try finding by twitchUserId field
      const heroesSnapshot = await db.collection('heroes')
        .where('twitchUserId', '==', userId)
        .limit(1)
        .get();
      
      if (!heroesSnapshot.empty) {
        heroDoc = heroesSnapshot.docs[0];
      } else {
        // Try twitchId field
        const heroesSnapshot2 = await db.collection('heroes')
          .where('twitchId', '==', userId)
          .limit(1)
          .get();
        
        if (!heroesSnapshot2.empty) {
          heroDoc = heroesSnapshot2.docs[0];
        } else {
          return res.status(404).json({ error: 'Hero not found' });
        }
      }
    }
    
    const heroRef = heroDoc.ref;
    
    const hero = heroDoc.data();
    
    // Check if quest is completed
    const questProgress = hero.questProgress?.[type]?.[questId];
    if (!questProgress || !questProgress.completed) {
      return res.status(400).json({ error: 'Quest not completed' });
    }
    
    if (questProgress.claimedAt) {
      return res.status(400).json({ error: 'Quest reward already claimed' });
    }
    
    // Get quest details
    const questDoc = await db.collection('quests').doc(type).get();
    const questData = questDoc.data();
    const quest = questData.quests.find(q => q.id === questId);
    
    if (!quest) {
      return res.status(404).json({ error: 'Quest not found' });
    }
    
    // Scale quest XP with hero level (max 3x multiplier for balance)
    const heroLevel = hero.level || 1;
    const levelScaling = Math.min(1 + (heroLevel / 100), 3); // Max 3x at level 200+
    const scaledXp = Math.floor(quest.rewards.xp * levelScaling);
    
    // Apply rewards
    const updateData = {
      gold: (hero.gold || 0) + quest.rewards.gold,
      xp: (hero.xp || 0) + scaledXp,
      tokens: (hero.tokens || 0) + quest.rewards.tokens,
      [`questProgress.${type}.${questId}.claimedAt`]: admin.firestore.FieldValue.serverTimestamp()
    };
    
    // Add materials if any
    if (quest.rewards.materials) {
      quest.rewards.materials.forEach(mat => {
        const path = `profession.materials.${mat.type}.${mat.rarity}`;
        const currentAmount = hero.profession?.materials?.[mat.type]?.[mat.rarity] || 0;
        updateData[path] = currentAmount + mat.amount;
      });
    }
    
    // Add items to inventory if any
    if (quest.rewards.items && quest.rewards.items.length > 0) {
      const currentInventory = hero.inventory || [];
      quest.rewards.items.forEach(item => {
        currentInventory.push({
          ...item,
          id: Date.now() + Math.random(),
          obtainedFrom: `quest_${questId}`,
          obtainedAt: Date.now()
        });
      });
      updateData.inventory = currentInventory;
    }
    
    // Check for level up (handles multiple level-ups)
    const { processLevelUps } = await import('../utils/levelUpHelper.js');
    const levelUpResult = processLevelUps(hero, updateData.xp);
    
    if (levelUpResult.leveledUp) {
      // Merge level-up updates into updateData
      Object.assign(updateData, levelUpResult.updates);
    }
    
    await heroRef.update(updateData);
    
    // Check achievements after quest completion (may unlock new titles)
    const { checkAchievements } = await import('../services/achievementService.js');
    try {
      await checkAchievements(userId, 'questsCompleted', 1);
    } catch (error) {
      console.error('Error checking achievements after quest completion:', error);
      // Don't fail the request if achievement check fails
    }
    
    res.json({
      success: true,
      rewards: quest.rewards,
      newGold: updateData.gold,
      newXp: updateData.xp,
      newTokens: updateData.tokens,
      levelUp: levelUpResult?.leveledUp ? levelUpResult.newLevel : null
    });
  } catch (error) {
    console.error('Error claiming quest reward:', error);
    res.status(500).json({ error: error.message });
  }
});

// Claim completion bonus (all quests of a type done)
router.post('/:userId/claim-bonus/:type', async (req, res) => {
  try {
    const { userId, type } = req.params;
    
    // Try to find by document ID first (for website), then by twitchUserId/twitchId (for Electron)
    let heroDoc = await db.collection('heroes').doc(userId).get();
    
    if (!heroDoc.exists) {
      // Try finding by twitchUserId field
      const heroesSnapshot = await db.collection('heroes')
        .where('twitchUserId', '==', userId)
        .limit(1)
        .get();
      
      if (!heroesSnapshot.empty) {
        heroDoc = heroesSnapshot.docs[0];
      } else {
        // Try twitchId field
        const heroesSnapshot2 = await db.collection('heroes')
          .where('twitchId', '==', userId)
          .limit(1)
          .get();
        
        if (!heroesSnapshot2.empty) {
          heroDoc = heroesSnapshot2.docs[0];
        } else {
          return res.status(404).json({ error: 'Hero not found' });
        }
      }
    }
    
    const heroRef = heroDoc.ref;
    
    const hero = heroDoc.data();
    
    // Check if bonus already claimed
    if (hero.questProgress?.[`${type}BonusClaimed`]) {
      return res.status(400).json({ error: 'Bonus already claimed' });
    }
    
    // Get active quests
    const questDoc = await db.collection('quests').doc(type).get();
    const questData = questDoc.data();
    
    // Check if all quests are completed
    const allCompleted = questData.quests.every(quest => {
      const progress = hero.questProgress?.[type]?.[quest.id];
      return progress && progress.completed;
    });
    
    if (!allCompleted) {
      return res.status(400).json({ error: 'Not all quests completed' });
    }
    
    // Apply completion bonus (reduced by 50% and scaled with level)
    const bonus = questData.completionBonus;
    const heroLevel = hero.level || 1;
    const levelScaling = Math.min(1 + (heroLevel / 100), 3); // Max 3x at level 200+
    const scaledBonusXp = Math.floor(bonus.xp * 0.5 * levelScaling); // 50% reduction + level scaling
    
    const updateData = {
      gold: (hero.gold || 0) + bonus.gold,
      xp: (hero.xp || 0) + scaledBonusXp,
      tokens: (hero.tokens || 0) + bonus.tokens,
      [`questProgress.${type}BonusClaimed`]: true
    };
    
    // Add materials if any
    if (bonus.materials) {
      bonus.materials.forEach(mat => {
        const path = `profession.materials.${mat.type}.${mat.rarity}`;
        const currentAmount = hero.profession?.materials?.[mat.type]?.[mat.rarity] || 0;
        updateData[path] = currentAmount + mat.amount;
      });
    }
    
    // Add items to inventory if any
    if (bonus.items && bonus.items.length > 0) {
      const currentInventory = hero.inventory || [];
      bonus.items.forEach(item => {
        currentInventory.push({
          ...item,
          id: Date.now() + Math.random(),
          obtainedFrom: `${type}_completion_bonus`,
          obtainedAt: Date.now()
        });
      });
      updateData.inventory = currentInventory;
    }
    
    // Check for level up (handles multiple level-ups)
    const { processLevelUps } = await import('../utils/levelUpHelper.js');
    const levelUpResult = processLevelUps(hero, updateData.xp);
    
    if (levelUpResult.leveledUp) {
      // Merge level-up updates into updateData
      Object.assign(updateData, levelUpResult.updates);
    }
    
    await heroRef.update(updateData);
    
    res.json({
      success: true,
      bonus,
      newGold: updateData.gold,
      newXp: updateData.xp,
      newTokens: updateData.tokens,
      levelUp: levelUpResult?.leveledUp ? levelUpResult.newLevel : null
    });
  } catch (error) {
    console.error('Error claiming completion bonus:', error);
    res.status(500).json({ error: error.message });
  }
});

// Auto-claim all completed quests
router.post('/auto-claim-all', async (req, res) => {
  try {
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'userId required' });
    }
    
    // Find hero by twitchUserId
    const heroesSnapshot = await db.collection('heroes')
      .where('twitchUserId', '==', userId)
      .limit(1)
      .get();
    
    if (heroesSnapshot.empty) {
      return res.status(404).json({ error: 'Hero not found' });
    }
    
    const heroDoc = heroesSnapshot.docs[0];
    const heroRef = heroDoc.ref;
    const hero = heroDoc.data();
    
    if (!hero.questProgress) {
      return res.json({ claimed: 0, totalRewards: { gold: 0, xp: 0, tokens: 0, items: [] } });
    }
    
    let totalGold = 0;
    let totalXp = 0;
    let totalTokens = 0;
    const totalItems = [];
    const totalMaterials = [];
    let claimedCount = 0;
    const updates = {};
    
    // Scale quest XP with hero level (max 3x multiplier for balance)
    const heroLevel = hero.level || 1;
    const levelScaling = Math.min(1 + (heroLevel / 100), 3); // Max 3x at level 200+
    
    // Check all quest types
    for (const type of ['daily', 'weekly', 'monthly']) {
      const questDoc = await db.collection('quests').doc(type).get();
      if (!questDoc.exists) continue;
      
      const questData = questDoc.data();
      const typeProgress = hero.questProgress[type] || {};
      
      // Find all completed unclaimed quests
      for (const quest of questData.quests) {
        const progress = typeProgress[quest.id];
        
        if (progress && progress.completed && !progress.claimedAt) {
          // Claim this quest (scale XP with level)
          totalGold += quest.rewards.gold || 0;
          totalXp += Math.floor((quest.rewards.xp || 0) * levelScaling);
          totalTokens += quest.rewards.tokens || 0;
          
          if (quest.rewards.items) {
            totalItems.push(...quest.rewards.items);
          }
          
          if (quest.rewards.materials) {
            totalMaterials.push(...quest.rewards.materials);
          }
          
          updates[`questProgress.${type}.${quest.id}.claimedAt`] = admin.firestore.FieldValue.serverTimestamp();
          claimedCount++;
        }
      }
    }
    
    if (claimedCount === 0) {
      return res.json({ claimed: 0, totalRewards: { gold: 0, xp: 0, tokens: 0, items: [] } });
    }
    
    // Apply all rewards
    updates.gold = (hero.gold || 0) + totalGold;
    updates.xp = (hero.xp || 0) + totalXp;
    updates.tokens = (hero.tokens || 0) + totalTokens;
    
    // Add materials
    if (totalMaterials.length > 0) {
      totalMaterials.forEach(mat => {
        const path = `profession.materials.${mat.type}.${mat.rarity}`;
        const currentAmount = hero.profession?.materials?.[mat.type]?.[mat.rarity] || 0;
        updates[path] = currentAmount + mat.amount;
      });
    }
    
    // Add items to inventory
    if (totalItems.length > 0) {
      const currentInventory = hero.inventory || [];
      totalItems.forEach(item => {
        currentInventory.push({
          ...item,
          id: Date.now() + Math.random(),
          obtainedFrom: 'quest_autoclaim',
          obtainedAt: Date.now()
        });
      });
      updates.inventory = currentInventory;
    }
    
    // Check for level up (handles multiple level-ups)
    const { processLevelUps } = await import('../utils/levelUpHelper.js');
    const levelUpResult = processLevelUps(hero, updates.xp);
    
    if (levelUpResult.leveledUp) {
      // Merge level-up updates into updates
      Object.assign(updates, levelUpResult.updates);
    }
    
    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    
    await heroRef.update(updates);
    
    res.json({
      success: true,
      claimed: claimedCount,
      totalRewards: {
        gold: totalGold,
        xp: totalXp,
        tokens: totalTokens,
        items: totalItems,
        materials: totalMaterials
      },
      levelUp: levelUpResult?.leveledUp ? levelUpResult.newLevel : null
    });
  } catch (error) {
    console.error('Error auto-claiming quests:', error);
    res.status(500).json({ error: error.message });
  }
});

// Claim all completed quests for a specific type (daily/weekly/monthly)
router.post('/claim-all/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const { type } = req.body; // Optional: 'daily', 'weekly', or 'monthly'
    
    // Try to find by document ID first (for website), then by twitchUserId/twitchId (for Electron)
    let heroDoc = await db.collection('heroes').doc(userId).get();
    
    if (!heroDoc.exists) {
      // Try finding by twitchUserId field
      const heroesSnapshot = await db.collection('heroes')
        .where('twitchUserId', '==', userId)
        .limit(1)
        .get();
      
      if (!heroesSnapshot.empty) {
        heroDoc = heroesSnapshot.docs[0];
      } else {
        return res.status(404).json({ error: 'Hero not found' });
      }
    }
    
    const heroRef = heroDoc.ref;
    const hero = heroDoc.data();
    
    if (!hero.questProgress) {
      return res.json({ claimed: 0, totalRewards: { gold: 0, xp: 0, tokens: 0, items: [] } });
    }
    
    let totalGold = 0;
    let totalXp = 0;
    let totalTokens = 0;
    const totalItems = [];
    const totalMaterials = [];
    let claimedCount = 0;
    const updates = {};
    
    // Scale quest XP with hero level (max 3x multiplier for balance)
    const heroLevel = hero.level || 1;
    const levelScaling = Math.min(1 + (heroLevel / 100), 3); // Max 3x at level 200+
    
    // Determine which types to check
    const typesToCheck = type ? [type] : ['daily', 'weekly', 'monthly'];
    
    // Check specified quest types
    for (const questType of typesToCheck) {
      const questDoc = await db.collection('quests').doc(questType).get();
      if (!questDoc.exists) continue;
      
      const questData = questDoc.data();
      const typeProgress = hero.questProgress[questType] || {};
      
      // Find all completed unclaimed quests
      for (const quest of questData.quests) {
        const progress = typeProgress[quest.id];
        
        if (progress && progress.completed && !progress.claimedAt) {
          // Claim this quest (scale XP with level)
          totalGold += quest.rewards.gold || 0;
          totalXp += Math.floor((quest.rewards.xp || 0) * levelScaling);
          totalTokens += quest.rewards.tokens || 0;
          
          if (quest.rewards.items) {
            totalItems.push(...quest.rewards.items);
          }
          
          if (quest.rewards.materials) {
            totalMaterials.push(...quest.rewards.materials);
          }
          
          updates[`questProgress.${questType}.${quest.id}.claimedAt`] = admin.firestore.FieldValue.serverTimestamp();
          claimedCount++;
        }
      }
    }
    
    if (claimedCount === 0) {
      return res.json({ claimed: 0, totalRewards: { gold: 0, xp: 0, tokens: 0, items: [] } });
    }
    
    // Apply all rewards
    updates.gold = (hero.gold || 0) + totalGold;
    updates.xp = (hero.xp || 0) + totalXp;
    updates.tokens = (hero.tokens || 0) + totalTokens;
    
    // Add materials
    if (totalMaterials.length > 0) {
      totalMaterials.forEach(mat => {
        const path = `profession.materials.${mat.type}.${mat.rarity}`;
        const currentAmount = hero.profession?.materials?.[mat.type]?.[mat.rarity] || 0;
        updates[path] = currentAmount + mat.amount;
      });
    }
    
    // Add items to inventory
    if (totalItems.length > 0) {
      const currentInventory = hero.inventory || [];
      totalItems.forEach(item => {
        currentInventory.push({
          ...item,
          id: Date.now() + Math.random(),
          obtainedFrom: 'quest_claim_all',
          obtainedAt: Date.now()
        });
      });
      updates.inventory = currentInventory;
    }
    
    // Check for level up (handles multiple level-ups)
    const { processLevelUps } = await import('../utils/levelUpHelper.js');
    const levelUpResult = processLevelUps(hero, updates.xp);
    
    if (levelUpResult.leveledUp) {
      // Merge level-up updates into updates
      Object.assign(updates, levelUpResult.updates);
    }
    
    updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    
    await heroRef.update(updates);
    
    res.json({
      success: true,
      claimed: claimedCount,
      totalRewards: {
        gold: totalGold,
        xp: totalXp,
        tokens: totalTokens,
        items: totalItems,
        materials: totalMaterials
      },
      levelUp: levelUpResult?.leveledUp ? levelUpResult.newLevel : null
    });
  } catch (error) {
    console.error('Error claiming all quests:', error);
    res.status(500).json({ error: error.message });
  }
});

// Helper function to get role config (simplified version)
function getRoleConfig(role) {
  const configs = {
    paladin: { hpPerLevel: 32, attackPerLevel: 3, defensePerLevel: 5 },
    warrior: { hpPerLevel: 30, attackPerLevel: 4, defensePerLevel: 4 },
    cleric: { hpPerLevel: 16, attackPerLevel: 1, defensePerLevel: 2 },
    druid: { hpPerLevel: 14, attackPerLevel: 1, defensePerLevel: 1 },
    berserker: { hpPerLevel: 20, attackPerLevel: 6, defensePerLevel: 1 },
    mage: { hpPerLevel: 17, attackPerLevel: 7, defensePerLevel: 1 }
  };
  
  return configs[role] || { hpPerLevel: 20, attackPerLevel: 3, defensePerLevel: 2 };
}

export default router;
