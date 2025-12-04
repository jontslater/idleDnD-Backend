/**
 * Unlock all achievements for theneverendingwar for testing
 * Run: node unlock-all-achievements.js
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { ACHIEVEMENTS } from './src/data/achievements.js';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function unlockAllAchievements() {
  try {
    console.log('🏆 Unlocking all achievements for theneverendingwar...\n');
    
    // Find theneverendingwar's hero
    const heroesSnapshot = await db.collection('heroes')
      .where('name', '==', 'theneverendingwar')
      .limit(1)
      .get();
    
    if (heroesSnapshot.empty) {
      console.error('❌ Hero "theneverendingwar" not found!');
      process.exit(1);
    }
    
    const heroDoc = heroesSnapshot.docs[0];
    const heroId = heroDoc.id;
    const hero = heroDoc.data();
    
    console.log(`✅ Found hero: ${hero.name} (ID: ${heroId}, Level: ${hero.level})`);
    console.log(`📊 Current achievements: ${hero.achievements?.length || 0}`);
    console.log(`📜 Current titles: ${hero.titles?.length || 0}\n`);
    
    // Prepare all achievements
    const unlockedAchievements = ACHIEVEMENTS.map(achievement => ({
      achievementId: achievement.id,
      unlockedAt: admin.firestore.Timestamp.now(),
      progress: achievement.requirements.target
    }));
    
    // Collect all unique titles
    const allTitles = [...new Set(ACHIEVEMENTS.map(a => a.rewards.title).filter(Boolean))];
    
    // Calculate total rewards
    const totalTokens = ACHIEVEMENTS.reduce((sum, a) => sum + (a.rewards.tokens || 0), 0);
    const totalGold = ACHIEVEMENTS.reduce((sum, a) => sum + (a.rewards.gold || 0), 0);
    
    console.log(`🎯 Unlocking ${ACHIEVEMENTS.length} achievements...`);
    console.log(`📜 Unlocking ${allTitles.length} titles...`);
    console.log(`💎 Total tokens: +${totalTokens.toLocaleString()}`);
    console.log(`💰 Total gold: +${totalGold.toLocaleString()}g\n`);
    
    // Update hero
    await db.collection('heroes').doc(heroId).update({
      achievements: unlockedAchievements,
      titles: allTitles,
      activeTitle: allTitles[0] || null, // Set first title as active
      tokens: (hero.tokens || 0) + totalTokens,
      gold: (hero.gold || 0) + totalGold,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ SUCCESS! All achievements unlocked!\n');
    console.log('📋 Summary:');
    console.log(`  - Achievements: ${ACHIEVEMENTS.length}`);
    console.log(`  - Titles: ${allTitles.length}`);
    console.log(`  - Active Title: ${allTitles[0] || 'None'}`);
    console.log(`  - New Token Balance: ${((hero.tokens || 0) + totalTokens).toLocaleString()}`);
    console.log(`  - New Gold Balance: ${((hero.gold || 0) + totalGold).toLocaleString()}g\n`);
    
    console.log('🎉 theneverendingwar is now ready for testing!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

unlockAllAchievements();
