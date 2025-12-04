import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixThreeHeroes() {
  try {
    console.log('\n🔧 Fixing the 3 heroes...\n');
    
    const customLevels = [
      { name: 'tehchno', targetLevel: 90 },
      { name: 'theneverendingwar', targetLevel: 90 },
      { name: 'FloodWater_', targetLevel: 45 }
    ];
    
    const batch = db.batch();
    
    for (const { name, targetLevel } of customLevels) {
      // Find hero by name
      const heroQuery = await db.collection('heroes')
        .where('name', '==', name)
        .limit(1)
        .get();
      
      if (heroQuery.empty) {
        console.log(`❌ Hero "${name}" not found!`);
        continue;
      }
      
      const heroDoc = heroQuery.docs[0];
      const hero = heroDoc.data();
      const oldLevel = hero.level;
      
      // Calculate maxXp for target level using CORRECT exponential formula
      const targetMaxXp = Math.floor(100 * Math.pow(1.5, targetLevel - 1));
      
      console.log(`📉 ${name}:`);
      console.log(`   Current: Lv${oldLevel}, maxXp=${hero.maxXp}`);
      console.log(`   Target:  Lv${targetLevel}, maxXp=${targetMaxXp}`);
      console.log(`   Setting XP to 0`);
      
      batch.update(heroDoc.ref, {
        level: targetLevel,
        maxXp: targetMaxXp,
        xp: 0,
        // Recalculate base stats (gear stats will be added on top)
        maxHp: Math.floor(100 + (targetLevel * 10)),
        hp: Math.floor(100 + (targetLevel * 10)),
        attack: Math.floor(10 + (targetLevel * 2)),
        defense: Math.floor(5 + (targetLevel * 1)),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    
    console.log('\n💾 Committing updates...');
    await batch.commit();
    console.log('✅ Done!\n');
    
    console.log('📋 Fixed:');
    customLevels.forEach(({ name, targetLevel }) => {
      console.log(`  ✅ ${name}: Level ${targetLevel}`);
    });
    
    console.log('\n⚠️  Note: Backend is now running FIXED code!');
    console.log('   Heroes will level up with CORRECT exponential formula!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

fixThreeHeroes();
