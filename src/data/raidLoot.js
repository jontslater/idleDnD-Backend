// Raid Loot Tables
// Raid loot has 20-30% higher stats than world drops of the same level/rarity

const RAID_LOOT_BONUS = {
  normal: 1.20,    // 20% better than world drops
  heroic: 1.25,    // 25% better than world drops
  mythic: 1.30     // 30% better than world drops
};

// Base templates for raid gear (before multipliers)
const RAID_LOOT_TEMPLATES = {
  tank: {
    weapon: { name: 'Blessed Sword', attack: 5, defense: 3, hp: 10 },
    armor: { name: 'Consecrated Plate', attack: 0, defense: 10, hp: 35 },
    accessory: { name: 'Protector\'s Band', attack: 0, defense: 4, hp: 12 },
    shield: { name: 'Bulwark of Heroes', attack: 0, defense: 12, hp: 25 }
  },
  healer: {
    weapon: { name: 'Divine Staff', attack: 4, defense: 2, hp: 10 },
    armor: { name: 'Sanctified Robes', attack: 3, defense: 6, hp: 15 },
    accessory: { name: 'Amulet of Light', attack: 2, defense: 3, hp: 18 }
  },
  dps: {
    weapon: { name: 'Devastating Blade', attack: 10, defense: 0, hp: 0 },
    armor: { name: 'Battle Harness', attack: 6, defense: 5, hp: 12 },
    accessory: { name: 'Ring of Fury', attack: 9, defense: 1, hp: 6 }
  }
};

// Boss-specific legendary items (guaranteed from mythic bosses)
const LEGENDARY_BOSS_LOOT = {
  corrupted_temple: {
    'Priest\'s Corrupted Orb': {
      slot: 'accessory',
      forRole: 'healer',
      attack: 8,
      defense: 5,
      hp: 30,
      procEffects: [
        { name: 'Dark Healing', effect: 'healingBonus', value: 0.2, chance: 0.25, description: '25% chance: +20% healing done' },
        { name: 'Corrupt Touch', effect: 'healOnHit', value: 10, chance: 0.15, description: '15% chance: Heal 10 HP on spell cast' }
      ]
    }
  },
  bandit_stronghold: {
    'King\'s Plundered Crown': {
      slot: 'accessory',
      forRole: 'dps',
      attack: 15,
      defense: 3,
      hp: 10,
      procEffects: [
        { name: 'Royal Decree', effect: 'critChance', value: 0.2, chance: 0.3, description: '30% chance: Critical strike' },
        { name: 'Stolen Glory', effect: 'damageBonus', value: 0.15, chance: 0.2, description: '20% chance: +15% damage' }
      ]
    }
  },
  haunted_crypt: {
    'Phylactery Shard': {
      slot: 'shield',
      forRole: 'tank',
      attack: 0,
      defense: 18,
      hp: 40,
      procEffects: [
        { name: 'Undying', effect: 'healOnHit', value: 8, chance: 0.2, description: '20% chance: Heal 8 HP when hit' },
        { name: 'Spectral Protection', effect: 'damageReduction', value: 0.2, chance: 0.15, description: '15% chance: -20% damage taken' }
      ]
    }
  },
  dragons_lair: {
    'Dragon Fang Blade': {
      slot: 'weapon',
      forRole: 'dps',
      attack: 35,
      defense: 0,
      hp: 0,
      procEffects: [
        { name: 'Dragonfire', effect: 'fireProc', value: 0.3, chance: 0.25, description: '25% chance: Extra 30% fire damage' },
        { name: 'Wing Rend', effect: 'critChance', value: 0.25, chance: 0.2, description: '20% chance: Critical strike' },
        { name: 'Wyrm Fury', effect: 'damageBonus', value: 0.2, chance: 0.15, description: '15% chance: +20% damage' }
      ]
    }
  },
  demon_fortress: {
    'Demon Lord\'s Infernal Crown': {
      slot: 'armor',
      forRole: 'tank',
      attack: 0,
      defense: 25,
      hp: 80,
      procEffects: [
        { name: 'Hellfire Aura', effect: 'damageReflect', value: 0.3, chance: 0.25, description: '25% chance: Reflect 30% damage' },
        { name: 'Demonic Vigor', effect: 'healOnHit', value: 12, chance: 0.18, description: '18% chance: Heal 12 HP when hit' },
        { name: 'Infernal Shield', effect: 'damageReduction', value: 0.25, chance: 0.12, description: '12% chance: -25% damage taken' }
      ]
    }
  },
  titans_keep: {
    'Earthshaker Gauntlets': {
      slot: 'armor',
      forRole: 'tank',
      attack: 5,
      defense: 30,
      hp: 90,
      procEffects: [
        { name: 'Mountain\'s Endurance', effect: 'defenseBonus', value: 0.25, chance: 0.2, description: '20% chance: +25% defense for 5s' },
        { name: 'Stone Skin', effect: 'damageReduction', value: 0.3, chance: 0.15, description: '15% chance: -30% damage taken' },
        { name: 'Titan Strength', effect: 'counterAttack', value: 15, chance: 0.2, description: '20% chance: Counter attack for 15 damage' }
      ]
    }
  },
  shadowlands: {
    'Shadow Empress\'s Veil': {
      slot: 'armor',
      forRole: 'dps',
      attack: 18,
      defense: 12,
      hp: 30,
      procEffects: [
        { name: 'Shadowstrike', effect: 'damageBonus', value: 0.25, chance: 0.22, description: '22% chance: +25% damage' },
        { name: 'Void Walk', effect: 'hasteProc', value: 0.15, chance: 0.15, description: '15% chance: Extra attack' },
        { name: 'Darkness Falls', effect: 'critChance', value: 0.3, chance: 0.18, description: '18% chance: Critical strike' }
      ]
    }
  },
  elemental_plane: {
    'Elemental Convergence Staff': {
      slot: 'weapon',
      forRole: 'healer',
      attack: 15,
      defense: 8,
      hp: 25,
      procEffects: [
        { name: 'Elemental Mastery', effect: 'allStatsBonus', value: 0.15, chance: 0.2, description: '20% chance: +15% all stats' },
        { name: 'Fire Heart', effect: 'healingBonus', value: 0.25, chance: 0.2, description: '20% chance: +25% healing' },
        { name: 'Water\'s Blessing', effect: 'groupHealBonus', value: 15, chance: 0.15, description: '15% chance: +15 HP to group heal' },
        { name: 'Air\'s Grace', effect: 'manaRegen', value: 0.15, chance: 0.1, description: '10% chance: Restore mana' }
      ]
    }
  },
  void_citadel: {
    'Void Incarnate\'s Embrace': {
      slot: 'armor',
      forRole: 'dps',
      attack: 25,
      defense: 15,
      hp: 40,
      procEffects: [
        { name: 'Void Rend', effect: 'damageBonus', value: 0.3, chance: 0.25, description: '25% chance: +30% damage' },
        { name: 'Reality Tear', effect: 'critChance', value: 0.35, chance: 0.2, description: '20% chance: Critical strike' },
        { name: 'Consuming Dark', effect: 'lifesteal', value: 0.2, chance: 0.18, description: '18% chance: Heal for 20% damage dealt' },
        { name: 'Entropy', effect: 'executeBonus', value: 0.4, chance: 0.15, description: '15% chance: +40% vs low HP' }
      ]
    }
  },
  celestial_sanctum: {
    'Fallen Angel\'s Wings': {
      slot: 'accessory',
      forRole: 'healer',
      attack: 10,
      defense: 10,
      hp: 50,
      procEffects: [
        { name: 'Divine Judgment', effect: 'healingBonus', value: 0.3, chance: 0.25, description: '25% chance: +30% healing' },
        { name: 'Corrupted Grace', effect: 'groupHealBonus', value: 20, chance: 0.2, description: '20% chance: +20 HP to group heal' },
        { name: 'Holy Fire', effect: 'damageBonus', value: 0.2, chance: 0.15, description: '15% chance: +20% damage' },
        { name: 'Redemption', effect: 'healOnHit', value: 15, chance: 0.18, description: '18% chance: Heal 15 HP on spell cast' }
      ]
    }
  }
};

