import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkAndCreateRaids() {
  try {
    console.log('\n🔍 Checking for raids in Firebase...\n');
    
    // Check raids collection
    const raidsSnapshot = await db.collection('raids').get();
    
    console.log(`📊 Found ${raidsSnapshot.size} raid(s) in database\n`);
    
    if (raidsSnapshot.size > 0) {
      console.log('📋 Existing raids:');
      raidsSnapshot.forEach(doc => {
        const raid = doc.data();
        console.log(`  - ${doc.id}: ${raid.name} (${raid.difficulty}, ${raid.type})`);
      });
    } else {
      console.log('❌ No raids found! Creating test raids...\n');
      
      // Create sample raids
      const testRaids = [
        {
          id: 'elder_dragon_mythic',
          name: 'Elder Dragon Lair',
          difficulty: 'mythic',
          type: 'weekly',
          minLevel: 50,
          minItemScore: 5000,
          minPlayers: 5,
          maxPlayers: 10,
          requiredTanks: 2,
          requiredHealers: 2,
          requiredDps: 6,
          rewards: {
            gold: 10000,
            tokens: 500,
            experience: 50000
          },
          description: 'Face the legendary Elder Dragon in its lair',
          bosses: ['Elder Dragon'],
          status: 'recruiting',
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        },
        {
          id: 'molten_core',
          name: 'Molten Core',
          difficulty: 'heroic',
          type: 'weekly',
          minLevel: 30,
          minItemScore: 2000,
          minPlayers: 5,
          maxPlayers: 10,
          requiredTanks: 2,
          requiredHealers: 2,
          requiredDps: 6,
          rewards: {
            gold: 5000,
            tokens: 200,
            experience: 25000
          },
          description: 'Venture into the heart of the volcano',
          bosses: ['Fire Elemental', 'Magma Lord'],
          status: 'recruiting',
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        },
        {
          id: 'dragon_sanctum',
          name: 'Dragon Sanctum',
          difficulty: 'epic',
          type: 'daily',
          minLevel: 40,
          minItemScore: 3500,
          minPlayers: 3,
          maxPlayers: 8,
          requiredTanks: 1,
          requiredHealers: 1,
          requiredDps: 6,
          rewards: {
            gold: 7500,
            tokens: 350,
            experience: 35000
          },
          description: 'Battle through waves of dragons',
          bosses: ['Baby Dragon', 'Adult Dragon', 'Ancient Dragon'],
          status: 'recruiting',
          createdAt: admin.firestore.FieldValue.serverTimestamp()
        }
      ];
      
      const batch = db.batch();
      
      for (const raid of testRaids) {
        const raidRef = db.collection('raids').doc(raid.id);
        batch.set(raidRef, raid);
        console.log(`✅ Creating raid: ${raid.name} (${raid.id})`);
      }
      
      await batch.commit();
      console.log(`\n✨ Created ${testRaids.length} test raids!\n`);
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    process.exit(0);
  }
}

checkAndCreateRaids();
