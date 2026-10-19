/**
 * Gear Generation Service — delegates to budget-based generator (GEAR_PLAN).
 */

import { generateGearItem as generateFromBudget } from '../data/gear/generator.js';
import { roleGroupFromHero } from '../data/gear/roleGroup.js';

// Role configurations - must match game.js
const ROLE_CONFIG = {
  guardian: { baseHp: 220, baseAttack: 8, baseDefense: 18, hpPerLevel: 35, attackPerLevel: 2, defensePerLevel: 6, category: 'tank' },
  paladin: { baseHp: 200, baseAttack: 10, baseDefense: 16, hpPerLevel: 32, attackPerLevel: 3, defensePerLevel: 5, category: 'tank' },
  warden: { baseHp: 210, baseAttack: 9, baseDefense: 15, hpPerLevel: 34, attackPerLevel: 2, defensePerLevel: 5, category: 'tank' },
  bloodknight: { baseHp: 205, baseAttack: 11, baseDefense: 14, hpPerLevel: 33, attackPerLevel: 3, defensePerLevel: 4, category: 'tank' },
  vanguard: { baseHp: 190, baseAttack: 12, baseDefense: 15, hpPerLevel: 30, attackPerLevel: 3, defensePerLevel: 5, category: 'tank' },
  brewmaster: { baseHp: 215, baseAttack: 8, baseDefense: 17, hpPerLevel: 35, attackPerLevel: 2, defensePerLevel: 6, category: 'tank' },
  cleric: { baseHp: 115, baseAttack: 6, baseDefense: 9, hpPerLevel: 16, attackPerLevel: 1, defensePerLevel: 2, category: 'healer' },
  atoner: { baseHp: 110, baseAttack: 8, baseDefense: 8, hpPerLevel: 15, attackPerLevel: 2, defensePerLevel: 2, category: 'healer' },
  druid: { baseHp: 105, baseAttack: 5, baseDefense: 7, hpPerLevel: 14, attackPerLevel: 1, defensePerLevel: 1, category: 'healer' },
  lightbringer: { baseHp: 120, baseAttack: 7, baseDefense: 10, hpPerLevel: 17, attackPerLevel: 1, defensePerLevel: 3, category: 'healer' },
  shaman: { baseHp: 110, baseAttack: 6, baseDefense: 8, hpPerLevel: 15, attackPerLevel: 1, defensePerLevel: 2, category: 'healer' },
  mistweaver: { baseHp: 108, baseAttack: 7, baseDefense: 7, hpPerLevel: 14, attackPerLevel: 2, defensePerLevel: 1, category: 'healer' },
  chronomancer: { baseHp: 102, baseAttack: 5, baseDefense: 6, hpPerLevel: 13, attackPerLevel: 1, defensePerLevel: 1, category: 'healer' },
  berserker: { baseHp: 130, baseAttack: 16, baseDefense: 5, hpPerLevel: 20, attackPerLevel: 5, defensePerLevel: 1, category: 'dps' },
  crusader: { baseHp: 140, baseAttack: 15, baseDefense: 6, hpPerLevel: 22, attackPerLevel: 5, defensePerLevel: 2, category: 'dps' },
  assassin: { baseHp: 120, baseAttack: 18, baseDefense: 4, hpPerLevel: 18, attackPerLevel: 6, defensePerLevel: 1, category: 'dps' },
  reaper: { baseHp: 125, baseAttack: 16, baseDefense: 5, hpPerLevel: 19, attackPerLevel: 6, defensePerLevel: 1, category: 'dps' },
  bladedancer: { baseHp: 122, baseAttack: 17, baseDefense: 4, hpPerLevel: 19, attackPerLevel: 6, defensePerLevel: 1, category: 'dps' },
  monk: { baseHp: 128, baseAttack: 15, baseDefense: 5, hpPerLevel: 20, attackPerLevel: 5, defensePerLevel: 1, category: 'dps' },
  stormwarrior: { baseHp: 135, baseAttack: 14, baseDefense: 6, hpPerLevel: 21, attackPerLevel: 5, defensePerLevel: 1, category: 'dps' },
  hunter: { baseHp: 125, baseAttack: 16, baseDefense: 5, hpPerLevel: 19, attackPerLevel: 6, defensePerLevel: 1, category: 'dps' },
  mage: { baseHp: 120, baseAttack: 19, baseDefense: 3, hpPerLevel: 17, attackPerLevel: 6, defensePerLevel: 1, category: 'dps' },
  warlock: { baseHp: 123, baseAttack: 18, baseDefense: 4, hpPerLevel: 18, attackPerLevel: 6, defensePerLevel: 1, category: 'dps' },
  necromancer: { baseHp: 121, baseAttack: 17, baseDefense: 4, hpPerLevel: 18, attackPerLevel: 6, defensePerLevel: 1, category: 'dps' },
  ranger: { baseHp: 127, baseAttack: 17, baseDefense: 5, hpPerLevel: 19, attackPerLevel: 6, defensePerLevel: 1, category: 'dps' },
  shadowpriest: { baseHp: 125, baseAttack: 16, baseDefense: 4, hpPerLevel: 18, attackPerLevel: 6, defensePerLevel: 1, category: 'dps' },
  mooncaller: { baseHp: 122, baseAttack: 17, baseDefense: 4, hpPerLevel: 18, attackPerLevel: 6, defensePerLevel: 1, category: 'dps' },
  stormcaller: { baseHp: 125, baseAttack: 18, baseDefense: 4, hpPerLevel: 18, attackPerLevel: 6, defensePerLevel: 1, category: 'dps' },
  frostmage: { baseHp: 119, baseAttack: 19, baseDefense: 3, hpPerLevel: 17, attackPerLevel: 6, defensePerLevel: 1, category: 'dps' },
  firemage: { baseHp: 118, baseAttack: 20, baseDefense: 3, hpPerLevel: 17, attackPerLevel: 6, defensePerLevel: 1, category: 'dps' },
  dragonsorcerer: { baseHp: 117, baseAttack: 20, baseDefense: 3, hpPerLevel: 17, attackPerLevel: 6, defensePerLevel: 1, category: 'dps' }
};

