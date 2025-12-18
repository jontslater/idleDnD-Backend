/**
 * XP Distribution Service
 * Handles level-based XP distribution when enemies are killed in battlefields
 * 
 * Features:
 * - Splits XP among all heroes in battlefield
 * - Applies level-based penalties (overleveled heroes get less XP)
 * - Applies party level difference penalties
 * - Supports XP buffs (rested XP, XP boost items)
 * - Ensures minimum XP per kill
 */

import admin from 'firebase-admin';
import { db } from '../index.js';
import { processLevelUps } from '../utils/levelUpHelper.js';

/**
 * Configuration for XP distribution
 */
const XP_CONFIG = {
  // Level difference thresholds
  OVERLEVEL_THRESHOLD: 10,        // Hero must be this many levels above enemy to get penalty
  OVERLEVEL_PENALTY_PER_LEVEL: 0.05, // 5% reduction per level above threshold (for low levels)
  
  // Party level difference thresholds
  PARTY_LEVEL_DIFF_THRESHOLD: 20,  // Hero must be this many levels different from party avg
  PARTY_PENALTY_PER_LEVEL: 0.02,    // 2% reduction per level difference above threshold
  
  // Minimum XP guarantees (scaled for high-level players)
  MIN_XP_PER_KILL: 1,              // Minimum XP any hero can get from a kill
  MIN_XP_PERCENT_BASE: 0.1,        // Base minimum 10% of base split XP
  MIN_XP_PERCENT_MAX: 0.3,         // Maximum 30% minimum for very high-level players
  MIN_XP_SCALING_LEVEL: 1000,       // Start scaling minimum at level 1000
  
  // XP buff multipliers (applied after penalties)
  RESTED_XP_MULTIPLIER: 1.5,       // +50% XP when actively chatting
  XP_BOOST_MULTIPLIER: 1.5,        // +50% XP from shop/crafted items
};

/**
 * Calculate level-based XP multiplier for a hero
 * Uses logarithmic scaling for high-level players to prevent excessive penalties
 * 
 * @param {Object} hero - Hero object with level property
 * @param {number} enemyLevel - Enemy level (or average enemy level)
 * @param {number} avgPartyLevel - Average level of all heroes in battlefield
 * @returns {number} Multiplier (0.0 to 1.0+)
 */
function calculateLevelMultiplier(hero, enemyLevel, avgPartyLevel) {
  const heroLevel = hero.level || 1;
  
  // 1. Overlevel penalty: If hero is much higher level than enemy
  let overlevelPenalty = 1.0;
  const levelDiff = heroLevel - enemyLevel;
  
  if (levelDiff > XP_CONFIG.OVERLEVEL_THRESHOLD) {
    const overLevel = levelDiff - XP_CONFIG.OVERLEVEL_THRESHOLD;
    
    // Use logarithmic scaling for high-level players (gentler penalty curve)
    // For small differences: linear penalty (5% per level)
    // For large differences: logarithmic (scales much slower)
    let penalty;
    if (overLevel <= 100) {
      // Small differences: linear penalty (original behavior)
      penalty = overLevel * XP_CONFIG.OVERLEVEL_PENALTY_PER_LEVEL;
    } else if (overLevel <= 1000) {
      // Medium differences: logarithmic scaling
      // log10(overLevel) gives us a gentler curve
      // Example: 100 levels = 2.0, 1000 levels = 3.0
      const logFactor = Math.log10(overLevel);
      penalty = 5.0 + (logFactor - 2.0) * 15.0; // Scale from 5% to ~50% over 100-1000 range
    } else {
      // Very large differences: even gentler logarithmic scaling
      // Example: 5000 levels = 3.7, caps around 60-70%
      const logFactor = Math.log10(overLevel);
      penalty = 50.0 + (logFactor - 3.0) * 10.0; // Scale from 50% to ~70% over 1000+ range
      penalty = Math.min(penalty, 75.0); // Cap at 75% reduction
    }
    
    // Calculate minimum XP percent based on hero level (higher level = higher minimum)
    const minPercent = heroLevel >= XP_CONFIG.MIN_XP_SCALING_LEVEL
      ? Math.min(
          XP_CONFIG.MIN_XP_PERCENT_MAX,
          XP_CONFIG.MIN_XP_PERCENT_BASE + ((heroLevel - XP_CONFIG.MIN_XP_SCALING_LEVEL) / 10000) * 0.2
        )
      : XP_CONFIG.MIN_XP_PERCENT_BASE;
    
    overlevelPenalty = Math.max(minPercent, 1.0 - (penalty / 100));
  }
  
  // 2. Party level difference penalty: If hero is much different from party average
  let partyPenalty = 1.0;
  const partyLevelDiff = Math.abs(heroLevel - avgPartyLevel);
  
  if (partyLevelDiff > XP_CONFIG.PARTY_LEVEL_DIFF_THRESHOLD) {
    const diff = partyLevelDiff - XP_CONFIG.PARTY_LEVEL_DIFF_THRESHOLD;
    
    // Use logarithmic scaling for party penalty too (gentler at high differences)
    let penalty;
    if (diff <= 50) {
      penalty = diff * XP_CONFIG.PARTY_PENALTY_PER_LEVEL;
    } else {
      // Logarithmic scaling for large party differences
      const logFactor = Math.log10(diff);
      penalty = 1.0 + (logFactor - 1.7) * 5.0; // Scale gently
      penalty = Math.min(penalty, 40.0); // Cap at 40% reduction
    }
    
    partyPenalty = Math.max(0.6, 1.0 - (penalty / 100)); // Minimum 60% (was 50%)
  }
  
  // Combine penalties (multiplicative)
  return overlevelPenalty * partyPenalty;
}

