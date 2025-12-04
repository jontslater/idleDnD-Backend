import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function listBattlefieldHeroes() {
  try {
    const battlefieldId = 'twitch:1087777297';
    
    console.log(`\n🔍 Searching for heroes on battlefield: ${battlefieldId}\n`);
    
    const heroesSnapshot = await db.collection('heroes')
      .where('currentBattlefieldId', '==', battlefieldId)
      .get();
    
    if (heroesSnapshot.empty) {
      console.log('❌ No heroes found on this battlefield!');
      console.log('\n💡 Tip: Make sure heroes have currentBattlefieldId set to:', battlefieldId);
      process.exit(0);
    }
    
    console.log(`✅ Found ${heroesSnapshot.size} hero(es):\n`);
    
    heroesSnapshot.forEach(doc => {
      const hero = doc.data();
      const isTestHero = hero.name.startsWith('Test');
      
      console.log(`${isTestHero ? '🧪 TEST' : '👤 REAL'} Hero:`);
      console.log(`  ID: ${doc.id}`);
      console.log(`  Name: ${hero.name}`);
      console.log(`  Role: ${hero.role}`);
      console.log(`  Level: ${hero.level}`);
      console.log(`  HP: ${hero.hp}/${hero.maxHp}`);
      console.log(`  Twitch User: ${hero.twitchUsername || 'N/A'}`);
      console.log(`  Twitch ID: ${hero.twitchUserId || 'N/A'}`);
      console.log('');
    });
    
    // Count test vs real heroes
    const testHeroes = heroesSnapshot.docs.filter(doc => doc.data().name.startsWith('Test'));
    const realHeroes = heroesSnapshot.docs.filter(doc => !doc.data().name.startsWith('Test'));
    
    console.log(`\n📊 Summary:`);
    console.log(`  Test Heroes: ${testHeroes.length}`);
    console.log(`  Real Heroes: ${realHeroes.length}`);
    console.log(`  Total: ${heroesSnapshot.size}`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

listBattlefieldHeroes();