// Loot rarities - must match game.js
const LOOT_RARITIES = {
  common: { color: '#9d9d9d', dropChance: 0.70, statMultiplier: 0.8 },
  uncommon: { color: '#1eff00', dropChance: 0.20, statMultiplier: 1.0 },
  rare: { color: '#0070dd', dropChance: 0.20, statMultiplier: 1.2 },
  epic: { color: '#a335ee', dropChance: 0.08, statMultiplier: 1.5 },
  legendary: { color: '#ff8000', dropChance: 0.02, statMultiplier: 2.6 }
};

// Equipment slots
const EQUIPMENT_SLOTS = ['weapon', 'armor', 'accessory', 'helm', 'cloak', 'gloves', 'ring1', 'ring2', 'boots'];
const TANK_EQUIPMENT_SLOTS = ['weapon', 'armor', 'accessory', 'shield', 'helm', 'cloak', 'gloves', 'ring1', 'ring2', 'boots'];

// Loot templates by category - must match game.js
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
 * Generate a gear item for a hero
 * @param {string} role - Hero role (e.g., 'berserker', 'guardian')
 * @param {string} slot - Equipment slot (e.g., 'weapon', 'armor', 'shield')
 * @param {string} rarity - Item rarity ('common', 'uncommon', 'rare', 'epic', 'legendary')
 * @param {number} heroLevel - Hero's current level
 * @returns {Object} Generated gear item
 */
function generateGearItem(role, slot, rarity, heroLevel = 1) {
  if (!ROLE_CONFIG[role]) {
    throw new Error(`Invalid role: ${role}`);
  }
  if (!LOOT_RARITIES[rarity] && rarity !== 'mythic') {
    throw new Error(`Invalid rarity: ${rarity}`);
  }
  const category = ROLE_CONFIG[role].category;
  const availableSlots = category === 'tank' ? TANK_EQUIPMENT_SLOTS : EQUIPMENT_SLOTS;
  if (!availableSlots.includes(slot)) {
    throw new Error(`Invalid slot ${slot} for role ${role} (category: ${category})`);
  }
  const roleGroup = roleGroupFromHero({ role, level: heroLevel });
  return generateFromBudget({
    roleGroup,
    slot,
    rarity,
    source: { type: 'idle', enemyLevel: heroLevel },
    seed: `legacy-${role}-${slot}-${Date.now()}`
  });
}

/**
 * Initialize equipment slots for a hero
 * Ensures all required slots exist (set to null if missing)
 * Similar to quest progress initialization
 * @param {Object} hero - Hero object
 * @returns {Object|null} Initialized equipment object or null if hero invalid
 */
export function initializeEquipmentSlots(hero) {
  if (!hero || !hero.role) {
    return null;
  }
  
  const category = ROLE_CONFIG[hero.role]?.category || 'dps';
  const defaultSlots = category === 'tank' ? TANK_EQUIPMENT_SLOTS : EQUIPMENT_SLOTS;
  
  const existingEquipment = hero.equipment || {};
  const initializedEquipment = {};
  
  // Initialize all slots, preserving existing items
  defaultSlots.forEach(slot => {
    initializedEquipment[slot] = existingEquipment[slot] !== undefined ? existingEquipment[slot] : null;
  });
  
  return initializedEquipment;
}

export {
  generateGearItem,
  ROLE_CONFIG,
  LOOT_RARITIES,
  EQUIPMENT_SLOTS,
  TANK_EQUIPMENT_SLOTS
};
