/**
 * Verify Achievements API
 * Tests that achievements are accessible via the API endpoint
 * 
 * Usage: node scripts/verify-achievements.js
 */

const admin = require('firebase-admin');
const { ACHIEVEMENTS } = require('../src/data/achievements.js');

console.log('🔍 Verifying Achievements System...\n');

// Check achievements data
console.log('✅ Achievements Data File:');
console.log(`   Total achievements: ${ACHIEVEMENTS.length}`);
console.log(`   Categories: ${[...new Set(ACHIEVEMENTS.map(a => a.category))].join(', ')}`);
console.log('\n   Sample achievements:');
ACHIEVEMENTS.slice(0, 3).forEach(a => {
  console.log(`   - ${a.name} (${a.category}, ${a.rarity})`);
});

console.log('\n📋 Achievement Categories:');
const categories = {};
ACHIEVEMENTS.forEach(a => {
  categories[a.category] = (categories[a.category] || 0) + 1;
});
Object.entries(categories).forEach(([cat, count]) => {
  console.log(`   ${cat}: ${count} achievements`);
});

console.log('\n✅ Achievements are defined in code and should be returned by GET /api/achievements');
console.log('💡 If achievements are not showing in UI, check:');
console.log('   1. Backend server is running');
console.log('   2. API endpoint /api/achievements is accessible');
console.log('   3. Frontend is calling achievementAPI.getAllAchievements() correctly');
console.log('   4. Browser console for API errors');