/**
 * Get XP buff multiplier for a hero
 * @param {Object} hero - Hero object
 * @returns {number} Total XP buff multiplier
 */
function getXPBuffMultiplier(hero) {
  let multiplier = 1.0;
  
  // Check for rested XP (active chat participation)
  // This would be determined by checking if hero has active chat activity
  // For now, we'll check a flag or calculate based on recent activity
  if (hero.hasRestedXP || hero.chatActive) {
    multiplier *= XP_CONFIG.RESTED_XP_MULTIPLIER;
  }
  
  // Check for XP boost buffs (shop items, crafted elixirs)
  if (hero.buffs && Array.isArray(hero.buffs)) {
    const xpBuffs = hero.buffs.filter(buff => 
      buff.xpMultiplier && buff.expiresAt && Date.now() < buff.expiresAt
    );
    
    if (xpBuffs.length > 0) {
      // Use the highest XP multiplier (they don't stack)
      const maxXpMultiplier = Math.max(...xpBuffs.map(b => b.xpMultiplier || 1));
      multiplier *= maxXpMultiplier;
    }
  }
  
  // Check for guild perks (XP bonus)
  if (hero.guildPerks && hero.guildPerks.xpBonus) {
    multiplier *= (1 + hero.guildPerks.xpBonus / 100); // Convert percentage to multiplier
  }
  
  return multiplier;
}

/**
 * Calculate XP distribution for all heroes when an enemy is killed
 * @param {number} baseXP - Base XP from enemy template
 * @param {number} enemyLevel - Enemy level (or average enemy level for packs)
 * @param {Array} heroes - Array of hero objects in the battlefield
 * @returns {Array} Array of {heroId, heroLevel, xpGained, multiplier, buffMultiplier} objects
 */
