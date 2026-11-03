import admin from 'firebase-admin';
import { resolveHeroByDocId } from '../utils/questHeroResolver.js';
import { filterQuestsForHeroLevel } from '../utils/questTier.js';
import { PERIOD_KEY_FIELD } from '../utils/questPeriod.js';
import { calculateTotalItemScore } from '../utils/itemScore.js';
import { getActiveQuests } from './questService.js';

function defaultQuestProgress() {
  const now = admin.firestore.Timestamp.now();
  return {
    daily: {},
    weekly: {},
    monthly: {},
    lastDailyReset: now,
    lastWeeklyReset: now,
    lastMonthlyReset: now,
    dailiesCompletedThisWeek: 0,
    dailiesCompletedThisMonth: 0,
    weekliesCompletedThisMonth: 0,
    dailyBonusClaimed: false,
    weeklyBonusClaimed: false,
    monthlyBonusClaimed: false,
    dailyPeriodKey: null,
    weeklyPeriodKey: null,
    monthlyPeriodKey: null
  };
}

function ensureQuestProgressShape(hero) {
  if (!hero.questProgress || typeof hero.questProgress !== 'object') {
    hero.questProgress = defaultQuestProgress();
  }
  for (const type of ['daily', 'weekly', 'monthly']) {
    if (!hero.questProgress[type] || typeof hero.questProgress[type] !== 'object') {
      hero.questProgress[type] = {};
    }
  }
  return hero.questProgress;
}

/**
 * Lazy reset: if hero's stored period key differs from global quest doc, clear that bucket.
 */
export function getLazyResetUpdates(hero, type, questDoc) {
  if (!questDoc?.periodKey) return null;

  ensureQuestProgressShape(hero);
  const keyField = PERIOD_KEY_FIELD[type];
  const currentKey = hero.questProgress[keyField];

  if (currentKey === questDoc.periodKey) {
    return null;
  }

  const updates = {
    [`questProgress.${type}`]: {},
    [`questProgress.${keyField}`]: questDoc.periodKey,
    [`questProgress.last${capitalize(type)}Reset`]: admin.firestore.FieldValue.serverTimestamp()
  };

  if (type === 'daily') {
    updates['questProgress.dailyBonusClaimed'] = false;
  } else if (type === 'weekly') {
    updates['questProgress.weeklyBonusClaimed'] = false;
    updates['questProgress.dailiesCompletedThisWeek'] = 0;
  } else if (type === 'monthly') {
    updates['questProgress.monthlyBonusClaimed'] = false;
    updates['questProgress.dailiesCompletedThisMonth'] = 0;
    updates['questProgress.weekliesCompletedThisMonth'] = 0;
  }

  hero.questProgress[type] = {};
  hero.questProgress[keyField] = questDoc.periodKey;
  if (type === 'daily') hero.questProgress.dailyBonusClaimed = false;
  if (type === 'weekly') {
    hero.questProgress.weeklyBonusClaimed = false;
    hero.questProgress.dailiesCompletedThisWeek = 0;
  }
  if (type === 'monthly') {
    hero.questProgress.monthlyBonusClaimed = false;
    hero.questProgress.dailiesCompletedThisMonth = 0;
    hero.questProgress.weekliesCompletedThisMonth = 0;
  }

  return updates;
}

function capitalize(str) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function syncInstantObjectiveProgress(hero, type, questData, firestoreUpdates) {
  const heroLevel = hero.level || 1;
  const itemScore = calculateTotalItemScore(hero.equipment || {}, hero.role);
  const quests = filterQuestsForHeroLevel(questData.quests || [], heroLevel);

  for (const quest of quests) {
    const objType = quest.objective?.type;
    let value = null;
    if (objType === 'reachLevel') value = heroLevel;
    if (objType === 'itemScore') value = itemScore;
    if (value === null) continue;

    if (!hero.questProgress[type][quest.id]) {
      hero.questProgress[type][quest.id] = { current: 0, completed: false, claimedAt: null };
    }
    const qp = hero.questProgress[type][quest.id];
    const next = Math.min(value, quest.objective.target);
    if (next !== qp.current) {
      qp.current = next;
      if (next >= quest.objective.target) qp.completed = true;
      firestoreUpdates[`questProgress.${type}.${quest.id}`] = qp;
    }
  }
}

/**
 * Apply batched tracking increments for one hero.
 */
