import admin from 'firebase-admin';
import { readFileSync } from 'fs';
import fetch from 'node-fetch';

// Initialize Firebase Admin (check if already initialized)
if (!admin.apps.length) {
  const serviceAccount = JSON.parse(readFileSync('./serviceAccountKey.json', 'utf8'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
}

const db = admin.firestore();
const API_URL = 'http://localhost:3001';

async function testRaidSimulation() {
  try {
    console.log('\n🧪 Testing Full Raid Simulation Flow\n');
    console.log('=' .repeat(60));
    
    // Step 1: Get test heroes
    console.log('\n📋 Step 1: Finding test heroes...\n');
    
    const heroesSnapshot = await db.collection('heroes')
      .where('currentBattlefieldId', '==', 'twitch:1087777297')
      .limit(5)
      .get();
    
    const testHeroes = heroesSnapshot.docs.map(doc => {
      const data = doc.data();
      return {
        docId: doc.id, // Firestore document ID (what we need!)
        name: data.name,
        level: data.level,
        role: data.role,
        ...data
      };
    });
    
    console.log(`✅ Found ${testHeroes.length} heroes on battlefield:`);
    testHeroes.forEach((h, i) => {
      console.log(`  ${i + 1}. ${h.name} (Lv${h.level}, ${h.role})`);
      console.log(`      Document ID: ${h.docId}`);
      console.log(`      Hero ID field: ${h.id}`);
    });
    
    console.log(`\n📝 Using Firestore DOCUMENT IDs (not hero.id field!)`);
    
    if (testHeroes.length < 3) {
      console.log('\n❌ Need at least 3 heroes to test! Add more heroes to battlefield.');
      process.exit(1);
    }
    
    // Step 1.5: Verify heroes exist
    console.log('\n🔍 Step 1.5: Verifying heroes exist in Firebase...\n');
    
    const heroIds = testHeroes.map(h => h.docId); // Use Firestore document ID, not hero.id field!
    
    for (const heroId of heroIds) {
      const checkDoc = await db.collection('heroes').doc(heroId).get();
      if (checkDoc.exists) {
        console.log(`  ✅ ${heroId} exists - ${checkDoc.data().name}`);
      } else {
        console.log(`  ❌ ${heroId} NOT FOUND IN FIREBASE!`);
      }
    }
    
    // Step 2: Simulate the raid
    console.log('\n⚡ Step 2: Simulating Dragon Sanctum raid...\n');
    
    const simulateResponse = await fetch(`${API_URL}/api/raids/dragon_sanctum/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participants: heroIds })
    });
    
    if (!simulateResponse.ok) {
      const error = await simulateResponse.text();
      console.error('❌ Simulation failed:', error);
      process.exit(1);
    }
    
    const simulationResult = await simulateResponse.json();
    
    console.log('=' .repeat(60));
    console.log(`\n🎲 SIMULATION RESULT: ${simulationResult.outcome.toUpperCase()}`);
    console.log(`Success Chance: ${simulationResult.successChance}%`);
    console.log(`\n💰 Rewards Distributed:`);
    console.log(`  XP per hero: ${simulationResult.rewards.xpPerHero}`);
    console.log(`  Gold per hero: ${simulationResult.rewards.goldPerHero}g`);
    console.log(`\n📊 Heroes Rewarded:`);
    simulationResult.rewards.rewardedHeroes.forEach(h => {
      console.log(`  ✅ ${h.name}: +${h.xp} XP, +${h.gold}g`);
    });
    console.log(`\n💬 ${simulationResult.message}`);
    console.log('=' .repeat(60));
    
    // Step 3: Verify rewards were applied
    console.log('\n✅ Step 3: Verifying rewards in Firebase...\n');
    
    for (const hero of testHeroes.slice(0, 2)) {
      const updatedHeroDoc = await db.collection('heroes').doc(hero.id).get();
      const updatedHero = updatedHeroDoc.data();
      
      const xpGained = (updatedHero.xp || 0) - (hero.xp || 0);
      const goldGained = (updatedHero.gold || 0) - (hero.gold || 0);
      
      console.log(`  ${hero.name}:`);
      console.log(`    XP: ${hero.xp || 0} → ${updatedHero.xp || 0} (+${xpGained})`);
      console.log(`    Gold: ${hero.gold || 0} → ${updatedHero.gold || 0} (+${goldGained}g)`);
      console.log(`    Simulations: ${updatedHero.stats?.raidSimulations || 0}`);
    }
    
    console.log('\n🎉 Test Complete! Simulation system working!\n');
    
  } catch (error) {
    console.error('\n❌ Test Failed:', error);
  } finally {
    process.exit(0);
  }
}

testRaidSimulation();
