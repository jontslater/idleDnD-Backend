/**
 * Centralized Loot Configuration
 * 
 * Design philosophy: "Idle World of Warcraft"
 * - High-tier loot (epic/legendary) must be RARE
 * - Best gear comes from hardest content (mythic raids, world bosses)
 * - Trash mobs drop commons/uncommons only
 * - Pity/bad-luck protection exists but is conservative
 */

// Rarity drop chances by content type and difficulty
export const DROP_RATES = {
  // Trash enemies (quest zones, idle farming)
  trash: {
    common: 0.70,    // 70%
    uncommon: 0.25,  // 25%
    rare: 0.05,      // 5%
    epic: 0.00,      // Never
    legendary: 0.00  // Never
  },
  
  // Elite enemies (stronger zone enemies)
  elite: {
    common: 0.50,    // 50%
    uncommon: 0.35,  // 35%
    rare: 0.14,      // 14%
    epic: 0.01,      // 1%
    legendary: 0.00  // Never
  },
  
  // Dungeon bosses
  dungeon: {
    normal: {
      common: 0.00,    // No commons from bosses
      uncommon: 0.55,  // 55%
      rare: 0.40,      // 40%
      epic: 0.05,      // 5%
      legendary: 0.00  // Never
    },
    heroic: {
      common: 0.00,
      uncommon: 0.30,  // 30%
      rare: 0.55,      // 55%
      epic: 0.14,      // 14%
      legendary: 0.01  // 1% (very rare)
    },
    mythic: {
      common: 0.00,
      uncommon: 0.00,
      rare: 0.60,      // 60%
      epic: 0.35,      // 35%
      legendary: 0.05  // 5%
    }
  },
  
  // Raid bosses
  raid: {
    normal: {
      common: 0.00,
      uncommon: 0.00,
      rare: 0.70,      // 70%
      epic: 0.28,      // 28%
      legendary: 0.02  // 2%
    },
    heroic: {
      common: 0.00,
      uncommon: 0.00,
      rare: 0.45,      // 45%
      epic: 0.50,      // 50%
      legendary: 0.05  // 5%
    },
    mythic: {
      common: 0.00,
      uncommon: 0.00,
      rare: 0.10,      // 10%
      epic: 0.75,      // 75%
      legendary: 0.15  // 15%
    }
  },
  
  // World bosses (hardest content, weekly lockout)
  worldboss: {
    common: 0.00,
    uncommon: 0.00,
    rare: 0.00,
    epic: 0.70,      // 70%
    legendary: 0.30  // 30%
  },
  
  // Unique boss legendaries (guaranteed drops from specific mythic bosses)
  bossUnique: {
    dropChance: 0.10  // 10% for the unique legendary (on top of regular loot)
  }
};

// Pity system for bad luck protection
export const PITY_CONFIG = {
  enabled: true,
  
  // Tracks by content type
  counters: {
    dungeon_heroic: {
      threshold: 15,   // After 15 heroic dungeon bosses with no epic
      guaranteedRarity: 'epic'
    },
    dungeon_mythic: {
      threshold: 8,    // After 8 mythic dungeon bosses with no legendary
      guaranteedRarity: 'legendary'
    },
    raid_heroic: {
      threshold: 10,   // After 10 heroic raid bosses with no epic
      guaranteedRarity: 'epic'
    },
    raid_mythic: {
      threshold: 6,    // After 6 mythic raid bosses with no legendary
      guaranteedRarity: 'legendary'
    },
    worldboss: {
      threshold: 3,    // After 3 world bosses with no legendary
      guaranteedRarity: 'legendary'
    }
  }
};

// Set piece drop rates (% chance item is part of a set)
export const SET_PIECE_RATES = {
  trash: 0.00,       // No sets from trash
  elite: 0.00,       // No sets from elites
  dungeon: {
    normal: 0.15,    // 15%
    heroic: 0.25,    // 25%
    mythic: 0.35     // 35%
  },
  raid: {
    normal: 0.30,    // 30%
    heroic: 0.45,    // 45%
    mythic: 0.60     // 60%
  },
  worldboss: 0.50    // 50%
};

// Stat scaling by content difficulty
export const STAT_SCALING = {
  trash: 1.0,        // Baseline
  elite: 1.15,       // 15% better
  dungeon: {
    normal: 1.25,    // 25% better
    heroic: 1.40,    // 40% better
    mythic: 1.60     // 60% better
  },
  raid: {
    normal: 1.50,    // 50% better
    heroic: 1.75,    // 75% better
    mythic: 2.00     // 100% better
  },
  worldboss: 2.25    // 125% better
};

