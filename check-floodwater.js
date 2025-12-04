import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkFloodwater() {
  try {
    console.log('\n🔍 Checking for FloodWater_ heroes...\n');
    
    // Find ALL heroes named FloodWater_
    const floodwaterQuery = await db.collection('heroes')
      .where('name', '==', 'FloodWater_')
      .get();
    
    if (floodwaterQuery.empty) {
      console.log('❌ No FloodWater_ heroes found!');
      process.exit(0);
    }
    
    console.log(`✅ Found ${floodwaterQuery.size} hero(es) named FloodWater_:\n`);
    
    floodwaterQuery.forEach((doc, index) => {
      const hero = doc.data();
      console.log(`${index + 1}. FloodWater_ (${doc.id}):`);
      console.log(`   Level: ${hero.level}`);
      console.log(`   XP: ${hero.xp}`);
      console.log(`   MaxXP: ${hero.maxXp}`);
      console.log(`   Role: ${hero.role}`);
      console.log(`   Battlefield: ${hero.currentBattlefieldId || 'None'}`);
      console.log(`   Twitch User: ${hero.twitchUsername || 'N/A'}`);
      console.log(`   Twitch ID: ${hero.twitchUserId || 'N/A'}`);
      console.log('');
    });
    
    // Check which one is on the active battlefield
    const onBattlefield = floodwaterQuery.docs.filter(doc => 
      doc.data().currentBattlefieldId === 'twitch:1087777297'
    );
    
    console.log(`📍 ${onBattlefield.length} FloodWater_ hero(es) on active battlefield\n`);
    
    if (onBattlefield.length > 0) {
      onBattlefield.forEach(doc => {
        const hero = doc.data();
        console.log(`⚡ ACTIVE: ${doc.id} - Level ${hero.level}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

checkFloodwater();
