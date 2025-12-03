/**
 * Remove test raid instance and return heroes to idle
 * Run: node remove-test-raid-instance.js
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function removeTestRaidInstance() {
  try {
    console.log('Finding test raid instances...');
    
    // Find all raid instances with 'test' in the ID
    const raidsSnapshot = await db.collection('raidInstances')
      .where('id', '>=', 'raid_elder_dragon_test')
      .where('id', '<', 'raid_elder_dragon_tesu') // String range query
      .get();
    
    console.log(`Found ${raidsSnapshot.docs.length} test raid instances`);
    
    for (const doc of raidsSnapshot.docs) {
      console.log(`Deleting raid instance: ${doc.id}`);
      await doc.ref.delete();
    }
    
    // Return heroes to battlefield
    const heroIds = ['VjQrMq10rdy6EMDaXceV', 'n8DKaw8TvEYkssj5HgFY'];
    
    for (const heroId of heroIds) {
      const heroDoc = await db.collection('heroes').doc(heroId).get();
      
      if (heroDoc.exists) {
        const heroData = heroDoc.data();
        
        // Only update if they're in a test raid
        if (heroData.currentInstanceId && heroData.currentInstanceId.includes('test')) {
          await db.collection('heroes').doc(heroId).update({
            currentInstanceId: admin.firestore.FieldValue.delete(),
            currentInstanceType: admin.firestore.FieldValue.delete(),
            currentBattlefieldId: 'twitch:1087777297' // Return to battlefield
          });
          console.log(`✅ Returned hero ${heroId} to battlefield`);
        }
      }
    }
    
    console.log('\n✅ Test raid instances cleaned up!');
    console.log(`Heroes returned to idle adventure mode!\n`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

removeTestRaidInstance();
