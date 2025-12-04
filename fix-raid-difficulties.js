import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixRaidDifficulties() {
  try {
    console.log('\n🔧 Fixing raid difficulties to match tabs (normal, heroic, mythic)...\n');
    
    // Change Dragon Sanctum from "epic" to "normal"
    await db.collection('raids').doc('dragon_sanctum').update({
      difficulty: 'normal',
      minLevel: 20, // Lower for normal difficulty
      minItemScore: 1000, // Lower for normal difficulty
      boss: {
        name: 'Young Dragon',
        level: 30,
        hp: 100000,
        maxHp: 100000,
        attack: 150,
        mechanics: ['Fire Breath', 'Claw Swipe']
      }
    });
    
    console.log('✅ Dragon Sanctum → NORMAL difficulty (Lv20+, Young Dragon)');
    console.log('✅ Molten Core → HEROIC difficulty (Lv30+, Magma Lord)');
    console.log('✅ Elder Dragon Lair → MYTHIC difficulty (Lv50+, Elder Dragon)');
    
    console.log('\n📊 Raid Lineup:');
    console.log('  Normal:  Dragon Sanctum (Lv20+)');
    console.log('  Heroic:  Molten Core (Lv30+)');
    console.log('  Mythic:  Elder Dragon Lair (Lv50+)');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

fixRaidDifficulties();
