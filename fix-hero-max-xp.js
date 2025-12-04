import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixHeroMaxXP() {
  try {
    console.log('\n🔧 Fixing hero maxXp values...\n');
    
    // Get ALL heroes
    const heroesSnapshot = await db.collection('heroes').get();
    
    console.log(`📊 Found ${heroesSnapshot.size} heroes\n`);
    
    let fixed = 0;
    const batch = db.batch();
    
    for (const doc of heroesSnapshot.docs) {
      const hero = doc.data();
      const currentLevel = hero.level || 1;
      
      // Calculate CORRECT maxXp using exponential formula
      const correctMaxXp = Math.floor(100 * Math.pow(1.5, currentLevel - 1));
      
      // Reset XP to 0 (they'll need to re-earn it with the correct formula)
      // This prevents them from instantly leveling up again
      
      console.log(`👤 ${hero.name} (Lv${currentLevel}):`);
      console.log(`   Old maxXp: ${hero.maxXp}`);
      console.log(`   New maxXp: ${correctMaxXp}`);
      console.log(`   Resetting XP to 0`);
      
      batch.update(doc.ref, {
        maxXp: correctMaxXp,
        xp: 0, // Reset current XP
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      fixed++;
    }
    
    console.log(`\n💾 Committing ${fixed} updates...`);
    await batch.commit();
    
    console.log(`\n✅ Fixed ${fixed} heroes!`);
    console.log('\n📋 Changes:');
    console.log('  ✅ Set correct exponential maxXp for each level');
    console.log('  ✅ Reset all XP to 0 (heroes keep their levels)');
    console.log('  ✅ Heroes will now level up at the correct pace');
    
    console.log('\n⚠️  Heroes will need to earn XP again, but:');
    console.log('  - They keep their current level');
    console.log('  - They keep all their gear');
    console.log('  - Future leveling will be balanced');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

fixHeroMaxXP();
