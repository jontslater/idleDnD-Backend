/**
 * Prestige Core System
 * Prestige cores are gem-like enhancements that attach directly to equipment
 * They don't require socket slots and add stat boosts + XP/Gold bonuses
 */

export const PRESTIGE_CORE_TIERS = {
  bronze: {
    prestigeRequired: 1,
    tokenCost: 1,
    name: 'Bronze Prestige Core',
    color: '#CD7F32', // Bronze color
    statBonus: {
      attack: 5,
      defense: 3,
      hp: 15
    },
    bonus: {
      xpGain: 0.01, // +1% XP
      goldGain: 0.01 // +1% Gold
    }
  },
  silver: {
    prestigeRequired: 5,
    tokenCost: 2,
    name: 'Silver Prestige Core',
    color: '#C0C0C0', // Silver color
    statBonus: {
      attack: 10,
      defense: 6,
      hp: 30
    },
    bonus: {
      xpGain: 0.015, // +1.5% XP
      goldGain: 0.015 // +1.5% Gold
    }
  },
  gold: {
    prestigeRequired: 10,
    tokenCost: 3,
    name: 'Gold Prestige Core',
    color: '#FFD700', // Gold color
    statBonus: {
      attack: 18,
      defense: 10,
      hp: 50
    },
    bonus: {
      xpGain: 0.02, // +2% XP
      goldGain: 0.02 // +2% Gold
    }
  },
  platinum: {
    prestigeRequired: 20,
    tokenCost: 5,
    name: 'Platinum Prestige Core',
    color: '#E5E4E2', // Platinum color
    statBonus: {
      attack: 30,
      defense: 18,
      hp: 80
    },
    bonus: {
      xpGain: 0.025, // +2.5% XP
      goldGain: 0.025 // +2.5% Gold
    }
  },
  mythic: {
    prestigeRequired: 30,
    tokenCost: 10,
    name: 'Mythic Prestige Core',
    color: '#FF1493', // Deep pink / Mythic color
    statBonus: {
      attack: 50,
      defense: 30,
      hp: 120
    },
    bonus: {
      xpGain: 0.03, // +3% XP
      goldGain: 0.03 // +3% Gold
    }
  }
};

// Equipment slots that can have prestige cores (weapons and gear)
export const PRESTIGE_CORE_SLOTS = [
  'weapon', 'armor', 'accessory', 'shield', 'helm', 'cloak', 'gloves', 'ring1', 'ring2', 'boots'
];

/**
 * Get available prestige core tiers for a hero
 * @param {number} prestigeLevel - Hero's current prestige level
 * @returns {Array} Array of tier keys available
 */
export function getAvailablePrestigeCoreTiers(prestigeLevel) {
  return Object.keys(PRESTIGE_CORE_TIERS).filter(tier => 
    prestigeLevel >= PRESTIGE_CORE_TIERS[tier].prestigeRequired
  );
}

/**
 * Get prestige core tier data
 * @param {string} tier - Tier key (bronze, silver, gold, platinum, mythic)
 * @returns {Object|null} Tier data or null if invalid
 */
export function getPrestigeCoreTier(tier) {
  return PRESTIGE_CORE_TIERS[tier] || null;
}






