import admin from 'firebase-admin';
import { db } from '../index.js';

// Update leaderboards (should be called periodically)
export async function updateLeaderboards() {
  try {
    // Get all heroes and filter out test heroes, then sort
    const heroesSnapshot = await db.collection('heroes').get();
    
    // Filter out test heroes and sort by level
    const heroes = heroesSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(hero => !(hero.name || '').toLowerCase().includes('test'))
      .sort((a, b) => (b.level || 1) - (a.level || 1))
      .slice(0, 10);
    
    const levelEntries = heroes.map((hero, index) => ({
      userId: hero.id,
      username: hero.name || 'Unknown',
      heroName: hero.name || 'Unknown',
      value: hero.level || 1,
      rank: index + 1,
      updatedAt: admin.firestore.Timestamp.now()
    }));
    
    await db.collection('leaderboards').doc('global-level').set({
      id: 'global-level',
      type: 'global',
      category: 'level',
      entries: levelEntries,
      lastUpdated: admin.firestore.Timestamp.now()
    });
    
    // Global Damage Leaderboard
    const damageHeroes = heroesSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(hero => !(hero.name || '').toLowerCase().includes('test'))
      .sort((a, b) => (b.stats?.totalDamage || 0) - (a.stats?.totalDamage || 0))
      .slice(0, 10);
    
    const damageEntries = damageHeroes.map((hero, index) => ({
      userId: hero.id,
      username: hero.name || 'Unknown',
      heroName: hero.name || 'Unknown',
      value: hero.stats?.totalDamage || 0,
      rank: index + 1,
      updatedAt: admin.firestore.Timestamp.now()
    }));
    
    await db.collection('leaderboards').doc('global-damage').set({
      id: 'global-damage',
      type: 'global',
      category: 'damage',
      entries: damageEntries,
      lastUpdated: admin.firestore.Timestamp.now()
    });
    
    // Global Healing Leaderboard
    const healingHeroes = heroesSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(hero => !(hero.name || '').toLowerCase().includes('test'))
      .sort((a, b) => (b.stats?.totalHealing || 0) - (a.stats?.totalHealing || 0))
      .slice(0, 10);
    
    const healingEntries = healingHeroes.map((hero, index) => ({
      userId: hero.id,
      username: hero.name || 'Unknown',
      heroName: hero.name || 'Unknown',
      value: hero.stats?.totalHealing || 0,
      rank: index + 1,
      updatedAt: admin.firestore.Timestamp.now()
    }));
    
    await db.collection('leaderboards').doc('global-healing').set({
      id: 'global-healing',
      type: 'global',
      category: 'healing',
      entries: healingEntries,
      lastUpdated: admin.firestore.Timestamp.now()
    });
    
    // Guild Level Leaderboards
    const guildsSnapshot = await db.collection('guilds').get();
    
    const guildLevelEntries = guildsSnapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(guild => !(guild.name || '').toLowerCase().includes('test'))
      .sort((a, b) => (b.level || 1) - (a.level || 1))
      .slice(0, 10)
      .map((guild, index) => ({
        userId: guild.id,
        username: guild.name || 'Unknown',
        heroName: guild.name || 'Unknown',
        value: guild.level || 1,
        rank: index + 1,
        updatedAt: admin.firestore.Timestamp.now()
      }));
    
    await db.collection('leaderboards').doc('guild-level').set({
      id: 'guild-level',
      type: 'guild',
      category: 'guildLevel',
      entries: guildLevelEntries,
      lastUpdated: admin.firestore.Timestamp.now()
    });
    
    console.log('✅ Leaderboards updated');
  } catch (error) {
    console.error('Error updating leaderboards:', error);
  }
}

// Get leaderboard (computes on-the-fly if not in cache)
export async function getLeaderboard(type, category) {
  try {
    console.log(`[Leaderboard] Getting leaderboard: ${type}/${category}`);
    const leaderboardId = `${type}-${category}`;
    const doc = await db.collection('leaderboards').doc(leaderboardId).get();
    
    // If leaderboard exists in cache, return it
    if (doc.exists) {
      console.log(`[Leaderboard] Found cached leaderboard for ${leaderboardId}`);
      return doc.data();
    }
    
    console.log(`[Leaderboard] No cached leaderboard for ${leaderboardId}, computing on-the-fly`);
    
    // Otherwise, compute on-the-fly for global leaderboards
    if (type === 'global') {
      const result = await computeLeaderboardOnTheFly(category);
      console.log(`[Leaderboard] Computed leaderboard, returning ${result.entries?.length || 0} entries`);
      return result;
    }
    
    // Return empty for guild leaderboards if not cached
    console.log(`[Leaderboard] Returning empty for guild leaderboard (not cached)`);
    return { entries: [], lastUpdated: null };
  } catch (error) {
    console.error('[Leaderboard] Error getting leaderboard:', error);
    console.error('[Leaderboard] Error stack:', error.stack);
    throw error;
  }
}

