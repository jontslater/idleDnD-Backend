import express from 'express';
import admin from 'firebase-admin';
import { getActiveQuests } from '../services/questService.js';
import { resolveHeroByDocId } from '../utils/questHeroResolver.js';
import { filterQuestDocumentForHero } from '../utils/questTier.js';
import {
  applyQuestTrackingForHero,
  prepareHeroQuestState,
  buildMetaProgressUpdatesForClaim,
  incrementMetaQuestsByType,
  ensureQuestProgressShape
} from '../services/questProgressService.js';
import { processLevelUps } from '../utils/levelUpHelper.js';
import { checkAchievements } from '../services/achievementService.js';

const router = express.Router();

async function loadFilteredQuests(type, heroId) {
  const questDoc = await getActiveQuests(type);
  if (!heroId) return questDoc;
  const resolved = await resolveHeroByDocId(heroId);
  if (!resolved) return questDoc;
  return filterQuestDocumentForHero(questDoc, resolved.data.level || 1);
}

router.get('/daily', async (req, res) => {
  try {
    const quests = await loadFilteredQuests('daily', req.query.heroId);
    res.json(quests);
  } catch (error) {
    console.error('Error fetching daily quests:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch daily quests' });
  }
});

router.get('/weekly', async (req, res) => {
  try {
    const quests = await loadFilteredQuests('weekly', req.query.heroId);
    res.json(quests);
  } catch (error) {
    console.error('Error fetching weekly quests:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch weekly quests' });
  }
});

router.get('/monthly', async (req, res) => {
  try {
    const quests = await loadFilteredQuests('monthly', req.query.heroId);
    res.json(quests);
  } catch (error) {
    console.error('Error fetching monthly quests:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch monthly quests' });
  }
});

