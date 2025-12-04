/**
 * Delete the achievements collection from Firebase
 * We'll use the code file instead
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

async function deleteAchievements() {
  try {
    console.log('🗑️  Deleting achievements collection from Firebase...\n');
    
    const snapshot = await db.collection('achievements').get();
    
    if (snapshot.empty) {
      console.log('✅ No achievements to delete');
      process.exit(0);
    }
    
    console.log(`Found ${snapshot.size} achievements to delete\n`);
    
    const batch = db.batch();
    snapshot.docs.forEach(doc => {
      batch.delete(doc.ref);
    });
    
    await batch.commit();
    
    console.log(`✅ Deleted ${snapshot.size} achievements from Firebase`);
    console.log('📝 System will now use achievements from code file only\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

deleteAchievements();
