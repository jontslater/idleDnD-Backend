// Populate test raid and world boss data for UI testing
import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

dotenv.config();

// Initialize Firebase
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const serviceAccountPath = join(__dirname, '..', 'serviceAccountKey.json');

try {
  const serviceAccountContent = readFileSync(serviceAccountPath, 'utf8');
  const serviceAccount = JSON.parse(serviceAccountContent);
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  
  console.log('✅ Firebase initialized');
} catch (error) {
  console.error('❌ Failed to initialize Firebase:', error);
  process.exit(1);
}

const db = admin.firestore();

// Generate fake participants
function generateParticipants(count, raidType = 'normal') {
  const names = [
    'Shadowblade', 'Lightbringer', 'Stormbringer', 'Nightshade', 'Ironforge',
    'Frostwhisper', 'Flameheart', 'Silvermoon', 'Darkstorm', 'Goldleaf',
    'Thunderfist', 'Bloodthorn', 'Starweaver', 'Windrunner', 'Earthshaker',
    'Voidwalker', 'Sunstrider', 'Moonblade', 'Stormrage', 'Dawnseeker'
  ];
  
  const roles = [
    'paladin', 'warrior', 'guardian', 'bloodknight', // tanks
    'cleric', 'druid', 'shaman', 'lightbringer', // healers
    'berserker', 'mage', 'hunter', 'rogue', 'assassin', 'warlock' // dps
  ];
  
  const participants = [];
  
  for (let i = 0; i < count; i++) {
    const name = names[i % names.length] + (i > names.length ? Math.floor(i / names.length) : '');
    const role = roles[i % roles.length];
    const level = raidType === 'mythic' ? 50 + Math.floor(Math.random() * 10) :
                  raidType === 'heroic' ? 35 + Math.floor(Math.random() * 10) :
                  20 + Math.floor(Math.random() * 10);
    
    participants.push({
      userId: `test_user_${i}`,
      username: name,
      heroName: name,
      heroLevel: level,
      heroRole: role,
      itemScore: raidType === 'mythic' ? 6000 + Math.floor(Math.random() * 2000) :
                 raidType === 'heroic' ? 3500 + Math.floor(Math.random() * 1500) :
                 1500 + Math.floor(Math.random() * 1000),
      damageDealt: Math.floor(Math.random() * 50000),
      healingDone: Math.floor(Math.random() * 30000),
      damageTaken: Math.floor(Math.random() * 40000),
      damageBlocked: Math.floor(Math.random() * 25000),
      deaths: Math.floor(Math.random() * 3),
      isAlive: Math.random() > 0.2 // 80% alive
    });
  }
  
  return participants;
}

async function populateTestData() {
  try {
    console.log('🎮 Creating test raid instances...\n');
    
    // Raid 1: Corrupted Temple (Normal) - In Progress
    const raid1 = {
      raidId: 'corrupted_temple',
      difficulty: 'normal',
      status: 'in-progress',
      currentWave: 2,
      maxWaves: 3,
      bossHp: 35000,
      bossMaxHp: 50000,
      participants: generateParticipants(5, 'normal'),
      combatLog: [
        { timestamp: Date.now() - 120000, message: 'Raid started: Corrupted Temple', type: 'phase' },
        { timestamp: Date.now() - 60000, message: 'Wave 1 completed!', type: 'phase' },
        { timestamp: Date.now() - 30000, message: 'Wave 2 in progress...', type: 'phase' }
      ],
      lootDrops: [],
      startedAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 180000)),
      completedAt: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    const raid1Ref = await db.collection('raidInstances').add(raid1);
    console.log('✅ Created Corrupted Temple raid:', raid1Ref.id);
    
    // Raid 2: Dragon's Lair (Heroic) - Boss Fight
    const raid2 = {
      raidId: 'dragons_lair',
      difficulty: 'heroic',
      status: 'in-progress',
      currentWave: 5,
      maxWaves: 5,
      bossHp: 75000,
      bossMaxHp: 150000,
      participants: generateParticipants(8, 'heroic'),
      combatLog: [
        { timestamp: Date.now() - 300000, message: 'Raid started: Dragon\'s Lair', type: 'phase' },
        { timestamp: Date.now() - 60000, message: 'All waves cleared! Boss encounter!', type: 'phase' },
        { timestamp: Date.now() - 30000, message: 'Dragon uses Breath Weapon!', type: 'mechanic' },
        { timestamp: Date.now() - 10000, message: 'Boss HP at 50% - Aerial Phase!', type: 'phase' }
      ],
      lootDrops: [],
      startedAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 400000)),
      completedAt: null,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    const raid2Ref = await db.collection('raidInstances').add(raid2);
    console.log('✅ Created Dragon\'s Lair raid:', raid2Ref.id);
    
    console.log('\n🌍 Creating test world boss...\n');
    
    // World Boss: Void Emperor
    const worldBoss = {
      name: 'Void Emperor',
      hp: 650000,
      maxHp: 1000000,
      attack: 300,
      level: 60,
      mechanics: [
        { name: 'Void Beam', description: 'Channels dark energy', type: 'mechanic' },
        { name: 'Reality Tear', description: 'Summons void adds', type: 'adds' },
        { name: 'Consuming Darkness', description: 'Pulls all players in', type: 'pull' },
        { name: 'Entropy', description: 'Reduces max HP over time', type: 'debuff' }
      ],
      scheduledTime: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 600000)),
      duration: 60, // 60 minutes
      rewards: {
        gold: 5000,
        tokens: 100,
        guaranteedLoot: 'legendary',
        xpBonus: 50000
      },
      participants: generateParticipants(50, 'mythic'), // 50 participants for testing
      status: 'active',
      startedAt: Date.now() - 600000,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    const bossRef = await db.collection('worldBoss').add(worldBoss);
    console.log('✅ Created Void Emperor world boss:', bossRef.id);
    
    console.log('\n🎉 Test data populated successfully!');
    console.log('\n📋 Summary:');
    console.log('   - 2 active raid instances');
    console.log('   - 1 active world boss');
    console.log('   - 50+ participants across all content');
    console.log('\n💡 Switch to the World Boss tab in Electron to see the UI!');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error populating test data:', error);
    process.exit(1);
  }
}

populateTestData();

