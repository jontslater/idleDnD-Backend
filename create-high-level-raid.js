/**
 * Create a high-level raid instance with full party for testing
 * Run AFTER create-test-party.js
 * Run: node create-high-level-raid.js
 */

import admin from 'firebase-admin';
import { readFileSync } from 'fs';

// Initialize Firebase Admin
const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();

async function createHighLevelRaid() {
  try {
    console.log('Creating high-level raid instance for full party test...\n');
    
    const battlefieldId = 'twitch:1087777297';
    
    // Find all test heroes on the battlefield
    const heroesSnapshot = await db.collection('heroes')
      .where('currentBattlefieldId', '==', battlefieldId)
      .get();
    
    if (heroesSnapshot.empty) {
      console.error('❌ No heroes found on battlefield! Run create-test-party.js first!');
      process.exit(1);
    }
    
    console.log(`✅ Found ${heroesSnapshot.size} heroes on battlefield\n`);
    
    // Build participants array
    const participants = [];
    heroesSnapshot.forEach(doc => {
      const hero = doc.data();
      participants.push({
        userId: hero.twitchUserId || doc.id,
        heroId: doc.id,
        username: hero.username || hero.name,
        heroName: hero.name,
        role: hero.role,
        class: hero.role,
        level: hero.level || 1,
        gearScore: 2000,
        hp: hero.hp || 100,
        maxHp: hero.maxHp || 100
      });
      console.log(`  - ${hero.name} (${hero.role}, Lv${hero.level})`);
    });
    
    console.log(`\n🎮 Creating raid with ${participants.length} heroes...`);
    
    const instanceId = `raid_elder_dragon_epic_${Date.now()}`;
    
    const instance = {
      id: instanceId,
      type: 'raid',
      instanceType: 'elder_dragon_epic',
      difficulty: 'epic',
      name: "Elder Dragon's Lair (Epic)",
      
      participants: participants,
      participantIds: participants.map(p => p.userId),
      
      boss: {
        name: 'Elder Dragon',
        spriteType: 'Elder Dragon', // Dragon - Fully Animated!
        level: 85,
        hp: 80000, // Balanced for 5-man party (was 350K - way too much!)
        maxHp: 80000,
        attack: 300, // Higher damage
        defense: 100, // Lowered so damage isn't reduced as much
        mechanics: []
      },
      
      currentWave: 0, // Start at 0 (idle mode first!)
      totalWaves: 5,
      waves: 5,
      
      // Wave enemies - scaled for Lv80+ party
      waveEnemies: [
        'Baby Dragon,Baby Dragon',
        'Dragon Whelp,Dragon Whelp',
        'Dragon Guardian,Dragon Guardian',
        'Dragon Sentinel,Dragon Sentinel',
        // Wave 5 = Elder Dragon boss
      ],
      
      status: 'in-progress',
      
      createdBy: '1087777297', // theneverendingwar
      battlefieldId: battlefieldId,
      
      startedAt: admin.firestore.FieldValue.serverTimestamp(),
      expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 2 * 60 * 60 * 1000))
    };
    
    await db.collection('raidInstances').doc(instanceId).set(instance);
    
    console.log('\n✅ High-level raid created successfully!');
    console.log('\n📋 Raid Details:');
    console.log(`  ID: ${instanceId}`);
    console.log(`  Difficulty: Epic`);
    console.log(`  Party Size: ${participants.length}`);
    console.log(`  Boss: Elder Dragon (Lv85, 350K HP)`);
    console.log(`  Waves: 5 (Baby Dragon → Whelp → Guardian → Sentinel → Boss)`);
    
    console.log('\n🎯 Testing Instructions:');
    console.log('1. Open: http://localhost:3000/clean-battlefield?battlefieldId=twitch:1087777297');
    console.log('2. You should see heroes in IDLE mode first');
    console.log('3. The system will auto-detect the raid and transition to raid mode');
    console.log('4. Watch the full combat through all 5 waves');
    console.log('5. After Elder Dragon dies, it will return to idle mode');
    console.log('6. Check loot, XP, and quest progress!');
    
    console.log('\n🔥 Features to test:');
    console.log('  ✓ Idle → Raid transition');
    console.log('  ✓ Wave-based combat (Baby Dragon → Elder Dragon)');
    console.log('  ✓ Fire DoT (Dragon Whelp)');
    console.log('  ✓ Poison DoT (Dragon Guardian)');
    console.log('  ✓ Aerial attacks');
    console.log('  ✓ Boss mechanics');
    console.log('  ✓ Loot generation');
    console.log('  ✓ XP/Gold rewards');
    console.log('  ✓ Quest progress');
    console.log('  ✓ Raid → Idle transition');
    
    console.log('\n🎮 Ready to test!');
    
  } catch (error) {
    console.error('❌ Error creating raid:', error);
    throw error;
  }
}

createHighLevelRaid()
  .then(() => process.exit(0))
  .catch(err => {
    console.error(err);
    process.exit(1);
  });
