import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixExistingGuilds() {
  try {
    console.log('\n🔧 Fixing existing guilds...\n');
    
    // Get all guilds
    const guildsSnapshot = await db.collection('guilds').get();
    
    if (guildsSnapshot.empty) {
      console.log('❌ No guilds found!');
      process.exit(0);
    }
    
    console.log(`✅ Found ${guildsSnapshot.size} guild(s)\n`);
    
    let fixed = 0;
    
    for (const doc of guildsSnapshot.docs) {
      const guild = doc.data();
      const updates = {};
      
      console.log(`\n📋 Checking guild: ${guild.name} (ID: ${doc.id})`);
      console.log(`   Created by: ${guild.createdBy}`);
      console.log(`   Current members array:`, guild.members ? `${guild.members.length} members` : 'MISSING');
      
      // Fix missing members array
      if (!guild.members || !Array.isArray(guild.members)) {
        console.log('   ❌ Missing members array - creating...');
        
        // Create members array from memberIds
        const members = [];
        
        if (guild.memberIds && Array.isArray(guild.memberIds)) {
          for (const userId of guild.memberIds) {
            // Creator is leader, others are members
            const isLeader = userId === guild.createdBy;
            
            // Try to fetch hero name if this is the creator
            let heroName = isLeader ? (guild.creatorUsername || guild.createdByHeroName || 'Unknown') : 'Unknown';
            
            if (isLeader && userId && !guild.createdByHeroName) {
              try {
                const heroDoc = await db.collection('heroes').doc(userId).get();
                if (heroDoc.exists) {
                  heroName = heroDoc.data().name || heroName;
                  updates.createdByHeroName = heroName;
                  console.log(`   ✅ Fetched founder hero name: ${heroName}`);
                }
              } catch (err) {
                console.log(`   ⚠️ Could not fetch hero name for ${userId}`);
              }
            }
            
            members.push({
              userId: userId,
              username: heroName,
              rank: isLeader ? 'leader' : 'member',
              contributionPoints: 0,
              joinedAt: admin.firestore.Timestamp.now()
            });
          }
        }
        
        updates.members = members;
        console.log(`   ✅ Created members array with ${members.length} member(s)`);
      }
      
      // Fix missing createdByHeroName
      if (!guild.createdByHeroName && guild.createdBy) {
        try {
          const heroDoc = await db.collection('heroes').doc(guild.createdBy).get();
          if (heroDoc.exists) {
            const heroName = heroDoc.data().name || 'Unknown';
            updates.createdByHeroName = heroName;
            console.log(`   ✅ Added createdByHeroName: ${heroName}`);
            
            // Also update the leader's username in members array
            if (guild.members && Array.isArray(guild.members)) {
              const updatedMembers = guild.members.map(m => 
                m.rank === 'leader' ? { ...m, username: heroName } : m
              );
              updates.members = updatedMembers;
              console.log(`   ✅ Updated leader's username in members array`);
            }
          }
        } catch (err) {
          console.log(`   ⚠️ Could not fetch hero name for ${guild.createdBy}`);
        }
      }
      
      // Fix missing fields
      if (!guild.level) {
        updates.level = 1;
        console.log('   ✅ Set level to 1');
      }
      
      if (guild.gold === undefined) {
        updates.gold = 0;
        console.log('   ✅ Set gold to 0');
      }
      
      if (!guild.maxMembers) {
        updates.maxMembers = 50;
        console.log('   ✅ Set maxMembers to 50');
      }
      
      if (!guild.joinMode) {
        updates.joinMode = 'open';
        console.log('   ✅ Set joinMode to open');
      }
      
      // Apply updates if any
      if (Object.keys(updates).length > 0) {
        updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
        
        await db.collection('guilds').doc(doc.id).update(updates);
        fixed++;
        console.log(`   ✅ Updated ${Object.keys(updates).length} field(s)`);
      } else {
        console.log('   ✅ No updates needed - guild is good!');
      }
    }
    
    console.log(`\n\n✅ Fixed ${fixed} guild(s)!`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

fixExistingGuilds();
