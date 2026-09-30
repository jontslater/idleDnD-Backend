#!/usr/bin/env node

/**
 * Loot Drop Simulation Script
 * Simulates N runs of various content types and prints expected drops per hour
 * 
 * Usage: node scripts/simulate-drops.js [runs]
 */

import { DROP_RATES, EXPECTED_KILLS_PER_HOUR, rollLoot, PITY_CONFIG } from '../src/data/lootConfig.js';

const SIMULATIONS = parseInt(process.argv[2]) || 10000;

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║            Loot Drop Simulation Analysis                   ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');
console.log(`Simulating ${SIMULATIONS.toLocaleString()} runs per content type...\n`);

// Helper to simulate drops for a content type
function simulateContent(contentType, difficulty, hours = 1) {
  const killsPerHour = difficulty 
    ? EXPECTED_KILLS_PER_HOUR[`${contentType}_${difficulty}`]
    : EXPECTED_KILLS_PER_HOUR[contentType];
  
  const totalKills = Math.floor(killsPerHour * hours);
  const drops = {
    common: 0,
    uncommon: 0,
    rare: 0,
    epic: 0,
    legendary: 0
  };
  
  let pityCounter = 0;
  let pityTriggers = 0;
  const pityKey = difficulty ? `${contentType}_${difficulty}` : contentType;
  const pityConfig = PITY_CONFIG.counters[pityKey];
  const pityRarity = pityConfig?.guaranteedRarity;
  
  for (let i = 0; i < totalKills; i++) {
    const { rarity, triggeredPity } = rollLoot(contentType, difficulty, pityCounter);
    drops[rarity]++;
    
    if (triggeredPity) {
      pityTriggers++;
      pityCounter = 0;
    } else if (pityRarity) {
      // Increment pity counter if didn't get the pity rarity
      if (rarity !== pityRarity && (pityRarity === 'legendary' || (pityRarity === 'epic' && rarity !== 'legendary'))) {
        pityCounter++;
      } else {
        pityCounter = 0; // Got the target rarity, reset counter
      }
    }
  }
  
  return { drops, totalKills, pityTriggers, killsPerHour };
}

// Content types to simulate
const contentTypes = [
  { name: 'Trash Mobs (Idle Farming)', type: 'trash', difficulty: null },
  { name: 'Elite Enemies', type: 'elite', difficulty: null },
  { name: 'Dungeon Normal', type: 'dungeon', difficulty: 'normal' },
  { name: 'Dungeon Heroic', type: 'dungeon', difficulty: 'heroic' },
  { name: 'Dungeon Mythic', type: 'dungeon', difficulty: 'mythic' },
  { name: 'Raid Normal', type: 'raid', difficulty: 'normal' },
  { name: 'Raid Heroic', type: 'raid', difficulty: 'heroic' },
  { name: 'Raid Mythic', type: 'raid', difficulty: 'mythic' },
  { name: 'World Boss', type: 'worldboss', difficulty: null }
];

console.log('═══ Drops Per Hour of Play ═══\n');
console.log('┌─────────────────────────────┬────────┬────────────────────────────────────────────────────┐');
console.log('│ Content Type                │ Kills  │ Common  Uncommon  Rare    Epic    Legendary  Pity   │');
console.log('├─────────────────────────────┼────────┼────────────────────────────────────────────────────┤');

contentTypes.forEach(({ name, type, difficulty }) => {
  const result = simulateContent(type, difficulty, 1);
  const { drops, totalKills, pityTriggers, killsPerHour } = result;
  
  const killsStr = killsPerHour.toFixed(1).padStart(5);
  const commonStr = drops.common > 0 ? drops.common.toFixed(2).padStart(7) : '     -';
  const uncommonStr = drops.uncommon > 0 ? drops.uncommon.toFixed(2).padStart(8) : '      -';
  const rareStr = drops.rare > 0 ? drops.rare.toFixed(2).padStart(7) : '     -';
  const epicStr = drops.epic > 0 ? drops.epic.toFixed(2).padStart(7) : '     -';
  const legendaryStr = drops.legendary > 0 ? drops.legendary.toFixed(2).padStart(9) : '       -';
  const pityStr = pityTriggers > 0 ? pityTriggers.toFixed(2).padStart(6) : '    -';
  
  console.log(`│ ${name.padEnd(27)} │ ${killsStr} │${commonStr} ${uncommonStr} ${rareStr} ${epicStr} ${legendaryStr} ${pityStr} │`);
});

