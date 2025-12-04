import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function checkHeroIdMismatch() {
  try {
    console.log('\n🔍 Checking Hero ID Mismatch...\n');
    
    // Check if BVLjZQcGYX1jawVyHSd6 exists
    console.log('1️⃣ Checking ID: BVLjZQcGYX1jawVyHSd6');
    const hero1 = await db.collection('heroes').doc('BVLjZQcGYX1jawVyHSd6').get();
    
    if (hero1.exists) {
      const data = hero1.data();
      console.log(`  ✅ EXISTS: ${data.name} (Lv${data.level}, ${data.role})`);
      console.log(`  Battlefield: ${data.currentBattlefieldId}`);
    } else {
      console.log('  ❌ NOT FOUND in Firebase');
    }
    
    // Check if 0UgvWSOqQMFCklWylsp7 exists
    console.log('\n2️⃣ Checking ID: 0UgvWSOqQMFCklWylsp7');
    const hero2 = await db.collection('heroes').doc('0UgvWSOqQMFCklWylsp7').get();
    
    if (hero2.exists) {
      const data = hero2.data();
      console.log(`  ✅ EXISTS: ${data.name} (Lv${data.level}, ${data.role})`);
      console.log(`  Battlefield: ${data.currentBattlefieldId}`);
    } else {
      console.log('  ❌ NOT FOUND in Firebase');
    }
    
    // Find all heroes named theneverendingwar
    console.log('\n3️⃣ Finding ALL "theneverendingwar" heroes:\n');
    const allNeverEndingWar = await db.collection('heroes')
      .where('name', '==', 'theneverendingwar')
      .get();
    
    console.log(`Found ${allNeverEndingWar.size} hero(es):`);
    allNeverEndingWar.forEach(doc => {
      const data = doc.data();
      console.log(`  - ID: ${doc.id}`);
      console.log(`    Name: ${data.name}`);
      console.log(`    Level: ${data.level}`);
      console.log(`    Battlefield: ${data.currentBattlefieldId || 'None'}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

checkHeroIdMismatch();

