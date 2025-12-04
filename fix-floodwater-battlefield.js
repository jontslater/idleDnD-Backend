import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixFloodwaterBattlefield() {
  try {
    console.log('\n🔧 Fixing FloodWater_ on battlefield...\n');
    
    // Fix the SPECIFIC hero on the battlefield
    const heroId = 'SKmsK4B8ZgSo6MlYtXgs';
    const targetLevel = 45;
    
    const heroRef = db.collection('heroes').doc(heroId);
    const heroDoc = await heroRef.get();
    
    if (!heroDoc.exists) {
      console.log('❌ Hero not found!');
      process.exit(1);
    }
    
    const hero = heroDoc.data();
    
    // Calculate correct maxXp
    const correctMaxXp = Math.floor(100 * Math.pow(1.5, targetLevel - 1));
    
    console.log(`👤 FloodWater_ (Chronomancer):`);
    console.log(`   ID: ${heroId}`);
    console.log(`   Current Level: ${hero.level}`);
    console.log(`   Current maxXp: ${hero.maxXp} ❌`);
    console.log(`   Target Level: ${targetLevel}`);
    console.log(`   Correct maxXp: ${correctMaxXp} ✅`);
    console.log(`   Setting XP to 0`);
    
    await heroRef.update({
      level: targetLevel,
      maxXp: correctMaxXp,
      xp: 0,
      maxHp: Math.floor(100 + (targetLevel * 10)),
      hp: Math.floor(100 + (targetLevel * 10)),
      attack: Math.floor(10 + (targetLevel * 2)),
      defense: Math.floor(5 + (targetLevel * 1)),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('\n✅ Fixed FloodWater_ (Chronomancer) to Level 45!');
    console.log('   This is the one on the battlefield!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

fixFloodwaterBattlefield();
