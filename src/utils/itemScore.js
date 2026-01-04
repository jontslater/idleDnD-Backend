/**
 * Item Score Calculation Utility
 * 
 * Calculates item score based on role/category to ensure healers prioritize
 * healing power, tanks prioritize defense/stamina, and DPS prioritize damage.
 */

import { ROLE_CONFIG } from '../data/roleConfig.js';

/**
 * Calculate item score for a single item based on hero role
 * @param {Object} item - Item object
 * @param {string} heroRole - Hero role (e.g., 'bard', 'cleric', 'guardian')
 * @returns {number} Item score
 */
export function calculateItemScore(item, heroRole) {
  if (!item) return 0;
  
  const heroCategory = heroRole ? (ROLE_CONFIG[heroRole]?.category || 'dps') : 'dps';
  let baseScore = 0;
  
  if (heroCategory === 'healer') {
    // Healers prioritize: intellect, spellPower, healingPower, then defense/hp
    baseScore = (item.intellect || 0) * 2 +           // Intellect is primary stat
               (item.spellPower || 0) * 2.5 +         // Spell power scales healing
               (item.secondaryStats?.healingPower || 0) * 3 + // Healing power is very valuable
               (item.defense || 0) * 0.5 +            // Defense is secondary
               ((item.hp || 0) / 2) +                 // HP is secondary
               (item.attack || 0) * 0.3;              // Attack is least important
  } else if (heroCategory === 'tank') {
    // Tanks prioritize: stamina, defense, hp, then strength
    baseScore = (item.stamina || 0) * 1.5 +
               (item.defense || 0) * 1.2 +
               ((item.hp || 0) / 2) * 1.5 +
               (item.strength || 0) * 0.8 +
               (item.attack || 0) * 0.5;
  } else {
    // DPS prioritize: attack, strength/intellect, then secondary damage stats
    const primaryStat = item.strength || item.intellect || 0;
    const spellDamage = item.secondaryStats?.spellDamage || 0;
    const meleeDamage = item.secondaryStats?.meleeDamage || 0;
    
    baseScore = (item.attack || 0) * 1.5 +
               primaryStat * 1.2 +
               spellDamage * 1.5 +
               meleeDamage * 1.5 +
               (item.defense || 0) * 0.3 +
               ((item.hp || 0) / 2) * 0.5;
  }
  
  const rarityBonus = item.rarity === 'legendary' ? 1.5 : 
                      item.rarity === 'epic' ? 1.3 : 
                      item.rarity === 'rare' ? 1.1 : 1.0;
  const procBonus = (item.procEffects?.length || 0) * 50;
  
  return Math.floor((baseScore * rarityBonus) + procBonus);
}

/**
 * Calculate total item score for a hero's equipment
 * @param {Object} equipment - Hero equipment object
 * @param {string} heroRole - Hero role
 * @returns {number} Total item score
 */
export function calculateTotalItemScore(equipment, heroRole) {
  if (!equipment) return 0;
  
  let totalScore = 0;
  Object.values(equipment).forEach(item => {
    if (item) {
      totalScore += calculateItemScore(item, heroRole);
    }
  });
  
  return totalScore;
}

/**
 * Compare two items to determine which is better for a specific role
 * @param {Object} item1 - First item
 * @param {Object} item2 - Second item
 * @param {string} heroRole - Hero role
 * @returns {number} Positive if item1 is better, negative if item2 is better, 0 if equal
 */
export function compareItems(item1, item2, heroRole) {
  const score1 = calculateItemScore(item1, heroRole);
  const score2 = calculateItemScore(item2, heroRole);
  return score1 - score2;
}






