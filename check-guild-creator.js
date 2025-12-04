import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkGuildCreator() {
  try {
    const guildId = 'jI17pEV9K9THwxRbpXjo';
    
    const guildDoc = await db.collection('guilds').doc(guildId).get();
    if (!guildDoc.exists) {
      console.log('Guild not found!');
      process.exit(0);
    }
    
    const guild = guildDoc.data();
    console.log('\n📋 Guild Data:');
    console.log('Name:', guild.name);
    console.log('CreatedBy:', guild.createdBy);
    console.log('CreatedByHeroName:', guild.createdByHeroName || 'NOT SET');
    console.log('Members:', guild.members);
    
    // Try to find hero by this ID
    console.log('\n🔍 Looking for hero document...');
    const heroDoc = await db.collection('heroes').doc(guild.createdBy).get();
    
    if (heroDoc.exists) {
      const hero = heroDoc.data();
      console.log('✅ Found hero by ID');
      console.log('  Name:', hero.name);
      
      // Update guild
      await db.collection('guilds').doc(guildId).update({
        createdByHeroName: hero.name,
        createdBy: heroDoc.id, // Hero ID
        members: guild.members.map(m => 
          m.rank === 'leader' ? { ...m, username: hero.name, userId: heroDoc.id } : m
        ),
        memberIds: [heroDoc.id],
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log(`\n✅ Updated guild with hero ID and name: ${hero.name}`);
    } else {
      console.log('❌ Hero document not found by ID');
      console.log('   Trying to find by twitchUserId: 1087777297');
      
      // Try to find hero by twitchUserId
      const heroSnapshot = await db.collection('heroes')
        .where('twitchUserId', '==', '1087777297')
        .limit(1)
        .get();
      
      if (!heroSnapshot.empty) {
        const heroDoc = heroSnapshot.docs[0];
        const hero = heroDoc.data();
        
        console.log('✅ Found hero by twitchUserId:');
        console.log('  ID:', heroDoc.id);
        console.log('  Name:', hero.name);
        console.log('  Role:', hero.role);
        console.log('  Level:', hero.level);
        
        // Update guild with correct hero ID and name
        await db.collection('guilds').doc(guildId).update({
          createdByHeroName: hero.name,
          createdBy: heroDoc.id, // Use hero ID instead of user ID
          members: [
            {
              userId: heroDoc.id,
              username: hero.name,
              rank: 'leader',
              contributionPoints: 0,
              joinedAt: admin.firestore.Timestamp.now()
            }
          ],
          memberIds: [heroDoc.id],
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        console.log(`\n✅ Updated guild with hero ID: ${heroDoc.id} and name: ${hero.name}`);
      } else {
        console.log('❌ No hero found for twitchUserId: 1087777297');
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

checkGuildCreator();