router.get('/:heroId/progress', async (req, res) => {
  try {
    const { heroId } = req.params;
    const prepared = await prepareHeroQuestState(heroId);
    if (!prepared) {
      return res.status(404).json({ error: 'Hero not found' });
    }
    res.json(prepared.data.questProgress);
  } catch (error) {
    console.error('Error fetching quest progress:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/:heroId/update-batch', async (req, res) => {
  try {
    const { heroId } = req.params;
    const { updates } = req.body;
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ error: 'updates array required' });
    }
    const result = await applyQuestTrackingForHero(heroId, updates);
    if (!result.success) {
      return res.status(result.status || 500).json({ error: result.error });
    }
    res.json(result);
  } catch (error) {
    console.error('Error batch updating quest progress:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/update-batch-all', async (req, res) => {
  try {
    const { updates } = req.body;
    if (!Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({ error: 'updates array required' });
    }

    const results = await Promise.all(
      updates.map(async (entry) => {
        const heroId = entry.heroId;
        if (!heroId) {
          return { heroId: null, success: false, error: 'heroId required' };
        }
        try {
          return await applyQuestTrackingForHero(heroId, entry.updates || []);
        } catch (error) {
          return { heroId, success: false, error: error.message };
        }
      })
    );

    res.json({ success: true, results });
  } catch (error) {
    console.error('Error batch updating quest progress for all users:', error);
    res.status(500).json({ error: error.message });
  }
});

async function applyQuestRewards(hero, heroRef, quest, type, questId) {
  const heroLevel = hero.level || 1;
  const levelScaling = Math.min(1 + heroLevel / 100, 3);
  const scaledXp = Math.floor((quest.rewards.xp || 0) * levelScaling);

  const updateData = {
    gold: (hero.gold || 0) + (quest.rewards.gold || 0),
    xp: (hero.xp || 0) + scaledXp,
    tokens: (hero.tokens || 0) + (quest.rewards.tokens || 0),
    [`questProgress.${type}.${questId}.claimedAt`]: admin.firestore.FieldValue.serverTimestamp()
  };

  if (quest.rewards.materials) {
    quest.rewards.materials.forEach((mat) => {
      const path = `profession.materials.${mat.type}.${mat.rarity}`;
      const currentAmount = hero.profession?.materials?.[mat.type]?.[mat.rarity] || 0;
      updateData[path] = currentAmount + mat.amount;
    });
  }

  if (quest.rewards.items?.length) {
    const currentInventory = hero.inventory || [];
    quest.rewards.items.forEach((item) => {
      currentInventory.push({
        ...item,
        id: Date.now() + Math.random(),
        obtainedFrom: `quest_${questId}`,
        obtainedAt: Date.now()
      });
    });
    updateData.inventory = currentInventory;
  }

  const metaUpdates = buildMetaProgressUpdatesForClaim(hero, type, quest);
  Object.assign(updateData, metaUpdates);

  const [dailyQuests, weeklyQuests, monthlyQuests] = await Promise.all([
    getActiveQuests('daily'),
    getActiveQuests('weekly'),
    getActiveQuests('monthly')
  ]);
  const questDataByType = { daily: dailyQuests, weekly: weeklyQuests, monthly: monthlyQuests };

  if (type === 'daily') {
    incrementMetaQuestsByType(hero, ['weekly', 'monthly'], 'completeDailies', 1, questDataByType, updateData);
  }
  if (type === 'weekly') {
    incrementMetaQuestsByType(hero, ['monthly'], 'completeWeeklies', 1, questDataByType, updateData);
  }

  const levelUpResult = processLevelUps(hero, updateData.xp);
  if (levelUpResult.leveledUp) {
    Object.assign(updateData, levelUpResult.updates);
  }

  await heroRef.update(updateData);
  return { scaledXp, levelUpResult, questDataByType };
}

router.post('/:heroId/claim/:questId', async (req, res) => {
  try {
    const { heroId, questId } = req.params;
    const { type } = req.body;
    const prepared = await prepareHeroQuestState(heroId);
    if (!prepared) {
      return res.status(404).json({ error: 'Hero not found' });
    }

    const hero = prepared.data;
    const heroRef = prepared.ref;
    const questProgress = hero.questProgress?.[type]?.[questId];
    if (!questProgress?.completed) {
      return res.status(400).json({ error: 'Quest not completed' });
    }
    if (questProgress.claimedAt) {
      return res.status(400).json({ error: 'Quest reward already claimed' });
    }

    const questDoc = await getActiveQuests(type);
    const quest = filterQuestDocumentForHero(questDoc, hero.level || 1).quests.find((q) => q.id === questId);
    if (!quest) {
      return res.status(404).json({ error: 'Quest not found' });
    }

    const { levelUpResult } = await applyQuestRewards(hero, heroRef, quest, type, questId);

    try {
      await checkAchievements(heroId, 'questsCompleted', 1);
    } catch (error) {
      console.error('Error checking achievements after quest completion:', error);
    }

    res.json({
      success: true,
      rewards: quest.rewards,
      levelUp: levelUpResult?.leveledUp ? levelUpResult.newLevel : null
    });
  } catch (error) {
    console.error('Error claiming quest reward:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/:heroId/claim-bonus/:type', async (req, res) => {
  try {
    const { heroId, type } = req.params;
    const prepared = await prepareHeroQuestState(heroId);
    if (!prepared) {
      return res.status(404).json({ error: 'Hero not found' });
    }

    const hero = prepared.data;
    const heroRef = prepared.ref;

    if (hero.questProgress?.[`${type}BonusClaimed`]) {
      return res.status(400).json({ error: 'Bonus already claimed' });
    }

    const questDoc = await getActiveQuests(type);
    const filtered = filterQuestDocumentForHero(questDoc, hero.level || 1);
    const allCompleted = filtered.quests.every((quest) => {
      const progress = hero.questProgress?.[type]?.[quest.id];
      return progress?.completed;
    });

    if (!allCompleted) {
      return res.status(400).json({ error: 'Not all quests completed' });
    }

    const bonus = questDoc.completionBonus;
    const heroLevel = hero.level || 1;
    const levelScaling = Math.min(1 + heroLevel / 100, 3);
    const scaledBonusXp = Math.floor((bonus.xp || 0) * levelScaling);

    const updateData = {
      gold: (hero.gold || 0) + (bonus.gold || 0),
      xp: (hero.xp || 0) + scaledBonusXp,
      tokens: (hero.tokens || 0) + (bonus.tokens || 0),
      [`questProgress.${type}BonusClaimed`]: true
    };

    if (bonus.materials) {
      bonus.materials.forEach((mat) => {
        const path = `profession.materials.${mat.type}.${mat.rarity}`;
        const currentAmount = hero.profession?.materials?.[mat.type]?.[mat.rarity] || 0;
        updateData[path] = currentAmount + mat.amount;
      });
    }

    if (bonus.items?.length) {
      const currentInventory = hero.inventory || [];
      bonus.items.forEach((item) => {
        currentInventory.push({
          ...item,
          id: Date.now() + Math.random(),
          obtainedFrom: `${type}_completion_bonus`,
          obtainedAt: Date.now()
        });
      });
      updateData.inventory = currentInventory;
    }

    const levelUpResult = processLevelUps(hero, updateData.xp);
    if (levelUpResult.leveledUp) {
      Object.assign(updateData, levelUpResult.updates);
    }

    await heroRef.update(updateData);

    res.json({
      success: true,
      bonus,
      levelUp: levelUpResult?.leveledUp ? levelUpResult.newLevel : null
    });
  } catch (error) {
    console.error('Error claiming completion bonus:', error);
    res.status(500).json({ error: error.message });
  }
});

async function claimAllForHero(heroId, typeFilter) {
  const prepared = await prepareHeroQuestState(heroId);
  if (!prepared) {
    return { success: false, status: 404, error: 'Hero not found' };
  }

  const hero = prepared.data;
  const heroRef = prepared.ref;
  ensureQuestProgressShape(hero);

  const [dailyQuests, weeklyQuests, monthlyQuests] = await Promise.all([
    getActiveQuests('daily'),
    getActiveQuests('weekly'),
    getActiveQuests('monthly')
  ]);
  const questDataByType = { daily: dailyQuests, weekly: weeklyQuests, monthly: monthlyQuests };

  const typesToCheck = typeFilter ? [typeFilter] : ['daily', 'weekly', 'monthly'];
  let totalGold = 0;
  let totalXp = 0;
  let totalTokens = 0;
  const totalItems = [];
  const totalMaterials = [];
  let claimedCount = 0;
  const updates = {};

  const heroLevel = hero.level || 1;
  const levelScaling = Math.min(1 + heroLevel / 100, 3);

  for (const questType of typesToCheck) {
    const filtered = filterQuestDocumentForHero(questDataByType[questType], heroLevel);
    const typeProgress = hero.questProgress[questType] || {};

    for (const quest of filtered.quests) {
      const progress = typeProgress[quest.id];
      if (!progress?.completed || progress.claimedAt) continue;

      totalGold += quest.rewards.gold || 0;
      totalXp += Math.floor((quest.rewards.xp || 0) * levelScaling);
      totalTokens += quest.rewards.tokens || 0;
      if (quest.rewards.items) totalItems.push(...quest.rewards.items);
      if (quest.rewards.materials) totalMaterials.push(...quest.rewards.materials);

      updates[`questProgress.${questType}.${quest.id}.claimedAt`] = admin.firestore.FieldValue.serverTimestamp();
      claimedCount++;

      Object.assign(updates, buildMetaProgressUpdatesForClaim(hero, questType, quest, { skipStatsIncrement: true }));
      if (questType === 'daily') {
        incrementMetaQuestsByType(hero, ['weekly', 'monthly'], 'completeDailies', 1, questDataByType, updates);
      }
      if (questType === 'weekly') {
        incrementMetaQuestsByType(hero, ['monthly'], 'completeWeeklies', 1, questDataByType, updates);
      }
    }
  }

  if (claimedCount === 0) {
    return { success: true, claimed: 0, totalRewards: { gold: 0, xp: 0, tokens: 0, items: [] } };
  }

  updates.gold = (hero.gold || 0) + totalGold;
  updates.xp = (hero.xp || 0) + totalXp;
  updates.tokens = (hero.tokens || 0) + totalTokens;
  updates['stats.questsCompleted'] = (hero.stats?.questsCompleted || 0) + claimedCount;

  if (totalMaterials.length) {
    totalMaterials.forEach((mat) => {
      const path = `profession.materials.${mat.type}.${mat.rarity}`;
      const currentAmount = hero.profession?.materials?.[mat.type]?.[mat.rarity] || 0;
      updates[path] = currentAmount + mat.amount;
    });
  }

  if (totalItems.length) {
    const currentInventory = hero.inventory || [];
    totalItems.forEach((item) => {
      currentInventory.push({
        ...item,
        id: Date.now() + Math.random(),
        obtainedFrom: 'quest_claim_all',
        obtainedAt: Date.now()
      });
    });
    updates.inventory = currentInventory;
  }

  const levelUpResult = processLevelUps(hero, updates.xp);
  if (levelUpResult.leveledUp) {
    Object.assign(updates, levelUpResult.updates);
  }

  await heroRef.update(updates);

  try {
    await checkAchievements(heroId, 'questsCompleted', claimedCount);
  } catch (error) {
    console.error('Error checking achievements after claim-all:', error);
  }

  return {
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
  };
}

router.post('/auto-claim-all', async (req, res) => {
  try {
    const { heroId, userId } = req.body;
    let resolvedId = heroId;

    if (!resolvedId && userId) {
      const byTwitch = await resolveHeroByDocId(userId);
      if (byTwitch) {
        resolvedId = byTwitch.id;
      } else {
        const { db } = await import('../index.js');
        const snap = await db.collection('heroes').where('twitchUserId', '==', userId).limit(1).get();
        if (!snap.empty) resolvedId = snap.docs[0].id;
        else {
          const snap2 = await db.collection('heroes').where('twitchId', '==', userId).limit(1).get();
          if (!snap2.empty) resolvedId = snap2.docs[0].id;
        }
      }
    }

    if (!resolvedId) {
      return res.status(400).json({ error: 'heroId required' });
    }

    const result = await claimAllForHero(resolvedId);
    if (!result.success && result.status === 404) {
      return res.status(404).json({ error: result.error });
    }
    res.json(result);
  } catch (error) {
    console.error('Error auto-claiming quests:', error);
    res.status(500).json({ error: error.message });
  }
});

router.post('/claim-all/:heroId', async (req, res) => {
  try {
    const { heroId } = req.params;
    const { type } = req.body;
    const result = await claimAllForHero(heroId, type);
    if (!result.success && result.status === 404) {
      return res.status(404).json({ error: result.error });
    }
    res.json(result);
  } catch (error) {
    console.error('Error claiming all quests:', error);
    res.status(500).json({ error: error.message });
  }
});

export default router;
