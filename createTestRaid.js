/**
 * Quick script to create a test raid instance
 * Run: node createTestRaid.js
 */

import admin from 'firebase-admin';
import serviceAccount from './serviceAccountKey.json' assert { type: 'json' };

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function createTestRaid() {
  try {
    const raidInstance = {
      raidId: 'corrupted_temple',
      difficulty: 'normal',
      status: 'active',
      organizerId: '146729989', // Your Twitch ID
      currentWave: 1,
      maxWaves: 3,
      bossHp: 50000,
      bossMaxHp: 50000,
      participants: [
        {
          userId: '146729989',
          username: 'TestOrganizer',
          heroName: 'TestOrganizer',
          heroLevel: 50,
          heroRole: 'guardian',
          itemScore: 200,
          isAlive: true,
          damageDealt: 0,
          healingDone: 0,
          damageTaken: 0,
          deaths: 0,
          currentHp: 5000,
          maxHp: 5000
        },
        {
          userId: 'test-user-2',
          username: 'TestUser2',
          heroName: 'TestUser2',
          heroLevel: 50,
          heroRole: 'berserker',
          itemScore: 200,
          isAlive: true,
          damageDealt: 0,
          healingDone: 0,
          damageTaken: 0,
          deaths: 0,
          currentHp: 4000,
          maxHp: 4000
        },
        {
          userId: 'test-user-3',
          username: 'TestUser3',
          heroName: 'TestUser3',
          heroLevel: 50,
          heroRole: 'cleric',
          itemScore: 200,
          isAlive: true,
          damageDealt: 0,
          healingDone: 0,
          damageTaken: 0,
          deaths: 0,
          currentHp: 3500,
          maxHp: 3500
        },
        {
          userId: 'test-user-4',
          username: 'TestUser4',
          heroName: 'TestUser4',
          heroLevel: 50,
          heroRole: 'mage',
          itemScore: 200,
          isAlive: true,
          damageDealt: 0,
          healingDone: 0,
          damageTaken: 0,
          deaths: 0,
          currentHp: 3000,
          maxHp: 3000
        },
        {
          userId: 'test-user-5',
          username: 'TestUser5',
          heroName: 'TestUser5',
          heroLevel: 50,
          heroRole: 'ranger',
          itemScore: 200,
          isAlive: true,
          damageDealt: 0,
          healingDone: 0,
          damageTaken: 0,
          deaths: 0,
          currentHp: 3000,
          maxHp: 3000
        }
      ],
      combatLog: [{
        timestamp: Date.now(),
        message: 'Test raid started: Corrupted Temple',
        type: 'phase'
      }],
      lootDrops: [],
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
      completedAt: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const instanceRef = await db.collection('raidInstances').add(raidInstance);
    
    console.log('\n✅ Test raid created successfully!');
    console.log('📋 Instance ID:', instanceRef.id);
    console.log('🔗 Route: /browser-source/raid/' + instanceRef.id);
    console.log('🌐 Full URL: http://localhost:5173/browser-source/raid/' + instanceRef.id);
    console.log('\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error creating test raid:', error);
    process.exit(1);
  }
}

createTestRaid();
