import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function diagnoseXPBug() {
  try {
    console.log('\n🔍 Diagnosing XP System Bug...\n');
    
    // Get all heroes on the battlefield
    const heroesSnapshot = await db.collection('heroes')
      .where('currentBattlefieldId', '==', 'twitch:1087777297')
      .get();
    
    console.log(`📊 Found ${heroesSnapshot.size} heroes:\n`);
    
    heroesSnapshot.forEach(doc => {
      const hero = doc.data();
      
      // Calculate expected XP for their level
      const expectedMaxXP = Math.floor(100 * Math.pow(1.5, hero.level - 1));
      
      console.log(`👤 ${hero.name}:`);
      console.log(`  Level: ${hero.level}`);
      console.log(`  Current XP: ${hero.xp || 0}`);
      console.log(`  Max XP: ${hero.maxXp || 0}`);
      console.log(`  Expected Max XP for Lv${hero.level}: ${expectedMaxXP}`);
      console.log(`  XP Progress: ${Math.floor(((hero.xp || 0) / (hero.maxXp || 1)) * 100)}%`);
      
      // Check if they have unreasonably high XP
      if (hero.level > 100) {
        console.log(`  ⚠️  WARNING: Level ${hero.level} is suspiciously high!`);
      }
      
      if (hero.maxXp !== expectedMaxXP) {
        console.log(`  ❌ MISMATCH: maxXp should be ${expectedMaxXP} but is ${hero.maxXp}`);
      }
      
      console.log('');
    });
    
    // Check combat logs for XP gains
    console.log('\n📜 Checking XP gain patterns...\n');
    
    // Suggest fixes
    console.log('\n💡 Possible causes:');
    console.log('  1. XP multiplier too high');
    console.log('  2. XP not resetting after level up');
    console.log('  3. XP being granted multiple times per kill');
    console.log('  4. Rested XP or buffs stacking incorrectly');
    console.log('  5. XP formula changed during development');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

diagnoseXPBug();