// Rarity distribution for raid loot
const RAID_RARITY_CHANCES = {
  normal: {
    rare: 0.55,
    epic: 0.35,
    legendary: 0.10
  },
  heroic: {
    rare: 0.30,
    epic: 0.50,
    legendary: 0.20
  },
  mythic: {
    epic: 0.50,
    legendary: 0.50
  }
};

// Stat multipliers for rarities (same as regular loot but applied to higher base)
const RAID_RARITY_MULTIPLIERS = {
  rare: 1.2,
  epic: 1.5,
  legendary: 2.0
};

/**
 * Generate raid loot for a specific boss
 * @param {string} raidId - The ID of the raid
 * @param {string} difficulty - 'normal', 'heroic', or 'mythic'
 * @param {string} category - 'tank', 'healer', or 'dps'
 * @param {string} slot - Equipment slot
 * @param {number} bossLevel - Level of the boss
 * @returns {object} Generated raid loot item
 */
function generateRaidLoot(raidId, difficulty, category, slot, bossLevel) {
  // Check if this boss has a legendary item
  const bossLegendary = LEGENDARY_BOSS_LOOT[raidId];
  if (bossLegendary && Math.random() < 0.15) { // 15% chance for boss legendary
    const legendaryItem = Object.entries(bossLegendary)[0];
    return {
      id: Date.now() + Math.random(),
      name: legendaryItem[0],
      ...legendaryItem[1],
      rarity: 'legendary',
      color: '#ff8000',
      level: bossLevel,
      isRaidLoot: true,
      fromRaid: raidId
    };
  }

  // Determine rarity based on difficulty
  const rarityChances = RAID_RARITY_CHANCES[difficulty];
  const rand = Math.random();
  let rarity;
  let cumulativeChance = 0;
  
  for (const [rarityName, chance] of Object.entries(rarityChances)) {
    cumulativeChance += chance;
    if (rand <= cumulativeChance) {
      rarity = rarityName;
      break;
    }
  }

  // Get template
  const template = RAID_LOOT_TEMPLATES[category][slot];
  if (!template) {
    console.error(`No raid loot template for ${category} ${slot}`);
    return null;
  }

  // Calculate stats
  const difficultyBonus = RAID_LOOT_BONUS[difficulty];
  const rarityMultiplier = RAID_RARITY_MULTIPLIERS[rarity];
  const levelMultiplier = 1 + (bossLevel * 0.1);
  const totalMultiplier = difficultyBonus * rarityMultiplier * levelMultiplier;

  const item = {
    id: Date.now() + Math.random(),
    name: `${rarity.charAt(0).toUpperCase() + rarity.slice(1)} ${template.name}`,
    slot: slot,
    rarity: rarity,
    color: rarity === 'rare' ? '#0070dd' : rarity === 'epic' ? '#a335ee' : '#ff8000',
    attack: Math.floor(template.attack * totalMultiplier),
    defense: Math.floor(template.defense * totalMultiplier),
    hp: Math.floor(template.hp * totalMultiplier),
    level: bossLevel,
    forRole: category,
    isRaidLoot: true,
    fromRaid: raidId
  };

  // Add proc effects for epic/legendary
  if (rarity === 'epic' || rarity === 'legendary') {
    const procCount = rarity === 'epic' ? 2 : 3;
    item.procEffects = generateRaidProcs(category, procCount);
  }

  return item;
}

