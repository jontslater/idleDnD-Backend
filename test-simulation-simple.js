import fetch from 'node-fetch';

const API_URL = 'http://localhost:3001';

async function testSimulation() {
  try {
    console.log('\n🧪 Testing Raid Simulation (Simplified)\n');
    
    // Use CORRECT Firestore document IDs
    const heroIds = [
      '0UgvWSOqQMFCklWylsp7', // theneverendingwar (verified exists)
      'VjQrMq10rdy6EMDaXceV', // tehchno
      'SKmsK4B8ZgSo6MlYtXgs'  // FloodWater_
    ];
    
    console.log('✅ Using verified Firestore document IDs (not hero.id field!)');
    
    console.log('📋 Testing with hero IDs:', heroIds);
    console.log('\n⚡ Simulating Dragon Sanctum...\n');
    
    const response = await fetch(`${API_URL}/api/raids/dragon_sanctum/simulate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ participants: heroIds })
    });
    
    if (!response.ok) {
      const error = await response.json();
      console.error('❌ Failed:', error);
      process.exit(1);
    }
    
    const result = await response.json();
    
    console.log('=' .repeat(60));
    console.log(`\n🎲 RESULT: ${result.outcome.toUpperCase()}`);
    console.log(`Success Chance: ${result.successChance}%\n`);
    console.log(`💰 Rewards:`);
    console.log(`  XP per hero: ${result.rewards.xpPerHero}`);
    console.log(`  Gold per hero: ${result.rewards.goldPerHero}g\n`);
    console.log(`📊 Heroes Rewarded:`);
    result.rewards.rewardedHeroes.forEach(h => {
      console.log(`  ✅ ${h.name}: +${h.xp} XP, +${h.gold}g`);
    });
    console.log(`\n💬 ${result.message}`);
    console.log('=' .repeat(60));
    console.log('\n🎉 Simulation Test Complete!\n');
    
  } catch (error) {
    console.error('\n❌ Error:', error);
  }
}

testSimulation();
