import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkAllHeroGuilds() {
  try {
    const heroId = '0UgvWSOqQMFCklWylsp7';
    
    console.log(`\n🔍 All guilds for hero: ${heroId}\n`);
    
    const guildsSnapshot = await db.collection('guilds')
      .where('memberIds', 'array-contains', heroId)
      .get();
    
    if (guildsSnapshot.empty) {
      console.log('❌ No guilds found!');
      process.exit(0);
    }
    
    console.log(`✅ Found ${guildsSnapshot.size} guild(s):\n`);
    
    guildsSnapshot.forEach((doc, index) => {
      const guild = doc.data();
      console.log(`Guild ${index + 1}:`);
      console.log(`  ID: ${doc.id}`);
      console.log(`  Name: ${guild.name}`);
      console.log(`  Created By Hero Name: ${guild.createdByHeroName}`);
      console.log(`  Members Array: ${guild.members ? `${guild.members.length} members` : 'UNDEFINED'}`);
      console.log(`  Level: ${guild.level}`);
      console.log(`  Gold: ${guild.gold}`);
      console.log(`  Created At: ${guild.createdAt?.toDate() || 'N/A'}`);
      console.log('');
    });
    
    // Delete all old guilds
    console.log('🗑️  Do you want to delete all these guilds? (They have issues)');
    console.log('Deleting all guilds...\n');
    
    for (const doc of guildsSnapshot.docs) {
      await db.collection('guilds').doc(doc.id).delete();
      console.log(`✅ Deleted guild: ${doc.data().name} (${doc.id})`);
    }
    
    console.log('\n✨ All guilds deleted! Now create a new one!\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

checkAllHeroGuilds();