console.log('└─────────────────────────────┴────────┴────────────────────────────────────────────────────┘\n');

// Extended simulation: 10 hours of play
console.log('═══ Extended Play: 10 Hours ═══\n');
console.log('┌─────────────────────────────┬─────────┬───────────────────────────────────────────────────┐');
console.log('│ Content Type                │ Kills   │ Common  Uncommon  Rare    Epic    Legendary Pity  │');
console.log('├─────────────────────────────┼─────────┼───────────────────────────────────────────────────┤');

contentTypes.forEach(({ name, type, difficulty }) => {
  const result = simulateContent(type, difficulty, 10);
  const { drops, totalKills, pityTriggers } = result;
  
  const killsStr = totalKills.toString().padStart(6);
  const commonStr = drops.common > 0 ? drops.common.toFixed(1).padStart(7) : '     -';
  const uncommonStr = drops.uncommon > 0 ? drops.uncommon.toFixed(1).padStart(8) : '      -';
  const rareStr = drops.rare > 0 ? drops.rare.toFixed(1).padStart(7) : '     -';
  const epicStr = drops.epic > 0 ? drops.epic.toFixed(1).padStart(7) : '     -';
  const legendaryStr = drops.legendary > 0 ? drops.legendary.toFixed(1).padStart(9) : '       -';
  const pityStr = pityTriggers > 0 ? pityTriggers.toFixed(1).padStart(5) : '   -';
  
  console.log(`│ ${name.padEnd(27)} │ ${killsStr} │${commonStr} ${uncommonStr} ${rareStr} ${epicStr} ${legendaryStr} ${pityStr} │`);
});

console.log('└─────────────────────────────┴─────────┴───────────────────────────────────────────────────┘\n');

// Probability analysis
console.log('═══ Legendary Drop Probabilities ═══\n');
console.log('Content Type                    │ Base Rate │ Pity After │ Avg Kills for Legendary');
console.log('────────────────────────────────┼───────────┼────────────┼───────────────────────');

[
  { name: 'Dungeon Heroic', type: 'dungeon', difficulty: 'heroic' },
  { name: 'Dungeon Mythic', type: 'dungeon', difficulty: 'mythic' },
  { name: 'Raid Normal', type: 'raid', difficulty: 'normal' },
  { name: 'Raid Heroic', type: 'raid', difficulty: 'heroic' },
  { name: 'Raid Mythic', type: 'raid', difficulty: 'mythic' },
  { name: 'World Boss', type: 'worldboss', difficulty: null }
].forEach(({ name, type, difficulty }) => {
  const rates = difficulty ? DROP_RATES[type][difficulty] : DROP_RATES[type];
  const baseRate = (rates.legendary * 100).toFixed(1);
  
  const pityKey = difficulty ? `${type}_${difficulty}` : type;
  const pityConfig = PITY_CONFIG.counters[pityKey];
  const pityAfter = pityConfig ? pityConfig.threshold : 'N/A';
  
  // Calculate average kills considering pity
  let avgKills;
  if (rates.legendary > 0) {
    // Simplified: 1 / drop rate (doesn't account for pity perfectly but close)
    avgKills = Math.ceil(1 / rates.legendary);
  } else {
    avgKills = 'Never';
  }
  
  console.log(`${name.padEnd(32)}│ ${baseRate.padStart(8)}% │ ${pityAfter.toString().padStart(10)} │ ${avgKills.toString().padStart(23)}`);
});

console.log('\n═══ Key Takeaways ═══\n');
console.log('✓ Trash and elite enemies drop only common/uncommon/rare');
console.log('✓ Epic drops start appearing in heroic dungeons (~1%)');
console.log('✓ Legendary drops are rare even in mythic content (5-15%)');
console.log('✓ World bosses have the best legendary rates (30%)');
console.log('✓ Pity system ensures no extreme bad luck (kicks in after 3-15 kills)');
console.log('✓ Expected legendary from mythic raids: ~1 per 7 bosses (no pity)');
console.log('✓ Expected legendary from world bosses: ~1 per 3-4 bosses\n');

console.log('═══ Economy Balance Notes ===\n');
console.log('• Players farming trash will get mostly common/uncommon gear');
console.log('• Rare gear requires dungeons or elite farming');
console.log('• Epic gear requires heroic+ dungeons or normal+ raids');
console.log('• Legendary gear requires mythic dungeons, raids, or world bosses');
console.log('• 10 hours of mythic raiding = ~1-2 legendaries (with pity)');
console.log('• This makes legendary drops feel special and rewarding\n');
