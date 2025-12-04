import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function updateGuildMembersInfo() {
  try {
    console.log('\n🔄 Updating guild members with hero info...\n');
    
    // Get all guilds
    const guildsSnapshot = await db.collection('guilds').get();
    
    if (guildsSnapshot.empty) {
      console.log('❌ No guilds found!');
      process.exit(0);
    }
    
    console.log(`✅ Found ${guildsSnapshot.size} guild(s)\n`);
    
    for (const guildDoc of guildsSnapshot.docs) {
      const guild = guildDoc.data();
      const guildId = guildDoc.id;
      
      console.log(`📋 Processing guild: ${guild.name} (${guildId})`);
      
      if (!guild.members || guild.members.length === 0) {
        console.log('  ⚠️  No members array found\n');
        continue;
      }
      
      const updatedMembers = [];
      
      for (const member of guild.members) {
        // Fetch hero data for this member
        const heroDoc = await db.collection('heroes').doc(member.userId).get();
        
        if (!heroDoc.exists) {
          console.log(`  ❌ Hero ${member.userId} not found`);
          // Keep the member but without hero info
          updatedMembers.push(member);
          continue;
        }
        
        const hero = heroDoc.data();
        
        // Update member with hero info
        const updatedMember = {
          ...member,
          heroRole: hero.role || 'warrior',
          heroLevel: hero.level || 1
        };
        
        updatedMembers.push(updatedMember);
        
        console.log(`  ✅ ${member.username} - ${hero.role} Lv${hero.level}`);
      }
      
      // Update guild with new members array
      await db.collection('guilds').doc(guildId).update({
        members: updatedMembers,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      console.log(`  💾 Updated ${updatedMembers.length} members\n`);
    }
    
    console.log('✨ All guilds updated!\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

updateGuildMembersInfo();