// Compute leaderboard on-the-fly from heroes collection
async function computeLeaderboardOnTheFly(category) {
  try {
    console.log(`[Leaderboard] Computing ${category} leaderboard on-the-fly...`);
    const heroesSnapshot = await db.collection('heroes').get();
    
    console.log(`[Leaderboard] Found ${heroesSnapshot.size} heroes in collection`);
    
    if (heroesSnapshot.empty) {
      console.log('[Leaderboard] No heroes found, returning empty leaderboard');
      return { entries: [], lastUpdated: null };
    }
    
    // Convert to array and filter out test heroes
    const heroes = heroesSnapshot.docs
      .map(doc => {
        const data = doc.data();
        return {
          ...data,
          id: doc.id  // Always use document ID
        };
      })
      .filter(hero => {
        // Filter out test heroes (case-insensitive check for "test" in name)
        const name = (hero.name || '').toLowerCase();
        return !name.includes('test');
      });
    
    console.log(`[Leaderboard] Converted ${heroes.length} heroes to array (after filtering test heroes)`);
    if (heroes.length > 0) {
      console.log(`[Leaderboard] Sample hero:`, {
        id: heroes[0].id,
        name: heroes[0].name,
        level: heroes[0].level,
        hasStats: !!heroes[0].stats,
        hasEquipment: !!heroes[0].equipment
      });
    }
    
    // Sort based on category
    let sortedHeroes = [];
    
    switch (category) {
      case 'level':
        sortedHeroes = heroes.sort((a, b) => (b.level || 1) - (a.level || 1));
        break;
      case 'damage':
        sortedHeroes = heroes.sort((a, b) => (b.stats?.totalDamage || 0) - (a.stats?.totalDamage || 0));
        break;
      case 'healing':
        sortedHeroes = heroes.sort((a, b) => (b.stats?.totalHealing || 0) - (a.stats?.totalHealing || 0));
        break;
      case 'gold':
        sortedHeroes = heroes.sort((a, b) => (b.gold || 0) - (a.gold || 0));
        break;
      case 'itemScore':
        // Calculate item score for each hero
        const heroesWithScore = heroes.map(hero => {
          let score = 0;
          const equipment = hero.equipment || {};
          Object.values(equipment).forEach((item) => {
            if (item) {
              const baseScore = (item.attack || 0) + (item.defense || 0) + ((item.hp || 0) / 2);
              const rarityBonus = item.rarity === 'legendary' ? 1.5 : 
                                  item.rarity === 'epic' ? 1.3 : 
                                  item.rarity === 'rare' ? 1.1 : 1.0;
              const procBonus = (item.procEffects?.length || 0) * 50;
              score += Math.floor((baseScore * rarityBonus) + procBonus);
            }
          });
          return { ...hero, itemScore: score };
        });
        sortedHeroes = heroesWithScore.sort((a, b) => (b.itemScore || 0) - (a.itemScore || 0));
        break;
      default:
        return { entries: [], lastUpdated: null };
    }
    
    // Convert to leaderboard format (limit to top 10)
    const entries = sortedHeroes.slice(0, 10).map((hero, index) => {
      let value;
      switch (category) {
        case 'level':
          value = hero.level || 1;
          break;
        case 'damage':
          value = hero.stats?.totalDamage || 0;
          break;
        case 'healing':
          value = hero.stats?.totalHealing || 0;
          break;
        case 'gold':
          value = hero.gold || 0;
          break;
        case 'itemScore':
          value = hero.itemScore || 0;
          break;
        default:
          value = 0;
      }
      
      return {
        userId: hero.id,
        username: hero.name || 'Unknown',
        heroName: hero.name || 'Unknown',
        value: value,
        rank: index + 1
      };
    });
    
    console.log(`[Leaderboard] Created ${entries.length} entries for ${category} leaderboard`);
    if (entries.length > 0) {
      console.log(`[Leaderboard] Top entry: ${entries[0].heroName} with value ${entries[0].value}`);
    }
    
    const result = {
      id: `global-${category}`,
      type: 'global',
      category: category,
      entries: entries,
      lastUpdated: admin.firestore.Timestamp.now()
    };
    
    return result;
  } catch (error) {
    console.error('[Leaderboard] Error computing leaderboard on-the-fly:', error);
    console.error('[Leaderboard] Error stack:', error.stack);
    return { entries: [], lastUpdated: null };
  }
}