export function calculateXPDistribution(baseXP, enemyLevel, heroes) {
  if (!heroes || heroes.length === 0) {
    return [];
  }
  
  // Calculate average party level
  const avgPartyLevel = heroes.reduce((sum, hero) => sum + (hero.level || 1), 0) / heroes.length;
  
  // Step 1: Split base XP equally among all heroes
  const baseXPSplit = Math.floor(baseXP / heroes.length);
  
  // Step 2: Calculate level-based multipliers and XP for each hero
  const distribution = heroes.map(hero => {
    const levelMultiplier = calculateLevelMultiplier(hero, enemyLevel, avgPartyLevel);
    const buffMultiplier = getXPBuffMultiplier(hero);
    
    // Calculate base XP with level penalty
    let xpGained = Math.floor(baseXPSplit * levelMultiplier);
    
    // Apply XP buffs
    xpGained = Math.floor(xpGained * buffMultiplier);
    
    // Ensure minimum XP (scaled for high-level players)
    const heroLevel = hero.level || 1;
    const minPercent = heroLevel >= XP_CONFIG.MIN_XP_SCALING_LEVEL
      ? Math.min(
          XP_CONFIG.MIN_XP_PERCENT_MAX,
          XP_CONFIG.MIN_XP_PERCENT_BASE + ((heroLevel - XP_CONFIG.MIN_XP_SCALING_LEVEL) / 10000) * 0.2
        )
      : XP_CONFIG.MIN_XP_PERCENT_BASE;
    
    const minXP = Math.max(
      XP_CONFIG.MIN_XP_PER_KILL,
      Math.floor(baseXPSplit * minPercent)
    );
    xpGained = Math.max(minXP, xpGained);
    
    return {
      heroId: hero.id,
      heroLevel: hero.level || 1,
      xpGained,
      levelMultiplier: levelMultiplier.toFixed(2),
      buffMultiplier: buffMultiplier.toFixed(2),
      totalMultiplier: (levelMultiplier * buffMultiplier).toFixed(2)
    };
  });
  
  return distribution;
}

/**
 * Award XP to heroes in a battlefield when enemies are killed (batch support)
 * This is the main function to call from combat handlers
 * 
 * @param {string} battlefieldId - Battlefield ID
 * @param {number|Array} baseXP - Base XP from enemy template(s) - can be single value or array for batch
 * @param {number|Array} enemyLevel - Enemy level(s) - can be single value or array for batch
 * @param {Object} options - Additional options
 * @param {string|Array} options.enemyName - Enemy name(s) (for logging)
 * @param {Array} options.specificHeroIds - Optional: Only award to these hero IDs (for targeted kills)
 * @returns {Promise<Object>} Result object with distribution details
 */
