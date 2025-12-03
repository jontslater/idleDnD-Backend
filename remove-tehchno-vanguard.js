/**
 * Remove tehchno vanguard from battlefield
 * Run: node remove-tehchno-vanguard.js
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

async function removeHero() {
  try {
    const heroId = 'n8DKaw8TvEYkssj5HgFY'; // tehchno vanguard
    
    console.log(`Deleting hero: ${heroId}`);
    
    await db.collection('heroes').doc(heroId).delete();
    
    console.log('✅ tehchno (vanguard) deleted!');
    
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

removeHero()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
