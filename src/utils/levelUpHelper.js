/**
 * Level Up Helper
 * Handles hero level-ups with proper maxXp calculation and multiple level-up support
 * Matches Electron app logic: maxXp = Math.floor(maxXp * 1.5) on each level-up
 */

import { ROLE_CONFIG } from '../data/roleConfig.js';

/**
 * Calculate maxXp for a given level
 * Uses the same formula as Electron app: starts at 100, multiplies by 1.5 each level
 * @param {number} level - Hero level
 * @returns {number} Max XP required for that level
 */
export function calculateMaxXp(level) {
  if (level <= 1) return 100;
  
  // Calculate: 100 * (1.5 ^ (level - 1))
  // Level 1: 100
  // Level 2: 100 * 1.5 = 150
  // Level 3: 150 * 1.5 = 225
  // etc.
  return Math.floor(100 * Math.pow(1.5, level - 1));
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
  
  // Handle multiple level-ups (matches Electron app logic)
  while (currentXp >= currentMaxXp) {
    newLevel++;
    totalLevelsGained++;
    currentXp = currentXp - currentMaxXp;
    currentMaxXp = Math.floor(currentMaxXp * 1.5); // Multiply by 1.5 each level (Electron app formula)
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
