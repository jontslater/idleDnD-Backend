/**
 * Level Up Helper
 * Handles hero level-ups with proper maxXp calculation and multiple level-up support
 * Uses polynomial maxXp formula (WoW-style) for balanced leveling progression
 */

import { ROLE_CONFIG } from '../data/roleConfig.js';

/**
 * Calculate maxXp for a given level
 * Uses polynomial growth (WoW-style) instead of exponential for better balance
 * Tuned for 5-15 minutes per level (idle game pacing)
 * @param {number} level - Hero level
 * @returns {number} Max XP required for that level
 */
export function calculateMaxXp(level) {
  if (level <= 1) return 100;
  
  // Polynomial growth: 40 * level² + 300 * level - 240
  // Level 1: 100 XP
  // Level 10: ~4,060 XP
  // Level 50: ~102,760 XP
  // Level 100: ~403,760 XP
  // Level 177: ~1,265,000 XP
  // This creates predictable, reasonable leveling times
  return Math.floor(40 * level * level + 300 * level - 240);
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
export function processLevelUps(hero, newXp) {
  const currentLevel = hero.level || 1;
  let currentXp = newXp;
  let currentMaxXp = hero.maxXp || calculateMaxXp(currentLevel);
  let newLevel = currentLevel;
  let totalLevelsGained = 0;
  
  const updates = {
    xp: currentXp,
    maxXp: currentMaxXp
  };
  
  // Handle multiple level-ups
  while (currentXp >= currentMaxXp) {
    newLevel++;
    totalLevelsGained++;
    currentXp = currentXp - currentMaxXp;
    // Use polynomial formula for next level instead of multiplying
    currentMaxXp = calculateMaxXp(newLevel);
  }
  
  if (totalLevelsGained > 0) {
    updates.level = newLevel;
    updates.xp = currentXp;
    updates.maxXp = currentMaxXp;
    
    // Update stats on level-up (accumulate for all levels gained)
    const roleConfig = ROLE_CONFIG[hero.role];
    if (roleConfig) {
      const currentMaxHp = hero.maxHp || 100;
      const currentAttack = hero.attack || 10;
      const currentDefense = hero.defense || 5;
      
      // Calculate HP ratio to maintain after level-up
      const hpRatio = (hero.hp || currentMaxHp) / currentMaxHp;
      
      // Add stats for each level gained
      updates.maxHp = currentMaxHp + (roleConfig.hpPerLevel * totalLevelsGained);
      updates.attack = currentAttack + (roleConfig.attackPerLevel * totalLevelsGained);
      updates.defense = currentDefense + (roleConfig.defensePerLevel * totalLevelsGained);
      
      // Maintain HP ratio (heal proportionally)
      updates.hp = Math.floor(updates.maxHp * hpRatio);
    }
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
