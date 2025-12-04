import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkHeroLevel() {
  try {
    const heroId = '0UgvWSOqQMFCklWylsp7';
    
    console.log(`\n🔍 Checking hero: ${heroId}\n`);
    
    const heroDoc = await db.collection('heroes').doc(heroId).get();
    
    if (!heroDoc.exists) {
      console.log('❌ Hero not found!');
      process.exit(0);
    }
    
    const hero = heroDoc.data();
    
    console.log('📋 Hero Details:');
    console.log(`  Name: ${hero.name}`);
    console.log(`  Role: ${hero.role}`);
    console.log(`  Level: ${hero.level}`);
    console.log(`  XP: ${hero.xp || 0}`);
    console.log(`  Max XP: ${hero.maxXp || 0}`);
    console.log(`  HP: ${hero.hp}/${hero.maxHp}`);
    console.log(`  Attack: ${hero.attack}`);
    console.log(`  Defense: ${hero.defense}`);
    
    // Check if the level seems wrong
    if (hero.level > 100) {
      console.log(`\n⚠️  WARNING: Level ${hero.level} seems unusually high!`);
      console.log('  This might be a display bug or data corruption.');
    }
    
    // Also check guild
    console.log('\n🏰 Checking guild membership...');
    const guildSnapshot = await db.collection('guilds')
      .where('memberIds', 'array-contains', heroId)
      .limit(1)
      .get();
    
    if (!guildSnapshot.empty) {
      const guild = guildSnapshot.docs[0].data();
      const member = guild.members.find(m => m.userId === heroId);
      
      console.log(`\n📋 Guild: ${guild.name}`);
      console.log(`  Member data in guild:`);
      console.log(`    Username: ${member?.username}`);
      console.log(`    Role: ${member?.heroRole}`);
      console.log(`    Level: ${member?.heroLevel}`);
      console.log(`    Rank: ${member?.rank}`);
      
      if (member?.heroLevel !== hero.level) {
        console.log(`\n⚠️  MISMATCH!`);
        console.log(`  Hero level in heroes collection: ${hero.level}`);
        console.log(`  Hero level in guild members array: ${member?.heroLevel}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

checkHeroLevel();

