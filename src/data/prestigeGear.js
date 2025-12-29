/**
 * Prestige Gear System
 * Prestige gear is better than regular gear and has no level requirements
 */

export const PRESTIGE_GEAR_TIERS = {
  bronze: {
    prestigeRequired: 1,
    tokenCost: 1,
    statMultiplier: 1.35, // Better than Rare (1.2x), worse than Epic (1.5x)
    namePrefix: 'Bronze Prestige',
    color: '#CD7F32', // Bronze color
    bonus: {
      xpGain: 0.01, // +1% XP per piece
      goldGain: 0.01 // +1% Gold per piece
    }
  },
  silver: {
    prestigeRequired: 5,
    tokenCost: 2,
    statMultiplier: 1.75, // Better than Epic (1.5x), worse than Legendary (2.6x)
    namePrefix: 'Silver Prestige',
    color: '#C0C0C0', // Silver color
    bonus: {
      xpGain: 0.015, // +1.5% XP per piece
      goldGain: 0.015 // +1.5% Gold per piece
    }
  },
  gold: {
    prestigeRequired: 10,
    tokenCost: 3,
    statMultiplier: 2.3, // Between Epic (1.5x) and Legendary (2.6x)
    namePrefix: 'Gold Prestige',
    color: '#FFD700', // Gold color
    bonus: {
      xpGain: 0.02, // +2% XP per piece
      goldGain: 0.02 // +2% Gold per piece
    }
  },
  platinum: {
    prestigeRequired: 20,
    tokenCost: 5,
    statMultiplier: 2.9, // Slightly better than Legendary (2.6x)
    namePrefix: 'Platinum Prestige',
    color: '#E5E4E2', // Platinum color
    bonus: {
      xpGain: 0.025, // +2.5% XP per piece
      goldGain: 0.025 // +2.5% Gold per piece
    }
  },
  mythic: {
    prestigeRequired: 30,
    tokenCost: 10,
    statMultiplier: 3.5, // Matches regular Mythic (3.5x)
    namePrefix: 'Mythic Prestige',
    color: '#FF1493', // Deep pink / Mythic color
    bonus: {
      xpGain: 0.03, // +3% XP per piece
      goldGain: 0.03 // +3% Gold per piece
    }
  }
};

// All equipment slots available for prestige gear
export const PRESTIGE_GEAR_SLOTS = [
  'weapon', 'armor', 'accessory', 'shield', 'helm', 'cloak', 'gloves', 'ring1', 'ring2', 'boots'
];

/**
 * Get available prestige tiers for a hero
 * @param {number} prestigeLevel - Hero's current prestige level
 * @returns {Array} Array of tier keys available
 */
export function getAvailablePrestigeTiers(prestigeLevel) {
  return Object.keys(PRESTIGE_GEAR_TIERS).filter(tier => 
    prestigeLevel >= PRESTIGE_GEAR_TIERS[tier].prestigeRequired
  );
}

/**
 * Get prestige tier data
 * @param {string} tier - Tier key (bronze, silver, gold, platinum, mythic)
 * @returns {Object|null} Tier data or null if invalid
 */
export function getPrestigeTier(tier) {
  return PRESTIGE_GEAR_TIERS[tier] || null;
}





