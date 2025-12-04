import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkLatestGuild() {
  try {
    console.log('\n🔍 Checking latest guild...\n');
    
    // Get all guilds ordered by creation time
    const guildsSnapshot = await db.collection('guilds')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get();
    
    if (guildsSnapshot.empty) {
      console.log('❌ No guilds found!');
      process.exit(0);
    }
    
    const guildDoc = guildsSnapshot.docs[0];
    const guild = guildDoc.data();
    
    console.log('📋 Latest Guild:');
    console.log(`  ID: ${guildDoc.id}`);
    console.log(`  Name: ${guild.name}`);
    console.log(`  Created By: ${guild.createdBy}`);
    console.log(`  Created By Hero Name: ${guild.createdByHeroName}`);
    console.log(`  Member IDs: ${JSON.stringify(guild.memberIds)}`);
    console.log(`  Members: ${JSON.stringify(guild.members, null, 2)}`);
    console.log(`  Level: ${guild.level}`);
    console.log(`  Gold: ${guild.gold}`);
    console.log(`  Max Members: ${guild.maxMembers}`);
    console.log(`  Join Mode: ${guild.joinMode}`);
    
    // Now check the hero
    console.log('\n🦸 Checking hero...\n');
    const heroId = guild.createdBy;
    const heroDoc = await db.collection('heroes').doc(heroId).get();
    
    if (!heroDoc.exists) {
      console.log(`❌ Hero ${heroId} not found!`);
    } else {
      const hero = heroDoc.data();
      console.log(`  Hero ID: ${heroDoc.id}`);
      console.log(`  Hero Name: ${hero.name}`);
      console.log(`  Twitch User ID: ${hero.twitchUserId}`);
      console.log(`  Twitch Username: ${hero.twitchUsername}`);
    }
    
    // Check if we can find the guild by memberIds
    console.log('\n🔍 Testing guild query by memberIds...\n');
    const guildQuery = await db.collection('guilds')
      .where('memberIds', 'array-contains', heroId)
      .limit(1)
      .get();
    
    if (guildQuery.empty) {
      console.log('❌ Guild NOT found when querying by memberIds!');
    } else {
      console.log('✅ Guild FOUND when querying by memberIds!');
      console.log(`  Guild ID: ${guildQuery.docs[0].id}`);
      console.log(`  Guild Name: ${guildQuery.docs[0].data().name}`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

checkLatestGuild();
