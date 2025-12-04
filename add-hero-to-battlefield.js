/**
 * Manually add theneverendingwar's hero to their battlefield
 * Run: node add-hero-to-battlefield.js
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

async function addHeroToBattlefield() {
  try {
    console.log('Adding theneverendingwar to battlefield...\n');
    
    const heroId = '0UgvWSOqQMFCklWylsp7';
    const battlefieldId = 'twitch:1087777297';
    
    await db.collection('heroes').doc(heroId).update({
      currentBattlefieldId: battlefieldId
    });
    
    console.log(`✅ Updated hero ${heroId}`);
    console.log(`   currentBattlefieldId: ${battlefieldId}`);
    console.log('\n🎮 theneverendingwar should now appear on the battlefield!');
    console.log('   Refresh: http://localhost:3000/clean-battlefield?battlefieldId=twitch:1087777297');
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

addHeroToBattlefield()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });


