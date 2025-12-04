import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixHeroLevelsCustom() {
  try {
    console.log('\n🔧 STEP 1: Fixing all hero maxXp values...\n');
    
    // Get ALL heroes
    const heroesSnapshot = await db.collection('heroes').get();
    
    console.log(`📊 Found ${heroesSnapshot.size} heroes\n`);
    
    const batch1 = db.batch();
    let fixed = 0;
    
    for (const doc of heroesSnapshot.docs) {
      const hero = doc.data();
      const currentLevel = hero.level || 1;
      
      // Calculate CORRECT maxXp using exponential formula
      const correctMaxXp = Math.floor(100 * Math.pow(1.5, currentLevel - 1));
      
      console.log(`✅ ${hero.name} (Lv${currentLevel}): Setting maxXp=${correctMaxXp}, xp=0`);
      
      batch1.update(doc.ref, {
        maxXp: correctMaxXp,
        xp: 0, // Reset current XP
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      fixed++;
    }
    
    console.log(`\n💾 Committing ${fixed} updates...`);
    await batch1.commit();
    console.log('✅ Step 1 complete!\n');
    
    // STEP 2: Scale specific heroes
    console.log('🔧 STEP 2: Scaling specific heroes to target levels...\n');
    
    const customLevels = [
      { name: 'tehchno', targetLevel: 90 },
      { name: 'theneverendingwar', targetLevel: 90 },
      { name: 'FloodWater_', targetLevel: 45 }
    ];
    
    const batch2 = db.batch();
    
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
      
      // Calculate maxXp for target level
      const targetMaxXp = Math.floor(100 * Math.pow(1.5, targetLevel - 1));
      
      console.log(`📉 ${name}: Lv${oldLevel} → Lv${targetLevel}`);
      console.log(`   New maxXp: ${targetMaxXp}`);
      console.log(`   XP: 0`);
      
      batch2.update(heroDoc.ref, {
        level: targetLevel,
        maxXp: targetMaxXp,
        xp: 0,
        // Recalculate stats based on new level
        maxHp: Math.floor(100 + (targetLevel * 10)),
        hp: Math.floor(100 + (targetLevel * 10)),
        attack: Math.floor(10 + (targetLevel * 2)),
        defense: Math.floor(5 + (targetLevel * 1)),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    
    console.log('\n💾 Committing custom level updates...');
    await batch2.commit();
    console.log('✅ Step 2 complete!\n');
    
    console.log('🎉 ALL DONE!\n');
    console.log('📋 Summary:');
    console.log(`  ✅ Fixed maxXp for ${fixed} heroes`);
    console.log(`  ✅ Reset all XP to 0`);
    console.log(`  ✅ Scaled ${customLevels.length} heroes to custom levels:`);
    customLevels.forEach(({ name, targetLevel }) => {
      console.log(`     - ${name}: Level ${targetLevel}`);
    });
    console.log('\n⚠️  Note: Base stats recalculated, but gear stats remain!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

fixHeroLevelsCustom();
