import admin from 'firebase-admin';
import { db } from '../index.js';

// Update leaderboards (should be called periodically)
export async function updateLeaderboards() {
  try {
    // Global Level Leaderboard
    const heroesSnapshot = await db.collection('heroes')
      .orderBy('level', 'desc')
      .limit(100)
      .get();
    
    const levelEntries = heroesSnapshot.docs.map((doc, index) => {
      const hero = doc.data();
      return {
        userId: doc.id,
        username: hero.name || 'Unknown',
        heroName: hero.name || 'Unknown',
        value: hero.level || 1,
        rank: index + 1,
        updatedAt: admin.firestore.Timestamp.now()
      };
    });
    
    await db.collection('leaderboards').doc('global-level').set({
      id: 'global-level',
      type: 'global',
      category: 'level',
      entries: levelEntries,
      lastUpdated: admin.firestore.Timestamp.now()
    });
    
    // Global Damage Leaderboard
    const damageSnapshot = await db.collection('heroes')
      .orderBy('stats.totalDamage', 'desc')
      .limit(100)
      .get();
    
    const damageEntries = damageSnapshot.docs.map((doc, index) => {
      const hero = doc.data();
      return {
        userId: doc.id,
        username: hero.name || 'Unknown',
        heroName: hero.name || 'Unknown',
        value: hero.stats?.totalDamage || 0,
        rank: index + 1,
        updatedAt: admin.firestore.Timestamp.now()
      };
    });
    
    await db.collection('leaderboards').doc('global-damage').set({
      id: 'global-damage',
      type: 'global',
      category: 'damage',
      entries: damageEntries,
      lastUpdated: admin.firestore.Timestamp.now()
    });
    
    // Global Healing Leaderboard
    const healingSnapshot = await db.collection('heroes')
      .orderBy('stats.totalHealing', 'desc')
      .limit(100)
      .get();
    
    const healingEntries = healingSnapshot.docs.map((doc, index) => {
      const hero = doc.data();
      return {
        userId: doc.id,
        username: hero.name || 'Unknown',
        heroName: hero.name || 'Unknown',
        value: hero.stats?.totalHealing || 0,
        rank: index + 1,
        updatedAt: admin.firestore.Timestamp.now()
      };
    });
    
    await db.collection('leaderboards').doc('global-healing').set({
      id: 'global-healing',
      type: 'global',
      category: 'healing',
      entries: healingEntries,
      lastUpdated: admin.firestore.Timestamp.now()
    });
    
    // Guild Level Leaderboards
    const guildsSnapshot = await db.collection('guilds')
      .orderBy('level', 'desc')
      .limit(100)
      .get();
    
    const guildLevelEntries = guildsSnapshot.docs.map((doc, index) => {
      const guild = doc.data();
      return {
        userId: doc.id,
        username: guild.name || 'Unknown',
        heroName: guild.name || 'Unknown',
        value: guild.level || 1,
        rank: index + 1,
        updatedAt: admin.firestore.Timestamp.now()
      };
    });
    
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

// Get leaderboard
export async function getLeaderboard(type, category) {
  try {
    const leaderboardId = `${type}-${category}`;
    const doc = await db.collection('leaderboards').doc(leaderboardId).get();
    
    if (!doc.exists) {
      return { entries: [], lastUpdated: null };
    }
    
    return doc.data();
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    throw error;
  }
}

// Get user's rankings across all categories
export async function getUserRankings(userId) {
  try {
    const leaderboards = ['global-level', 'global-damage', 'global-healing', 'guild-level'];
    const rankings = {};
    
    for (const lbId of leaderboards) {
      const doc = await db.collection('leaderboards').doc(lbId).get();
      if (doc.exists) {
        const data = doc.data();
        const entry = data.entries.find(e => e.userId === userId);
        if (entry) {
          rankings[data.category] = {
            rank: entry.rank,
            value: entry.value,
            category: data.category,
            type: data.type
          };
        }
      }
    }
    
    return rankings;
  } catch (error) {
    console.error('Error getting user rankings:', error);
    throw error;
  }
}
