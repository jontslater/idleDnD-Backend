import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function verifyGuildQuery() {
  try {
    const heroId = '0UgvWSOqQMFCklWylsp7';
    const wrongUserId = 'BVLjZQcGYX1jawVyHSd6';
    
    console.log('\n🔍 Testing guild queries...\n');
    
    // Test 1: Query with HERO ID (should work)
    console.log(`1️⃣  Query with HERO ID: ${heroId}`);
    const heroQuery = await db.collection('guilds')
      .where('memberIds', 'array-contains', heroId)
      .limit(1)
      .get();
    
    if (heroQuery.empty) {
      console.log('   ❌ No guild found with hero ID');
    } else {
      const guild = heroQuery.docs[0].data();
      console.log(`   ✅ FOUND guild: ${guild.name}`);
      console.log(`   📋 Guild ID: ${heroQuery.docs[0].id}`);
      console.log(`   👤 Created by: ${guild.createdByHeroName || 'Unknown'}`);
      console.log(`   📊 Members: ${guild.memberIds?.length || 0}`);
    }
    
    // Test 2: Query with USER ID (should NOT work)
    console.log(`\n2️⃣  Query with USER ID: ${wrongUserId}`);
    const userQuery = await db.collection('guilds')
      .where('memberIds', 'array-contains', wrongUserId)
      .limit(1)
      .get();
    
    if (userQuery.empty) {
      console.log('   ✅ Correctly returns NO guild (user ID should not work)');
    } else {
      const guild = userQuery.docs[0].data();
      console.log(`   ❌ INCORRECTLY found guild: ${guild.name}`);
      console.log('   This is an old guild using user IDs!');
    }
    
    console.log('\n✨ Verification complete!\n');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

verifyGuildQuery();
