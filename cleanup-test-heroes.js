/**
 * Clean up test heroes and raid instances after testing
 * Run: node cleanup-test-heroes.js
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

async function cleanup() {
  try {
    console.log('🧹 Cleaning up test data...\n');
    
    // Delete test heroes
    const heroesSnapshot = await db.collection('heroes')
      .where('username', 'in', ['testtank', 'testhealer', 'testdps1', 'testdps2'])
      .get();
    
    console.log(`Found ${heroesSnapshot.size} test heroes to delete`);
    
    const batch = db.batch();
    heroesSnapshot.forEach(doc => {
      console.log(`  - Deleting ${doc.data().name}`);
      batch.delete(doc.ref);
    });
    
    // Delete test raid instances
    const raidsSnapshot = await db.collection('raidInstances')
      .where('battlefieldId', '==', 'twitch:1087777297')
      .get();
    
    console.log(`Found ${raidsSnapshot.size} raid instances to delete`);
    
    raidsSnapshot.forEach(doc => {
      console.log(`  - Deleting raid ${doc.id}`);
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    
    console.log('\n✅ Cleanup complete!');
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  }
}

cleanup()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
