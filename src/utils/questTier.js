/** Level brackets — keep in sync with dynamicQuestGenerator tier labels */
export const LEVEL_BRACKETS = {
  newbie: { min: 1, max: 10, label: 'Novice' },
  intermediate: { min: 11, max: 25, label: 'Adept' },
  veteran: { min: 26, max: 40, label: 'Veteran' },
  elite: { min: 41, max: 999, label: 'Elite' }
};

export const TIER_ORDER = ['newbie', 'intermediate', 'veteran', 'elite'];

export function getTierForLevel(level = 1) {
  const lv = Math.max(1, Math.floor(level));
  if (lv <= LEVEL_BRACKETS.newbie.max) return 'newbie';
  if (lv <= LEVEL_BRACKETS.intermediate.max) return 'intermediate';
  if (lv <= LEVEL_BRACKETS.veteran.max) return 'veteran';
  return 'elite';
}

export function filterQuestsForHeroLevel(quests, heroLevel) {
  if (!Array.isArray(quests) || quests.length === 0) return [];
  const tier = getTierForLevel(heroLevel);
  const tierQuests = quests.filter((q) => q.tier === tier);
  if (tierQuests.length > 0) return tierQuests;
  // Legacy quests without tier — show all (until next regeneration)
  return quests.filter((q) => !q.tier);
}

export function filterQuestDocumentForHero(questDoc, heroLevel) {
  if (!questDoc) return questDoc;
  return {
    ...questDoc,
    quests: filterQuestsForHeroLevel(questDoc.quests || [], heroLevel)
  };
}