// Get user's rankings across all categories (computed on-the-fly from heroes)
export async function getUserRankings(userId) {
  try {
    // First, check if the hero exists
    const heroDoc = await db.collection('heroes').doc(userId).get();
    if (!heroDoc.exists) {
      // Return empty rankings if hero doesn't exist
      return {};
    }
    
    const hero = heroDoc.data();
    const rankings = {};
    
    // Get all heroes (we'll sort in memory to avoid index requirements)
    const heroesSnapshot = await db.collection('heroes').get();
    
    if (heroesSnapshot.empty) {
      return {};
    }
    
    // Convert to array, filter out test heroes, and sort for each category
    const heroes = heroesSnapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      }))
      .filter(hero => {
        // Filter out test heroes (case-insensitive check for "test" in name)
        const name = (hero.name || '').toLowerCase();
        return !name.includes('test');
      });
    
    // Level rankings
    heroes.sort((a, b) => (b.level || 1) - (a.level || 1));
    const levelRank = heroes.findIndex(h => h.id === userId) + 1;
    if (levelRank > 0) {
      rankings['level'] = {
        rank: levelRank,
        value: hero.level || 1,
        category: 'level',
        type: 'global'
      };
    }
    
    // Damage rankings
    heroes.sort((a, b) => (b.stats?.totalDamage || 0) - (a.stats?.totalDamage || 0));
    const damageRank = heroes.findIndex(h => h.id === userId) + 1;
    if (damageRank > 0) {
      rankings['damage'] = {
        rank: damageRank,
        value: hero.stats?.totalDamage || 0,
        category: 'damage',
        type: 'global'
      };
    }
    
    // Healing rankings
    heroes.sort((a, b) => (b.stats?.totalHealing || 0) - (a.stats?.totalHealing || 0));
    const healingRank = heroes.findIndex(h => h.id === userId) + 1;
    if (healingRank > 0) {
      rankings['healing'] = {
        rank: healingRank,
        value: hero.stats?.totalHealing || 0,
        category: 'healing',
        type: 'global'
      };
    }
    
    // Gold rankings
    heroes.sort((a, b) => (b.gold || 0) - (a.gold || 0));
    const goldRank = heroes.findIndex(h => h.id === userId) + 1;
    if (goldRank > 0) {
      rankings['gold'] = {
        rank: goldRank,
        value: hero.gold || 0,
        category: 'gold',
        type: 'global'
      };
    }
    
    // Item Score rankings
    const heroesWithScore = heroes.map(h => {
      let score = 0;
      const equipment = h.equipment || {};
      Object.values(equipment).forEach((item) => {
        if (item) {
          const baseScore = (item.attack || 0) + (item.defense || 0) + ((item.hp || 0) / 2);
          const rarityBonus = item.rarity === 'legendary' ? 1.5 : 
                              item.rarity === 'epic' ? 1.3 : 
                              item.rarity === 'rare' ? 1.1 : 1.0;
          const procBonus = (item.procEffects?.length || 0) * 50;
          score += Math.floor((baseScore * rarityBonus) + procBonus);
        }
      });
      return { ...h, itemScore: score };
    });
    heroesWithScore.sort((a, b) => (b.itemScore || 0) - (a.itemScore || 0));
    const itemScoreRank = heroesWithScore.findIndex(h => h.id === userId) + 1;
    if (itemScoreRank > 0) {
      const heroItemScore = heroesWithScore.find(h => h.id === userId)?.itemScore || 0;
      rankings['itemScore'] = {
        rank: itemScoreRank,
        value: heroItemScore,
        category: 'itemScore',
        type: 'global'
      };
    }
    
    // TODO: Guild rankings if guild system is implemented
    // For now, we'll skip guild-level as it requires guild membership
    
    return rankings;
  } catch (error) {
    console.error('Error getting user rankings:', error);
    throw error;
  }
}
