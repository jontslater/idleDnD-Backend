/**
 * Prestige Gear Generator
 * Generates prestige gear items with appropriate stats
 */

import { PRESTIGE_GEAR_TIERS } from '../data/prestigeGear.js';
import { ROLE_CONFIG } from '../data/roleConfig.js';

// Equipment slot templates (same as regular gear)
const LOOT_TEMPLATES_BY_CATEGORY = {
  tank: {
    weapon: { name: 'Sword', attack: 3, defense: 2, hp: 6 },
    armor: { name: 'Plate Armor', attack: 0, defense: 7, hp: 24 },
    accessory: { name: 'Trinket', attack: 0, defense: 3, hp: 9 },
    shield: { name: 'Shield', attack: 0, defense: 9, hp: 18 },
    helm: { name: 'Helm', attack: 0, defense: 5, hp: 15 },
    cloak: { name: 'Cloak', attack: 0, defense: 4, hp: 12 },
    gloves: { name: 'Gauntlets', attack: 2, defense: 3, hp: 9 },
    ring1: { name: 'Ring', attack: 0, defense: 2, hp: 6 },
    ring2: { name: 'Ring', attack: 0, defense: 2, hp: 6 },
    boots: { name: 'Boots', attack: 0, defense: 3, hp: 9 }
  },
  healer: {
    weapon: { name: 'Staff', attack: 2, defense: 1, hp: 6 },
    armor: { name: 'Cloth Robes', attack: 1, defense: 3, hp: 9 },
    accessory: { name: 'Talisman', attack: 1, defense: 2, hp: 12 },
    helm: { name: 'Hood', attack: 1, defense: 2, hp: 6 },
    cloak: { name: 'Mantle', attack: 1, defense: 2, hp: 6 },
    gloves: { name: 'Gloves', attack: 1, defense: 1, hp: 6 },
    ring1: { name: 'Ring', attack: 1, defense: 1, hp: 3 },
    ring2: { name: 'Ring', attack: 1, defense: 1, hp: 3 },
    boots: { name: 'Sandals', attack: 0, defense: 1, hp: 6 }
  },
  dps: {
    weapon: { name: 'Weapon', attack: 7, defense: 0, hp: 0 },
    armor: { name: 'Armor', attack: 3, defense: 2, hp: 6 },
    accessory: { name: 'Amulet', attack: 5, defense: 1, hp: 3 },
    helm: { name: 'Helmet', attack: 2, defense: 1, hp: 3 },
    cloak: { name: 'Cloak', attack: 2, defense: 1, hp: 3 },
    gloves: { name: 'Gloves', attack: 3, defense: 0, hp: 3 },
    ring1: { name: 'Ring', attack: 3, defense: 0, hp: 0 },
    ring2: { name: 'Ring', attack: 3, defense: 0, hp: 0 },
    boots: { name: 'Boots', attack: 2, defense: 1, hp: 3 }
  }
};

/**
 * Generate prestige gear item
 * @param {string} role - Hero role
 * @param {string} slot - Equipment slot
 * @param {string} tier - Prestige tier (bronze, silver, gold, platinum, mythic)
 * @param {number} heroLevel - Hero's current level (for scaling)
 * @returns {Object} Generated prestige gear item
 */
export function generatePrestigeGear(role, slot, tier, heroLevel = 1) {
  const tierData = PRESTIGE_GEAR_TIERS[tier];
  if (!tierData) {
    throw new Error(`Invalid prestige tier: ${tier}`);
  }

  const roleConfig = ROLE_CONFIG[role];
  if (!roleConfig) {
    throw new Error(`Invalid role: ${role}`);
  }

  const category = roleConfig.category;
  const templates = LOOT_TEMPLATES_BY_CATEGORY[category];
  if (!templates || !templates[slot]) {
    throw new Error(`Invalid slot ${slot} for category ${category}`);
  }

  const template = templates[slot];
  
  // Prestige gear scales with current hero level (no level requirement to equip)
  const levelMultiplier = 1 + (heroLevel * 0.08); // 8% per level (same as regular gear)
  
  // Apply tier multiplier (prestige gear is better than regular gear)
  const totalMultiplier = levelMultiplier * tierData.statMultiplier;

  // Generate base stats
  const item = {
    id: `prestige_${tier}_${slot}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: `${tierData.namePrefix} ${template.name}`,
    slot: slot,
    rarity: 'prestige', // Special rarity for prestige gear
    color: tierData.color,
    attack: Math.floor(template.attack * totalMultiplier),
    defense: Math.floor(template.defense * totalMultiplier),
    hp: Math.floor(template.hp * totalMultiplier),
    level: heroLevel, // Current level for reference (but no requirement)
    forRole: role,
    prestigeTier: tier,
    isPrestigeGear: true
  };

  // Add primary stats based on category
  const primaryStatBase = Math.floor(2 + (tierData.statMultiplier * Math.min(levelMultiplier, 3)));
  
  if (category === 'healer') {
    item.intellect = primaryStatBase;
    item.spellPower = Math.floor(primaryStatBase * 1.2);
  } else if (category === 'tank') {
    item.strength = Math.floor(primaryStatBase * 0.7);
    item.stamina = Math.floor(primaryStatBase * 1.3);
  } else { // DPS
    const isMeleeRole = ['berserker', 'crusader', 'assassin', 'reaper', 'bladedancer', 'monk', 'stormwarrior', 'hunter'].includes(role);
    if (isMeleeRole) {
      item.strength = primaryStatBase;
      item.dexterity = Math.floor(primaryStatBase * 0.5);
    } else {
      item.intellect = primaryStatBase;
      item.wisdom = Math.floor(primaryStatBase * 0.5);
      item.spellPower = Math.floor(primaryStatBase * 1.2);
    }
  }

  // Add secondary stats (prestige gear always has secondary stats)
  item.secondaryStats = {};
  const secondaryBase = tierData.statMultiplier * Math.min(levelMultiplier, 3);
  
  if (category === 'healer') {
    item.secondaryStats.healingPower = Math.min(Math.floor(3 + (secondaryBase * 2)), 30);
    item.secondaryStats.hpRegen = Math.min(Math.floor(2 + secondaryBase), 15);
  } else if (category === 'tank') {
    item.secondaryStats.hpRegen = Math.min(Math.floor(2 + (secondaryBase * 1.5)), 20);
    item.secondaryStats.damageReduction = Math.min(Math.floor(1 + secondaryBase), 15);
  } else { // DPS
    item.secondaryStats.critChance = Math.min(Math.floor(1 + (secondaryBase * 0.5)), 10);
    item.secondaryStats.critDamage = Math.min(Math.floor(5 + (secondaryBase * 2)), 50);
  }

  // Add prestige-specific bonuses (XP/Gold gain per piece)
  item.prestigeBonus = {
    xpGain: tierData.bonus.xpGain,
    goldGain: tierData.bonus.goldGain
  };

  return item;
}






