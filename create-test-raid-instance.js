/**
 * Create a test raid instance to test mode switching
 * Run: node create-test-raid-instance.js
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function createTestRaidInstance() {
  try {
    console.log('Creating test raid instance...');
    
    const instanceId = `raid_elder_dragon_test_${Date.now()}`;
    
    const instance = {
      id: instanceId,
      type: 'raid',
      instanceType: 'elder_dragon_heroic',
      difficulty: 'heroic',
      name: "Elder Dragon's Lair (Heroic)",
      
      participants: [
        {
          userId: '1087777297', // theneverendingwar
          heroId: '0UgvWSOqQMFCklWylsp7', // Updated hero ID
          username: 'theneverendingwar',
          heroName: 'theneverendingwar',
          role: 'guardian', // Use actual class, not "tank"
          class: 'guardian',
          level: 83,
          gearScore: 2000,
          hp: 8000,
          maxHp: 8000
        }
      ],
      
      participantIds: ['1087777297'],
      
      boss: {
        name: 'Elder Dragon',
        spriteType: 'Adult Dragon',
        level: 45,
        hp: 200000,
        maxHp: 200000,
        attack: 200,
        defense: 100,
        mechanics: []
      },
      
      currentWave: 0,
      totalWaves: 5,
      waves: 5,
      
      // Wave enemies (comma-separated strings - Firebase doesn't allow nested arrays)
      waveEnemies: [
        'Baby Dragon,Baby Dragon',             // Wave 1: 2x Baby Dragons
        'Dragon Whelp,Dragon Whelp',           // Wave 2: 2x Dragon_1 (small)
        'Dragon Guardian,Dragon Guardian',     // Wave 3: 2x Dragon_2 (medium)
        'Dragon Sentinel,Dragon Sentinel',     // Wave 4: 2x Dragon_3 (large)
        // Wave 5 = Elder Dragon (boss) - Dragon Fully Animated
      ],
      
      status: 'in-progress',
      
      createdBy: '1087777297',
      battlefieldId: 'twitch:1087777297',
      
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 2 * 60 * 60 * 1000))
    };
    
    // Save instance
    await db.collection('raidInstances').doc(instanceId).set(instance);
    console.log(`✅ Created raid instance: ${instanceId}`);
    
    // Update theneverendingwar's hero to be in this raid
    const hero1 = await db.collection('heroes').doc('0UgvWSOqQMFCklWylsp7').get();
    if (hero1.exists) {
      await db.collection('heroes').doc('0UgvWSOqQMFCklWylsp7').update({
        currentInstanceId: instanceId,
        currentInstanceType: 'raid',
        currentBattlefieldId: admin.firestore.FieldValue.delete()
      });
      console.log(`✅ Updated theneverendingwar's hero with instance ID`);
    }
    
    console.log('\n✅ Test raid instance created!');
    console.log(`Instance ID: ${instanceId}`);
    console.log(`\nNow open Clean Battlefield and watch it switch to RAID MODE! 🐉`);
    console.log(`URL: http://localhost:5173/clean-battlefield?battlefieldId=twitch:1087777297\n`);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

createTestRaidInstance();
