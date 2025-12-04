import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function deleteGuild() {
  try {
    const guildId = 'jI17pEV9K9THwxRbpXjo';
    
    console.log(`\n🗑️  Deleting guild: ${guildId}\n`);
    
    const guildDoc = await db.collection('guilds').doc(guildId).get();
    
    if (!guildDoc.exists) {
      console.log('❌ Guild not found!');
      process.exit(0);
    }
    
    const guild = guildDoc.data();
    console.log(`Guild: ${guild.name}`);
    console.log(`Members: ${guild.memberIds?.length || 0}`);
    console.log(`Created by: ${guild.createdByHeroName || guild.createdBy}`);
    
    await db.collection('guilds').doc(guildId).delete();
    
    console.log(`\n✅ Guild "${guild.name}" deleted successfully!`);
    console.log('\n💡 You can now create a new guild with the hero-based system!');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

deleteGuild();