/**
 * Generate proc effects for raid gear
 * @param {string} category - 'tank', 'healer', or 'dps'
 * @param {number} count - Number of procs to generate
 * @returns {array} Array of proc effects
 */
function generateRaidProcs(category, count) {
  const tankProcs = [
    { name: 'Raid Fortified', effect: 'defenseBonus', value: 0.15, chance: 0.2, description: '20% chance: +15% defense for 5s' },
    { name: 'Raid Thorns', effect: 'damageReflect', value: 0.25, chance: 0.22, description: '22% chance: Reflect 25% damage' },
    { name: 'Raid Enduring', effect: 'healOnHit', value: 8, chance: 0.15, description: '15% chance: Heal 8 HP when hit' },
    { name: 'Raid Bulwark', effect: 'damageReduction', value: 0.2, chance: 0.15, description: '15% chance: -20% damage taken' }
  ];
  
  const healerProcs = [
    { name: 'Raid Blessed', effect: 'healingBonus', value: 0.2, chance: 0.2, description: '20% chance: +20% healing done' },
    { name: 'Raid Rejuvenating', effect: 'healOverTime', value: 5, chance: 0.22, description: '22% chance: +5 HP regen/tick' },
    { name: 'Raid Holy', effect: 'manaRegen', value: 0.15, chance: 0.12, description: '12% chance: Restore mana' },
    { name: 'Raid Radiant', effect: 'groupHealBonus', value: 15, chance: 0.12, description: '12% chance: +15 HP to group heal' }
  ];
  
  const dpsProcs = [
    { name: 'Raid Deadly', effect: 'critChance', value: 0.2, chance: 0.25, description: '25% chance: Critical strike' },
    { name: 'Raid Vicious', effect: 'damageBonus', value: 0.18, chance: 0.2, description: '20% chance: +18% damage' },
    { name: 'Raid Swift', effect: 'hasteProc', value: 0.15, chance: 0.15, description: '15% chance: Extra attack' },
    { name: 'Raid Brutal', effect: 'executeBonus', value: 0.3, chance: 0.15, description: '15% chance: +30% vs low HP enemies' }
  ];

  const procPool = category === 'tank' ? tankProcs : 
                   category === 'healer' ? healerProcs : dpsProcs;

  const selectedProcs = [];
  const availableProcs = [...procPool];
  for (let i = 0; i < count && availableProcs.length > 0; i++) {
    const procIndex = Math.floor(Math.random() * availableProcs.length);
    selectedProcs.push(availableProcs[procIndex]);
    availableProcs.splice(procIndex, 1);
  }

  return selectedProcs;
}

/**
 * Calculate item score for raid gear (used for requirements)
 * @param {object} item - The item to calculate score for
 * @returns {number} Item score
 */
function calculateRaidItemScore(item) {
  const baseScore = (item.attack || 0) + (item.defense || 0) + ((item.hp || 0) / 2);
  const rarityBonus = item.rarity === 'legendary' ? 1.5 : item.rarity === 'epic' ? 1.3 : 1.1;
  const procBonus = (item.procEffects?.length || 0) * 50;
  return Math.floor((baseScore * rarityBonus) + procBonus);
}

export {
  RAID_LOOT_BONUS,
  RAID_LOOT_TEMPLATES,
  LEGENDARY_BOSS_LOOT,
  RAID_RARITY_CHANCES,
  generateRaidLoot,
  generateRaidProcs,
  calculateRaidItemScore
};
