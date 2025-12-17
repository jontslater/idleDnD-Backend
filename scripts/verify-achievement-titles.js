// Script to verify all achievement titles match what's in achievements.js
import { ACHIEVEMENTS } from '../src/data/achievements.js';

console.log('=== Achievement Titles Verification ===\n');

const titles = ACHIEVEMENTS
  .filter(a => a.rewards?.title)
  .map(a => ({
    achievementId: a.id,
    achievementName: a.name,
    title: a.rewards.title,
    category: a.category,
    rarity: a.rarity
  }));

console.log(`Total achievements with titles: ${titles.length}\n`);

console.log('All Achievement Titles:');
console.log('=====================');
titles.forEach((t, i) => {
  console.log(`${i + 1}. "${t.title}" (from "${t.achievementName}" - ${t.achievementId})`);
});

console.log('\n=== Checking for "Rampage" ===');
const rampage = titles.find(t => t.title === 'Rampage');
if (rampage) {
  console.log('✅ "Rampage" title found!');
  console.log(`   Achievement: ${rampage.achievementName} (${rampage.achievementId})`);
  console.log(`   Category: ${rampage.category}, Rarity: ${rampage.rarity}`);
} else {
  console.log('❌ "Rampage" title NOT found in achievements!');
}

console.log('\n=== Title List (for comparison) ===');
const titleList = titles.map(t => t.title).sort();
console.log(titleList.join(', '));