export async function applyQuestTrackingForHero(heroId, rawUpdates) {
  const resolved = await resolveHeroByDocId(heroId);
  if (!resolved) {
    return { success: false, error: 'Hero not found', status: 404 };
  }

  let hero = resolved.data;
  ensureQuestProgressShape(hero);

  const [dailyQuests, weeklyQuests, monthlyQuests] = await Promise.all([
    getActiveQuests('daily'),
    getActiveQuests('weekly'),
    getActiveQuests('monthly')
  ]);

  const questDataByType = { daily: dailyQuests, weekly: weeklyQuests, monthly: monthlyQuests };
  const firestoreUpdates = {};
  let totalUpdated = 0;
  let totalCompleted = 0;
  const completedQuests = [];

  for (const type of ['daily', 'weekly', 'monthly']) {
    const lazy = getLazyResetUpdates(hero, type, questDataByType[type]);
    if (lazy) Object.assign(firestoreUpdates, lazy);
  }

  for (const update of rawUpdates) {
    const { trackingKey, type, increment = 1 } = update;
    const questData = questDataByType[type];
    if (!questData?.quests) continue;

    const matchingQuests = filterQuestsForHeroLevel(questData.quests, hero.level || 1).filter(
      (q) => q.objective.type === trackingKey
    );

    for (const quest of matchingQuests) {
      if (!hero.questProgress[type][quest.id]) {
        hero.questProgress[type][quest.id] = { current: 0, completed: false, claimedAt: null };
      }
      const qp = hero.questProgress[type][quest.id];
      const oldCurrent = qp.current;
      qp.current = Math.min(qp.current + increment, quest.objective.target);
      if (qp.current >= quest.objective.target && !qp.completed) {
        qp.completed = true;
        totalCompleted++;
        completedQuests.push({ type, questId: quest.id, questName: quest.name });
      }
      if (qp.current !== oldCurrent) {
        firestoreUpdates[`questProgress.${type}.${quest.id}`] = qp;
        totalUpdated++;
      }
    }
  }

  for (const type of ['daily', 'weekly', 'monthly']) {
    syncInstantObjectiveProgress(hero, type, questDataByType[type], firestoreUpdates);
  }

  if (Object.keys(firestoreUpdates).length > 0) {
    await resolved.ref.update(firestoreUpdates);
  }

  return {
    success: true,
    heroId,
    updated: totalUpdated,
    completed: totalCompleted > 0,
    completedQuests
  };
}

/**
 * Bump meta quest counters when a quest reward is claimed.
 */
export function buildMetaProgressUpdatesForClaim(hero, claimedType, claimedQuest) {
  ensureQuestProgressShape(hero);
  const updates = {};
  const statsCompleted = (hero.stats?.questsCompleted || 0) + 1;
  updates['stats.questsCompleted'] = statsCompleted;
  hero.stats = { ...(hero.stats || {}), questsCompleted: statsCompleted };

  const bumpMeta = (periodType, trackingKey, increment = 1) => {
    // handled via incrementMetaQuestsByType at claim sites
  };

  if (claimedType === 'daily') {
    hero.questProgress.dailiesCompletedThisWeek = (hero.questProgress.dailiesCompletedThisWeek || 0) + 1;
    hero.questProgress.dailiesCompletedThisMonth = (hero.questProgress.dailiesCompletedThisMonth || 0) + 1;
    updates['questProgress.dailiesCompletedThisWeek'] = hero.questProgress.dailiesCompletedThisWeek;
    updates['questProgress.dailiesCompletedThisMonth'] = hero.questProgress.dailiesCompletedThisMonth;
  }

  if (claimedType === 'weekly') {
    hero.questProgress.weekliesCompletedThisMonth = (hero.questProgress.weekliesCompletedThisMonth || 0) + 1;
    updates['questProgress.weekliesCompletedThisMonth'] = hero.questProgress.weekliesCompletedThisMonth;
  }

  return updates;
}

/** Increment progress for quests whose objective.type matches trackingKey on given period types */
export function incrementMetaQuestsByType(hero, periodTypes, trackingKey, increment, questDataByType, firestoreUpdates) {
  ensureQuestProgressShape(hero);
  for (const type of periodTypes) {
    const questData = questDataByType[type];
    if (!questData?.quests) continue;
    const matching = filterQuestsForHeroLevel(questData.quests, hero.level || 1).filter(
      (q) => q.objective.type === trackingKey
    );
    for (const quest of matching) {
      if (!hero.questProgress[type][quest.id]) {
        hero.questProgress[type][quest.id] = { current: 0, completed: false, claimedAt: null };
      }
      const qp = hero.questProgress[type][quest.id];
      qp.current = Math.min(qp.current + increment, quest.objective.target);
      if (qp.current >= quest.objective.target) qp.completed = true;
      firestoreUpdates[`questProgress.${type}.${quest.id}`] = qp;
    }
  }
}

export async function prepareHeroQuestState(heroId) {
  const resolved = await resolveHeroByDocId(heroId);
  if (!resolved) return null;

  let hero = resolved.data;
  ensureQuestProgressShape(hero);

  const types = ['daily', 'weekly', 'monthly'];
  const questDocs = await Promise.all(types.map((t) => getActiveQuests(t)));
  const firestoreUpdates = {};

  types.forEach((type, i) => {
    const lazy = getLazyResetUpdates(hero, type, questDocs[i]);
    if (lazy) Object.assign(firestoreUpdates, lazy);
    syncInstantObjectiveProgress(hero, type, questDocs[i], firestoreUpdates);
  });

  if (Object.keys(firestoreUpdates).length > 0) {
    await resolved.ref.update(firestoreUpdates);
  }

  return { ...resolved, data: hero };
}

export { ensureQuestProgressShape, defaultQuestProgress };