export async function awardCombatXP(battlefieldId, baseXP, enemyLevel, options = {}) {
  const { enemyName = 'Unknown', specificHeroIds = null } = options;
  
  // Support batch processing: if arrays are provided, process all enemies at once
  const isBatch = Array.isArray(baseXP) || Array.isArray(enemyLevel);
  
  if (isBatch) {
    return await awardCombatXPBatch(battlefieldId, baseXP, enemyLevel, options);
  }
  
  // Single enemy kill (original logic)
  
  try {
    // Get all heroes in the battlefield
    let heroesSnapshot;
    if (specificHeroIds && Array.isArray(specificHeroIds) && specificHeroIds.length > 0) {
      // Award only to specific heroes (e.g., for targeted kills)
      heroesSnapshot = await db.collection('heroes')
        .where('currentBattlefieldId', '==', battlefieldId)
        .where(admin.firestore.FieldPath.documentId(), 'in', specificHeroIds)
        .get();
    } else {
      // Award to all heroes in battlefield
      heroesSnapshot = await db.collection('heroes')
        .where('currentBattlefieldId', '==', battlefieldId)
        .get();
    }
    
    if (heroesSnapshot.empty) {
      console.log(`[XP Distribution] No heroes found in battlefield ${battlefieldId}`);
      return {
        success: false,
        message: 'No heroes in battlefield',
        distribution: []
      };
    }
    
    const heroes = heroesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
    
    // Calculate XP distribution
    const distribution = calculateXPDistribution(baseXP, enemyLevel, heroes);
    
    // Update heroes in Firestore
    const batch = db.batch();
    const levelUpResults = [];
    const updates = [];
    
    // Track stream stats per twitchId (batch these updates too)
    const streamStatsUpdates = new Map(); // twitchId -> { xpGained, levelUps }
    
    for (const dist of distribution) {
      const heroDoc = heroesSnapshot.docs.find(doc => doc.id === dist.heroId);
      if (!heroDoc) continue;
      
      const hero = heroDoc.data();
      const newXp = (hero.xp || 0) + dist.xpGained;
      
      // Process level-ups
      const levelUpResult = processLevelUps(hero, newXp);
      
      // Prepare update
      const heroRef = db.collection('heroes').doc(dist.heroId);
      const updateData = {
        xp: levelUpResult.updates.xp,
        ...levelUpResult.updates
      };
      
      batch.update(heroRef, updateData);
      
      updates.push({
        heroId: dist.heroId,
        heroName: hero.name || 'Unknown',
        heroLevel: dist.heroLevel,
        xpGained: dist.xpGained,
        newLevel: levelUpResult.newLevel,
        leveledUp: levelUpResult.leveledUp,
        levelsGained: levelUpResult.levelsGained || 0
      });
      
      if (levelUpResult.leveledUp) {
        levelUpResults.push({
          heroId: dist.heroId,
          heroName: hero.name || 'Unknown',
          oldLevel: hero.level || 1,
          newLevel: levelUpResult.newLevel,
          levelsGained: levelUpResult.levelsGained
        });
      }
      
      // Accumulate stream stats (batch update later)
      const twitchId = hero.twitchUserId || hero.twitchId;
      if (twitchId) {
        if (!streamStatsUpdates.has(twitchId)) {
          streamStatsUpdates.set(twitchId, { xpGained: 0, levelUps: 0 });
        }
        const stats = streamStatsUpdates.get(twitchId);
        stats.xpGained += dist.xpGained;
        if (levelUpResult.leveledUp) {
          stats.levelUps += levelUpResult.levelsGained || 1;
        }
      }
    }
    
    // Commit all hero updates in one batch
    await batch.commit();
    
    // Batch update stream stats (one write per unique twitchId instead of per hero)
    const streamStatsBatch = db.batch();
    for (const [twitchId, stats] of streamStatsUpdates.entries()) {
      if (stats.xpGained > 0 || stats.levelUps > 0) {
        const statsRef = db.collection('streamStats').doc(twitchId);
        const updateData = {
          twitchId,
          lastUpdateTime: admin.firestore.FieldValue.serverTimestamp()
        };
        
        if (stats.xpGained > 0) {
          updateData.totalXpGained = admin.firestore.FieldValue.increment(stats.xpGained);
        }
        
        if (stats.levelUps > 0) {
          updateData.heroesLeveledUp = admin.firestore.FieldValue.increment(stats.levelUps);
        }
        
        streamStatsBatch.set(statsRef, updateData, { merge: true });
      }
    }
    
    // Commit stream stats batch (if any)
    if (streamStatsUpdates.size > 0) {
      await streamStatsBatch.commit();
    }
    
    // Log results
    const totalXPGiven = distribution.reduce((sum, d) => sum + d.xpGained, 0);
    const levelUps = levelUpResults.length;
    
    console.log(`[XP Distribution] Enemy "${enemyName}" (L${enemyLevel}) killed in battlefield ${battlefieldId}`);
    console.log(`   Base XP: ${baseXP}, Heroes: ${heroes.length}, Total XP Given: ${totalXPGiven}`);
    console.log(`   Level-ups: ${levelUps}`);
    
    if (levelUps > 0) {
      levelUpResults.forEach(result => {
        console.log(`   🎉 ${result.heroName} leveled up: ${result.oldLevel} → ${result.newLevel} (+${result.levelsGained})`);
      });
    }
    
    return {
      success: true,
      battlefieldId,
      enemyName,
      enemyLevel,
      baseXP,
      heroesCount: heroes.length,
      totalXPGiven,
      levelUps,
      distribution: updates,
      levelUpResults
    };
    
  } catch (error) {
    console.error(`[XP Distribution] Error awarding XP for battlefield ${battlefieldId}:`, error);
    return {
      success: false,
      error: error.message,
      distribution: []
    };
  }
}

/**
 * Award XP for multiple enemies killed in a batch
 * Processes all enemies together and distributes total XP in a single operation
 * 
 * @param {string} battlefieldId - Battlefield ID
 * @param {Array|number} baseXP - Array of base XP values or single number
 * @param {Array|number} enemyLevel - Array of enemy levels or single number
 * @param {Object} options - Additional options
 * @returns {Promise<Object>} Result object with batch distribution details
 */
