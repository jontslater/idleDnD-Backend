/**
 * Prestige System Helper Functions
 * Handles prestige boost calculations and related utilities
 */

/**
 * Calculate prestige boosts based on prestige level
 * @param {number} prestigeLevel - Current prestige level (0 = never prestiged)
 * @returns {Object} Boost multipliers and stat bonuses
 */
export function calculatePrestigeBoosts(prestigeLevel) {
  if (prestigeLevel <= 0) {
    return {
      xpGain: 1.0,
      goldGain: 1.0,
      idleTicketGain: 1.0,
      statBoost: {
        attack: 0,
        defense: 0,
        hp: 0
      }
    };
  }

  let xpMultiplier = 1.0;
  let goldMultiplier = 1.0;
  let ticketMultiplier = 1.0;
  
  // Calculate multipliers with diminishing returns after prestige 10
  for (let i = 1; i <= prestigeLevel; i++) {
    const multiplier = i > 10 ? 0.5 : 1.0; // 50% effectiveness after prestige 10
    
    xpMultiplier += 0.02 * multiplier;      // +2% per prestige (1% after prestige 10)
    goldMultiplier += 0.025 * multiplier;    // +2.5% per prestige (1.25% after prestige 10)
    ticketMultiplier += 0.01 * multiplier;   // +1% per prestige (0.5% after prestige 10)
  }
  
  // Hard caps
  xpMultiplier = Math.min(xpMultiplier, 1.5);      // Max +50%
  goldMultiplier = Math.min(goldMultiplier, 1.5);   // Max +50%
  ticketMultiplier = Math.min(ticketMultiplier, 1.25); // Max +25%
  
  // Stat boosts (flat, additive)
  const statBoost = {
    attack: prestigeLevel * 2,   // +2 per prestige
    defense: prestigeLevel * 1,  // +1 per prestige
    hp: prestigeLevel * 5         // +5 per prestige
  };
  
  return {
    xpGain: xpMultiplier,
    goldGain: goldMultiplier,
    idleTicketGain: ticketMultiplier,
    statBoost
  };
}

/**
 * Get prestige tier based on prestige level
 * @param {number} prestigeLevel - Current prestige level
 * @returns {string} Tier name (bronze, silver, gold, platinum, mythic)
 */
export function getPrestigeTier(prestigeLevel) {
  if (prestigeLevel === 0) return null;
  if (prestigeLevel >= 30) return 'mythic';
  if (prestigeLevel >= 20) return 'platinum';
  if (prestigeLevel >= 10) return 'gold';
  if (prestigeLevel >= 5) return 'silver';
  return 'bronze';
}

/**
 * Calculate total stars for prestige level
 * @param {number} prestigeLevel - Current prestige level
 * @returns {number} Total stars (5 per prestige level)
 */
export function calculatePrestigeStars(prestigeLevel) {
  return prestigeLevel * 5;
}

/**
 * Get star tier based on total stars
 * @param {number} totalStars - Total prestige stars
 * @returns {string} Tier name
 */
export function getStarTier(totalStars) {
  if (totalStars >= 146) return 'mythic';      // Prestige 30+
  if (totalStars >= 96) return 'platinum';    // Prestige 20-29
  if (totalStars >= 46) return 'gold';        // Prestige 10-19
  if (totalStars >= 21) return 'silver';      // Prestige 5-9
  if (totalStars >= 1) return 'bronze';        // Prestige 1-4
  return null;
}

/**
 * Get tier color for display
 * @param {string} tier - Tier name
 * @returns {string} Hex color code
 */
export function getTierColor(tier) {
  const colors = {
    bronze: '#CD7F32',
    silver: '#C0C0C0',
    gold: '#FFD700',
    platinum: '#E5E4E2',
    mythic: '#FF1493' // Deep pink, or could use '#9D00FF' for purple
  };
  return colors[tier] || '#FFFFFF';
}





