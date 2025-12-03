/**
 * List all heroes on theneverendingwar's battlefield
 * Run: node list-battlefield-heroes.js
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

async function listHeroes() {
  try {
    const battlefieldId = 'twitch:1087777297';
    
    console.log(`📋 Heroes on battlefield: ${battlefieldId}\n`);
    
    const heroesSnapshot = await db.collection('heroes')
      .where('currentBattlefieldId', '==', battlefieldId)
      .get();
    
    console.log(`Found ${heroesSnapshot.size} heroes:\n`);
    
    heroesSnapshot.forEach((doc, index) => {
      const hero = doc.data();
      console.log(`${index + 1}. ${hero.name || 'Unknown'} (${hero.role || 'Unknown'}, Lv${hero.level || 1})`);
      console.log(`   ID: ${doc.id}`);
      console.log(`   User: ${hero.username || 'Unknown'}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

listHeroes()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });

