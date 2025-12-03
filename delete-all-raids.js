/**
 * Delete all raid instances for theneverendingwar's battlefield
 * Run: node delete-all-raids.js
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

async function deleteAllRaids() {
  try {
    console.log('🗑️ Deleting all raid instances...\n');
    
    const battlefieldId = 'twitch:1087777297';
    
    // Delete all raids for this battlefield
    const raidsSnapshot = await db.collection('raidInstances')
      .where('battlefieldId', '==', battlefieldId)
      .get();
    
    console.log(`Found ${raidsSnapshot.size} raid instances to delete`);
    
    const batch = db.batch();
    raidsSnapshot.forEach(doc => {
      console.log(`  - Deleting raid: ${doc.id}`);
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    
    console.log('\n✅ All raids deleted!');
    console.log('\n🎮 You can now create a new raid with: node create-high-level-raid.js');
    
  } catch (error) {
    console.error('❌ Error deleting raids:', error);
    throw error;
  }
}

deleteAllRaids()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });

