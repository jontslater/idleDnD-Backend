/**
 * Clean up and re-unlock achievements for theneverendingwar
 * Removes offensive titles like "Genocide" and uses new achievement list
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

async function fixAchievements() {
  try {
    console.log('🔧 Fixing achievements for theneverendingwar...\n');
    
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
    
    console.log(`✅ Found hero: ${hero.name} (Level: ${hero.level})`);
    console.log(`📊 Total achievements in code: ${ACHIEVEMENTS.length}\n`);
    
    // CLEAR OLD DATA and set new achievements
    const unlockedAchievements = ACHIEVEMENTS.map(achievement => ({
      achievementId: achievement.id,
      unlockedAt: admin.firestore.Timestamp.now(),
      progress: achievement.requirements.target
    }));
    
    // Collect all unique titles from current achievements
    const allTitles = [...new Set(ACHIEVEMENTS.map(a => a.rewards.title).filter(Boolean))];
    
    console.log(`📜 Unique titles: ${allTitles.length}`);
    console.log('🗑️  Removed offensive titles (Genocide, etc.)');
    console.log(`✨ New titles include: ${allTitles.slice(0, 5).join(', ')}, ...\n`);
    
    // Calculate total rewards
    const totalTokens = ACHIEVEMENTS.reduce((sum, a) => sum + (a.rewards.tokens || 0), 0);
    const totalGold = ACHIEVEMENTS.reduce((sum, a) => sum + (a.rewards.gold || 0), 0);
    
    // Update hero - REPLACE old achievements
    await db.collection('heroes').doc(heroId).update({
      achievements: unlockedAchievements,
      titles: allTitles,
      activeTitle: 'The Relentless', // Set a good default title
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ SUCCESS! Achievements updated!\n');
    console.log('📋 Summary:');
    console.log(`  - Total Achievements: ${ACHIEVEMENTS.length}`);
    console.log(`  - Unique Titles: ${allTitles.length}`);
    console.log(`  - Active Title: "The Relentless"`);
    console.log(`  - All offensive titles removed ✓\n`);
    
    console.log('🎮 Ready to test!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixAchievements();
