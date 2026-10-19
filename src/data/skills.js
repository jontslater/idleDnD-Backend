/**
 * Skill tree API — canonical data lives in skillDefinitions.js
 */

import {
  getCanonicalSkillList,
  getCanonicalSkillById,
  getCanonicalSkillsForClass,
  SKILL_EFFECT_TYPES,
  MAX_SKILL_RANK,
  valueAtRank
} from './skillDefinitions.js';

export { SKILL_EFFECT_TYPES, MAX_SKILL_RANK };

function withRuntimeHelpers(skill) {
  const base = skill.baseValuePerRank;
  return {
    ...skill,
    baseValue: base,
    scaling: (points) => valueAtRank(base, points)
  };
}

export function getAllSkills() {
  return getCanonicalSkillList().map(withRuntimeHelpers);
}

export function getSkillsForClass(className) {
  return getCanonicalSkillsForClass(className).map(withRuntimeHelpers);
}

export function getSkillById(skillId) {
  const skill = getCanonicalSkillById(skillId);
  return skill ? withRuntimeHelpers(skill) : undefined;
}

export function calculateSkillPoints(level) {
  if (level < 6) return 0;
  const MAX_LEVEL = 100;
  const firstSkillPointLevel = 6;
  let count = 0;
  for (let l = firstSkillPointLevel; l <= MAX_LEVEL; l += 2) {
    if (level >= l) count++;
  }
  return count;
}

export function getAvailableSkills(className, level) {
  return getSkillsForClass(className).filter((skill) => level >= skill.unlockLevel);
}

export function sumSkillRanks(skillsMap = {}) {
  return Object.values(skillsMap).reduce((sum, s) => sum + (s?.points || 0), 0);
}