async function awardCombatXPBatch(battlefieldId, baseXP, enemyLevel, options = {}) {
  const { enemyName = 'Unknown', specificHeroIds = null } = options;
  
  try {
    // Normalize to arrays
  const baseXPArray = Array.isArray(baseXP) ? baseXP : [baseXP];
  const enemyLevelArray = Array.isArray(enemyLevel) ? enemyLevel : [enemyLevel];
  const enemyNameArray = Array.isArray(enemyName) ? enemyName : 
    (baseXPArray.length > 1 ? baseXPArray.map((_, i) => `${enemyName} ${i + 1}`) : [enemyName]);
  
  // Ensure arrays are same length
  const maxLength = Math.max(baseXPArray.length, enemyLevelArray.length);
  const normalizedBaseXP = baseXPArray.length === 1 ? Array(maxLength).fill(baseXPArray[0]) : baseXPArray;
  const normalizedEnemyLevel = enemyLevelArray.length === 1 ? Array(maxLength).fill(enemyLevelArray[0]) : enemyLevelArray;
  const normalizedEnemyName = enemyNameArray.length === maxLength ? enemyNameArray : 
    Array(maxLength).fill(enemyNameArray[0] || 'Unknown');
  
  // Get all heroes in the battlefield
  let heroesSnapshot;
  if (specificHeroIds && Array.isArray(specificHeroIds) && specificHeroIds.length > 0) {
    heroesSnapshot = await db.collection('heroes')
      .where('currentBattlefieldId', '==', battlefieldId)
      .where(admin.firestore.FieldPath.documentId(), 'in', specificHeroIds)
      .get();
  } else {
    heroesSnapshot = await db.collection('heroes')
      .where('currentBattlefieldId', '==', battlefieldId)
      .get();
  }
  
  if (heroesSnapshot.empty) {
    console.log(`[XP Distribution] No heroes found in battlefield ${battlefieldId}`);
    return {
      success: false,
      message: 'No heroes in battlefield',
      distribution: []
    };
  }
  
  const heroes = heroesSnapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  
  // Calculate total XP from all enemies
  const totalBaseXP = normalizedBaseXP.reduce((sum, xp) => sum + xp, 0);
  const avgEnemyLevel = Math.floor(normalizedEnemyLevel.reduce((sum, level) => sum + level, 0) / normalizedEnemyLevel.length);
  
  // Calculate XP distribution for total XP (treating all enemies as one combined reward)
  const distribution = calculateXPDistribution(totalBaseXP, avgEnemyLevel, heroes);
  
  // Update heroes in Firestore (single batch operation)
  const batch = db.batch();
  const levelUpResults = [];
  const updates = [];
  
  // Track stream stats per twitchId (batch these updates too)
  const streamStatsUpdates = new Map(); // twitchId -> { xpGained, levelUps }
  
  for (const dist of distribution) {
    const heroDoc = heroesSnapshot.docs.find(doc => doc.id === dist.heroId);
    if (!heroDoc) continue;
    
    const hero = heroDoc.data();
    const newXp = (hero.xp || 0) + dist.xpGained;
    
    // Process level-ups
    const levelUpResult = processLevelUps(hero, newXp);
    
    // Prepare update
    const heroRef = db.collection('heroes').doc(dist.heroId);
    const updateData = {
      xp: levelUpResult.updates.xp,
      ...levelUpResult.updates
    };
    
    batch.update(heroRef, updateData);
    
    updates.push({
      heroId: dist.heroId,
      heroName: hero.name || 'Unknown',
      heroLevel: dist.heroLevel,
      xpGained: dist.xpGained,
      newLevel: levelUpResult.newLevel,
      leveledUp: levelUpResult.leveledUp,
      levelsGained: levelUpResult.levelsGained || 0
    });
    
    if (levelUpResult.leveledUp) {
      levelUpResults.push({
        heroId: dist.heroId,
        heroName: hero.name || 'Unknown',
        oldLevel: hero.level || 1,
        newLevel: levelUpResult.newLevel,
        levelsGained: levelUpResult.levelsGained
      });
    }
    
    // Accumulate stream stats (batch update later)
    const twitchId = hero.twitchUserId || hero.twitchId;
    if (twitchId) {
      if (!streamStatsUpdates.has(twitchId)) {
        streamStatsUpdates.set(twitchId, { xpGained: 0, levelUps: 0 });
      }
      const stats = streamStatsUpdates.get(twitchId);
      stats.xpGained += dist.xpGained;
      if (levelUpResult.leveledUp) {
        stats.levelUps += levelUpResult.levelsGained || 1;
      }
    }
  }
  
  // Commit all hero updates in one batch
  await batch.commit();
  
  // Batch update stream stats (one write per unique twitchId instead of per hero)
  const streamStatsBatch = db.batch();
  for (const [twitchId, stats] of streamStatsUpdates.entries()) {
    if (stats.xpGained > 0 || stats.levelUps > 0) {
      const statsRef = db.collection('streamStats').doc(twitchId);
      const updateData = {
        twitchId,
        lastUpdateTime: admin.firestore.FieldValue.serverTimestamp()
      };
      
      if (stats.xpGained > 0) {
        updateData.totalXpGained = admin.firestore.FieldValue.increment(stats.xpGained);
      }
      
      if (stats.levelUps > 0) {
        updateData.heroesLeveledUp = admin.firestore.FieldValue.increment(stats.levelUps);
      }
      
      streamStatsBatch.set(statsRef, updateData, { merge: true });
    }
  }
  
  // Commit stream stats batch (if any)
  if (streamStatsUpdates.size > 0) {
    await streamStatsBatch.commit();
  }
  
  // Log results
  const totalXPGiven = distribution.reduce((sum, d) => sum + d.xpGained, 0);
  const levelUps = levelUpResults.length;
  
  console.log(`[XP Distribution] Batch: ${normalizedBaseXP.length} enemy/enemies killed in battlefield ${battlefieldId}`);
  console.log(`   Enemies: ${normalizedEnemyName.join(', ')}`);
  console.log(`   Total Base XP: ${totalBaseXP}, Avg Level: ${avgEnemyLevel}, Heroes: ${heroes.length}`);
  console.log(`   Total XP Given: ${totalXPGiven}, Level-ups: ${levelUps}`);
  
  if (levelUps > 0) {
    levelUpResults.forEach(result => {
      console.log(`   🎉 ${result.heroName} leveled up: ${result.oldLevel} → ${result.newLevel} (+${result.levelsGained})`);
    });
  }
  
  return {
    success: true,
    battlefieldId,
    enemyCount: normalizedBaseXP.length,
    enemyNames: normalizedEnemyName,
    avgEnemyLevel,
    totalBaseXP,
    heroesCount: heroes.length,
    totalXPGiven,
    levelUps,
    distribution: updates,
    levelUpResults
  };
  
  } catch (error) {
    console.error(`[XP Distribution] Error awarding batch XP for battlefield ${battlefieldId}:`, error);
    return {
      success: false,
      error: error.message,
      distribution: []
    };
  }
}

/**
 * Get XP distribution preview (without actually awarding XP)
 * Useful for displaying expected XP before combat
 * 
 * @param {number} baseXP - Base XP from enemy template
 * @param {number} enemyLevel - Enemy level
 * @param {Array} heroes - Array of hero objects
 * @returns {Object} Preview object with distribution details
 */
export function previewXPDistribution(baseXP, enemyLevel, heroes) {
  const distribution = calculateXPDistribution(baseXP, enemyLevel, heroes);
  
  return {
    baseXP,
    enemyLevel,
    heroesCount: heroes.length,
    baseXPSplit: Math.floor(baseXP / heroes.length),
    distribution: distribution.map(d => ({
      heroName: heroes.find(h => h.id === d.heroId)?.name || 'Unknown',
      heroLevel: d.heroLevel,
      xpGained: d.xpGained,
      levelMultiplier: d.levelMultiplier,
      buffMultiplier: d.buffMultiplier,
      totalMultiplier: d.totalMultiplier
    })),
    totalXPGiven: distribution.reduce((sum, d) => sum + d.xpGained, 0)
  };
}
