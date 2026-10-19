/**
 * Level Up Helper
 * Handles hero level-ups with proper maxXp calculation and multiple level-up support
 * Uses polynomial maxXp formula (WoW-style) for balanced leveling progression
 */

import { calculateSkillPoints } from '../data/skills.js';
import { xpToNextLevel } from '../data/balance.js';

const MAX_HERO_LEVEL = 100;

/**
 * XP required to advance from `level` → level+1 (balance plan).
 */
export function calculateMaxXp(level) {
  const L = Math.min(99, Math.max(1, level || 1));
  const need = xpToNextLevel(L);
  return need > 0 ? need : xpToNextLevel(99);
}

/**
 * Process level-ups for a hero
 * Handles multiple level-ups if XP exceeds maxXp
 * Updates maxXp, level, stats, and returns the final state
 * 
 * @param {Object} hero - Hero object
 * @param {number} newXp - New XP value (hero.xp + gained XP)
 * @returns {Object} Update object with level, xp, maxXp, and stat changes
 */
/**
 * Idempotent skill-point grant when level increases (same Firestore write as level-up).
 * @param {Object} hero - hero before level-up
 * @param {number} newLevel - level after XP processing
 */
export function skillPointPatchForLevelUp(hero, newLevel) {
  const previousLevel = hero.level || 1;
  if (newLevel <= previousLevel) return {};

  const targetEarned = calculateSkillPoints(newLevel);
  const currentEarned =
    hero.skillPointsEarned != null
      ? hero.skillPointsEarned
      : calculateSkillPoints(previousLevel);

  if (targetEarned <= currentEarned) return {};

  const delta = targetEarned - currentEarned;
  return {
    skillPoints: (hero.skillPoints || 0) + delta,
    skillPointsEarned: targetEarned
  };
}

export function processLevelUps(hero, newXp) {
  const currentLevel = hero.level || 1;
  let currentXp = Math.max(0, newXp); // Clamp to non-negative
  let currentMaxXp = hero.maxXp || calculateMaxXp(currentLevel);
  
  // Validate maxXp to prevent infinite loop from absurd values
  if (currentMaxXp <= 0 || !isFinite(currentMaxXp) || isNaN(currentMaxXp)) {
    console.warn(`[Level Up] Invalid maxXp (${currentMaxXp}) for hero level ${currentLevel}, recalculating`);
    currentMaxXp = calculateMaxXp(currentLevel);
  }
  
  let newLevel = currentLevel;
  let totalLevelsGained = 0;
  
  const updates = {
    xp: currentXp,
    maxXp: currentMaxXp
  };
  
  // Handle multiple level-ups with safety cap
  const MAX_LEVELS_PER_UPDATE = 50; // Safety cap to prevent infinite loops
  while (
    currentXp >= currentMaxXp &&
    totalLevelsGained < MAX_LEVELS_PER_UPDATE &&
    newLevel < MAX_HERO_LEVEL
  ) {
    newLevel++;
    totalLevelsGained++;
    currentXp = currentXp - currentMaxXp;
    // Use polynomial formula for next level instead of multiplying
    currentMaxXp = calculateMaxXp(newLevel);
    
    // Additional safety check
    if (currentMaxXp <= 0 || !isFinite(currentMaxXp) || isNaN(currentMaxXp)) {
      console.error(`[Level Up] Invalid maxXp calculated for level ${newLevel}, stopping level-up`);
      break;
    }
  }
  
  // Warn if we hit the cap (likely indicates a bug)
  if (totalLevelsGained >= MAX_LEVELS_PER_UPDATE) {
    console.warn(`[Level Up] Hit max level-up cap (${MAX_LEVELS_PER_UPDATE} levels), stopping to prevent infinite loop`);
  }
  
  if (totalLevelsGained > 0) {
    updates.level = newLevel;
    updates.xp = currentXp;
    updates.maxXp = currentMaxXp;

    // Combat stats derive from level + gear (balance.js); do not increment stored atk/def/hp here.

    Object.assign(updates, skillPointPatchForLevelUp(hero, newLevel));
  }
  
  return {
    updates,
    leveledUp: totalLevelsGained > 0,
    levelsGained: totalLevelsGained,
    newLevel: totalLevelsGained > 0 ? newLevel : currentLevel
  };
}

/**
 * Initialize maxXp for a new hero
 * @param {number} level - Starting level (usually 1)
 * @returns {number} Initial maxXp
 */
export function getInitialMaxXp(level = 1) {
  return calculateMaxXp(level);
}
