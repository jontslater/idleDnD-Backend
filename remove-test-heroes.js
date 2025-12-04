import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function removeTestHeroes() {
  try {
    const battlefieldId = 'twitch:1087777297';
    
    console.log(`\n🗑️  Removing test heroes from battlefield: ${battlefieldId}\n`);
    
    const heroesSnapshot = await db.collection('heroes')
      .where('currentBattlefieldId', '==', battlefieldId)
      .get();
    
    const testHeroes = heroesSnapshot.docs.filter(doc => {
      const hero = doc.data();
      return hero.name.startsWith('Test');
    });
    
    if (testHeroes.length === 0) {
      console.log('✅ No test heroes found!');
      process.exit(0);
    }
    
    console.log(`Found ${testHeroes.length} test hero(es) to remove:\n`);
    
    for (const doc of testHeroes) {
      const hero = doc.data();
      console.log(`  🗑️  Deleting: ${hero.name} (${hero.role} Lv${hero.level})`);
      await doc.ref.delete();
    }
    
    console.log(`\n✅ Removed ${testHeroes.length} test hero(es)!`);
    console.log(`\n💡 Real heroes remaining on battlefield:`);
    
    const remainingSnapshot = await db.collection('heroes')
      .where('currentBattlefieldId', '==', battlefieldId)
      .get();
    
    remainingSnapshot.forEach(doc => {
      const hero = doc.data();
      console.log(`  ✓ ${hero.name} (${hero.role} Lv${hero.level})`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

removeTestHeroes();
