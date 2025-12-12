/**
 * Unlock all achievements for a user
 * Usage: node scripts/unlock-all-achievements.js <userId>
 */

import admin from 'firebase-admin';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize Firebase Admin
import { readFileSync } from 'fs';
import dotenv from 'dotenv';

dotenv.config();

let db;
try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
  if (Object.keys(serviceAccount).length > 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    db = admin.firestore();
  } else {
    // Try loading from file
    try {
      const serviceAccountPath = join(__dirname, '..', 'serviceAccountKey.json');
      const serviceAccountContent = readFileSync(serviceAccountPath, 'utf8');
      const serviceAccountFile = JSON.parse(serviceAccountContent);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccountFile)
      });
      db = admin.firestore();
    } catch (err) {
      console.error('❌ FIREBASE_SERVICE_ACCOUNT_KEY not set and serviceAccountKey.json not found');
      process.exit(1);
    }
  }
} catch (error) {
  console.error('❌ Failed to initialize Firebase:', error);
  process.exit(1);
}

// Import achievements
const achievementsModule = await import('../src/data/achievements.js');
const ACHIEVEMENTS = achievementsModule.ACHIEVEMENTS;

const userId = process.argv[2] || '0UgvWSOqQMFCklWylsp7'; // Default to theneverendingwar

async function unlockAllAchievements() {
  try {
    console.log(`\n🔓 Unlocking all achievements for user: ${userId}\n`);
    
    const heroRef = db.collection('heroes').doc(userId);
    const heroDoc = await heroRef.get();
    
    if (!heroDoc.exists) {
      console.error(`❌ Hero not found for userId: ${userId}`);
      process.exit(1);
    }
    
    const hero = heroDoc.data();
    console.log(`✅ Found hero: ${hero.name || hero.username || userId}`);
    
    const unlockedAchievements = hero.achievements || [];
    const unlockedIds = unlockedAchievements.map(a => a.achievementId);
    const titles = hero.titles || [];
    let newTitlesAdded = 0;
    let newAchievementsAdded = 0;
    let totalTokens = 0;
    
    console.log(`\n📊 Current state:`);
    console.log(`   - Unlocked achievements: ${unlockedAchievements.length}`);
    console.log(`   - Current titles: ${titles.length}`);
    
    // Unlock all achievements that aren't already unlocked
    console.log(`\n🔍 Checking ${ACHIEVEMENTS.length} achievements...\n`);
    
    for (const achievement of ACHIEVEMENTS) {
      if (!unlockedIds.includes(achievement.id)) {
        unlockedAchievements.push({
          achievementId: achievement.id,
          unlockedAt: admin.firestore.Timestamp.now(),
          progress: achievement.requirements.target
        });
        newAchievementsAdded++;
        
        // Add title if it has one
        if (achievement.rewards?.title && !titles.includes(achievement.rewards.title)) {
          titles.push(achievement.rewards.title);
          newTitlesAdded++;
          console.log(`   ✅ Added title: "${achievement.rewards.title}" (from ${achievement.name})`);
        }
        
        // Add tokens if reward has them
        if (achievement.rewards?.tokens) {
          totalTokens += achievement.rewards.tokens;
        }
      }
    }
    
    // Update hero with all achievements and titles
    const updates = {
      achievements: unlockedAchievements,
      titles: titles,
      tokens: (hero.tokens || 0) + totalTokens,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await heroRef.update(updates);
    
    console.log(`\n✅ Successfully unlocked all achievements!`);
    console.log(`   - New achievements added: ${newAchievementsAdded}`);
    console.log(`   - New titles added: ${newTitlesAdded}`);
    console.log(`   - Tokens added: ${totalTokens}`);
    console.log(`   - Total achievements: ${unlockedAchievements.length}`);
    console.log(`   - Total titles: ${titles.length}\n`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

unlockAllAchievements();
