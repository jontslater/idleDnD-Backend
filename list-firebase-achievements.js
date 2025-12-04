/**
 * List what achievements are in Firebase collection
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function listAchievements() {
  try {
    console.log('📋 Listing achievements in Firebase collection...\n');
    
    const snapshot = await db.collection('achievements').get();
    
    if (snapshot.empty) {
      console.log('❌ No achievements found in Firebase collection');
      process.exit(0);
    }
    
    console.log(`Found ${snapshot.size} achievements in Firebase:\n`);
    
    snapshot.forEach((doc, index) => {
      const achievement = doc.data();
      console.log(`${index + 1}. ${achievement.name || doc.id}`);
      console.log(`   ID: ${doc.id}`);
      console.log(`   Title: "${achievement.rewards?.title || 'N/A'}"`);
      console.log(`   Category: ${achievement.category}`);
      console.log(`   Rarity: ${achievement.rarity}`);
      console.log('');
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

listAchievements();