// Rarity stat multipliers (applied on top of base stats)
export const RARITY_MULTIPLIERS = {
  common: 1.0,
  uncommon: 1.3,
  rare: 1.6,
  epic: 2.0,
  legendary: 2.5
};

// Expected drops per hour of play (for balance testing)
export const EXPECTED_KILLS_PER_HOUR = {
  trash: 120,        // Idle farming
  elite: 30,         // Active zone grinding
  dungeon_normal: 4, // Bosses per hour
  dungeon_heroic: 3,
  dungeon_mythic: 2,
  raid_normal: 2,
  raid_heroic: 1.5,
  raid_mythic: 1,
  worldboss: 0.5     // Weekly lockout, ~1 per 2 hours
};

/**
 * Calculate expected drops for a content type
 * @param {string} contentType - Type of content
 * @param {string} difficulty - Difficulty level (if applicable)
 * @param {number} hours - Hours of play
 * @returns {Object} Expected drop counts by rarity
 */
export function calculateExpectedDrops(contentType, difficulty, hours = 1) {
  let rates;
  let killsPerHour;
  
  if (contentType === 'trash') {
    rates = DROP_RATES.trash;
    killsPerHour = EXPECTED_KILLS_PER_HOUR.trash;
  } else if (contentType === 'elite') {
    rates = DROP_RATES.elite;
    killsPerHour = EXPECTED_KILLS_PER_HOUR.elite;
  } else if (contentType === 'dungeon') {
    rates = DROP_RATES.dungeon[difficulty];
    killsPerHour = EXPECTED_KILLS_PER_HOUR[`dungeon_${difficulty}`];
  } else if (contentType === 'raid') {
    rates = DROP_RATES.raid[difficulty];
    killsPerHour = EXPECTED_KILLS_PER_HOUR[`raid_${difficulty}`];
  } else if (contentType === 'worldboss') {
    rates = DROP_RATES.worldboss;
    killsPerHour = EXPECTED_KILLS_PER_HOUR.worldboss;
  }
  
  const totalKills = killsPerHour * hours;
  const expected = {};
  
  for (const [rarity, rate] of Object.entries(rates)) {
    expected[rarity] = totalKills * rate;
  }
  
  return expected;
}

/**
 * Roll for loot drop
 * @param {string} contentType - Type of content
 * @param {string} difficulty - Difficulty level (if applicable)
 * @param {number} pityCounter - Current pity counter for this content type
 * @returns {Object} { rarity: string, triggeredPity: boolean }
 */
export function rollLoot(contentType, difficulty, pityCounter = 0) {
  // Check pity first
  const pityKey = difficulty ? `${contentType}_${difficulty}` : contentType;
  const pityConfig = PITY_CONFIG.counters[pityKey];
  
  if (pityConfig && pityCounter >= pityConfig.threshold) {
    return {
      rarity: pityConfig.guaranteedRarity,
      triggeredPity: true
    };
  }
  
  // Normal roll
  let rates;
  if (contentType === 'trash') {
    rates = DROP_RATES.trash;
  } else if (contentType === 'elite') {
    rates = DROP_RATES.elite;
  } else if (contentType === 'dungeon') {
    rates = DROP_RATES.dungeon[difficulty];
  } else if (contentType === 'raid') {
    rates = DROP_RATES.raid[difficulty];
  } else if (contentType === 'worldboss') {
    rates = DROP_RATES.worldboss;
  }
  
  const roll = Math.random();
  let cumulative = 0;
  
  for (const [rarity, rate] of Object.entries(rates)) {
    cumulative += rate;
    if (roll < cumulative) {
      return { rarity, triggeredPity: false };
    }
  }
  
  // Fallback (shouldn't happen if rates sum to 1.0)
  return { rarity: 'common', triggeredPity: false };
}

// Export for backward compatibility with existing raidLoot.js
export const RAID_RARITY_CHANCES = {
  normal: {
    rare: 0.70,
    epic: 0.28,
    legendary: 0.02
  },
  heroic: {
    rare: 0.45,
    epic: 0.50,
    legendary: 0.05
  },
  mythic: {
    rare: 0.10,
    epic: 0.75,
    legendary: 0.15
  }
};
