import { db } from '../index.js';

// Calculate guild perks based on guild level
export function calculateGuildPerks(guildLevel) {
  const perks = {
    craftingBonus: 0,
    gatherBonus: 0,
    combatBonus: 0,
    xpBonus: 0,
    goldBonus: 0
  };
  
  // Perks scale with guild level (1% per level, capped at 20%)
  const bonusPercent = Math.min(guildLevel * 0.01, 0.20);
  
  perks.craftingBonus = bonusPercent;
  perks.gatherBonus = bonusPercent;
  perks.combatBonus = bonusPercent * 0.5; // Combat bonus is half (10% max)
  perks.xpBonus = bonusPercent * 0.5; // XP bonus is half (10% max)
  perks.goldBonus = bonusPercent * 0.5; // Gold bonus is half (10% max)
  
  return perks;
}

// Get guild perks for a hero
export async function getGuildPerksForHero(userId) {
  try {
    // Find hero's guild
    const guildSnapshot = await db.collection('guilds')
      .where('memberIds', 'array-contains', userId)
      .limit(1)
      .get();
    
    if (guildSnapshot.empty) {
      return null; // No guild perks
    }
    
    const guild = guildSnapshot.docs[0].data();
    const guildLevel = guild.level || 1;
    
    return calculateGuildPerks(guildLevel);
  } catch (error) {
    console.error('Error getting guild perks:', error);
    return null;
  }
}

// Apply guild perks to combat stats
export function applyGuildPerksToStats(baseStats, guildPerks) {
  if (!guildPerks) return baseStats;
  
  const modifiedStats = { ...baseStats };
  
  // Apply combat bonus (affects attack/defense)
  if (guildPerks.combatBonus > 0) {
    modifiedStats.attack = Math.floor(modifiedStats.attack * (1 + guildPerks.combatBonus));
    modifiedStats.defense = Math.floor(modifiedStats.defense * (1 + guildPerks.combatBonus));
  }
  
  return modifiedStats;
}
