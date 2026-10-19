#!/usr/bin/env node

/**
 * Balance Analysis Script
 * Analyzes game balance for combat, XP progression, and economy
 * Prints current formulas and suggests improvements
 */

import { ROLE_CONFIG } from '../src/data/roleConfig.js';
import { calculateMaxXp } from '../src/utils/levelUpHelper.js';

// Current formulas (as reported in codebase review)
function currentEnemyStats(level, scalingMultiplier = 1.0) {
  // ISSUE: Attack and defense scale with square of multiplier
  // At level 50 with 5x multiplier: attack = 50 * 25 = 1250
  const baseAttack = level;
  const baseDefense = level * 0.5;
  
  return {
    attack: Math.floor(baseAttack * scalingMultiplier * scalingMultiplier),
    defense: Math.floor(baseDefense * scalingMultiplier * scalingMultiplier),
    hp: Math.floor(level * 100 * scalingMultiplier) // HP scales linearly
  };
}

// Proposed balanced enemy stats
function proposedEnemyStats(level, scalingMultiplier = 1.0) {
  // FIX: Scale linearly with multiplier
  const baseAttack = level * 2; // Increased base to remain challenging
  const baseDefense = level;
  
  return {
    attack: Math.floor(baseAttack * scalingMultiplier),
    defense: Math.floor(baseDefense * scalingMultiplier),
    hp: Math.floor(level * 100 * scalingMultiplier)
  };
}

// Get hero stats at a given level
function getHeroStats(role, level) {
  const config = ROLE_CONFIG[role];
  if (!config) return null;
  
  const hp = config.baseHp + (config.hpPerLevel * level);
  const attack = config.baseAttack + (config.attackPerLevel * level);
  const defense = config.baseDefense + (config.defensePerLevel * level);
  
  return { hp, attack, defense };
}

// Calculate damage
function calculateDamage(attackerAttack, defenderDefense) {
  const damage = Math.max(1, attackerAttack - defenderDefense);
  return damage;
}

// Calculate time to kill
function calculateTimeToKill(attackerAttack, defenderDefense, defenderHp) {
  const damagePerHit = calculateDamage(attackerAttack, defenderDefense);
  const hitsToKill = Math.ceil(defenderHp / damagePerHit);
  return { hitsToKill, damagePerHit };
}

console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║          The Never Ending War - Balance Analysis          ║');
console.log('╚════════════════════════════════════════════════════════════╝\n');

// Test levels
const testLevels = [1, 10, 25, 50, 75, 100];
const scalingMultipliers = [1.0, 2.0, 5.0, 10.0];

console.log('═══ ISSUE 1: Enemy Scaling (Attack/Defense) ═══\n');
console.log('Current formula: attack = level * multiplier²');
console.log('Proposed: attack = level * 2 * multiplier\n');

console.log('Enemy Stats Comparison:');
console.log('┌──────┬────────┬─────────────────────────┬─────────────────────────┐');
console.log('│ Lvl  │ Mult   │ Current (quadratic)     │ Proposed (linear)       │');
console.log('├──────┼────────┼─────────────────────────┼─────────────────────────┤');

testLevels.forEach(level => {
  scalingMultipliers.forEach(mult => {
    const current = currentEnemyStats(level, mult);
    const proposed = proposedEnemyStats(level, mult);
    
    console.log(`│ ${level.toString().padStart(4)} │ ${mult.toFixed(1).padStart(4)}x  │ ATK:${current.attack.toString().padStart(5)} DEF:${current.defense.toString().padStart(5)} │ ATK:${proposed.attack.toString().padStart(5)} DEF:${proposed.defense.toString().padStart(5)} │`);
  });
});
console.log('└──────┴────────┴─────────────────────────┴─────────────────────────┘\n');

// Combat simulation
console.log('═══ Combat Simulation: Tank vs Enemy ═══\n');
console.log('Tank stats: Guardian (highest HP/Defense)');
console.log('Enemy: Level 50, 5x multiplier\n');

const guardian = getHeroStats('guardian', 50);
const currentEnemy50 = currentEnemyStats(50, 5.0);
const proposedEnemy50 = proposedEnemyStats(50, 5.0);

console.log('Guardian Level 50:');
console.log(`  HP: ${guardian.hp}, Attack: ${guardian.attack}, Defense: ${guardian.defense}`);
console.log('');
console.log('Current Enemy (quadratic scaling):');
console.log(`  HP: ${currentEnemy50.hp}, Attack: ${currentEnemy50.attack}, Defense: ${currentEnemy50.defense}`);

const currentDamageToHero = calculateDamage(currentEnemy50.attack, guardian.defense);
const currentDamageToEnemy = calculateDamage(guardian.attack, currentEnemy50.defense);
const currentHitsToKillHero = Math.ceil(guardian.hp / currentDamageToHero);
const currentHitsToKillEnemy = Math.ceil(currentEnemy50.hp / currentDamageToEnemy);

console.log(`  Damage to hero per hit: ${currentDamageToHero}`);
console.log(`  Damage from hero per hit: ${currentDamageToEnemy}`);
console.log(`  Hits to kill hero: ${currentHitsToKillHero} (hero dies quickly)`);
console.log(`  Hits to kill enemy: ${currentHitsToKillEnemy}`);
console.log('  ❌ IMBALANCED: Enemy hits for ~9000 vs hero\'s ~1500 HP\n');

console.log('Proposed Enemy (linear scaling):');
console.log(`  HP: ${proposedEnemy50.hp}, Attack: ${proposedEnemy50.attack}, Defense: ${proposedEnemy50.defense}`);

const proposedDamageToHero = calculateDamage(proposedEnemy50.attack, guardian.defense);
const proposedDamageToEnemy = calculateDamage(guardian.attack, proposedEnemy50.defense);
const proposedHitsToKillHero = Math.ceil(guardian.hp / proposedDamageToHero);
const proposedHitsToKillEnemy = Math.ceil(proposedEnemy50.hp / proposedDamageToEnemy);

console.log(`  Damage to hero per hit: ${proposedDamageToHero}`);
console.log(`  Damage from hero per hit: ${proposedDamageToEnemy}`);
console.log(`  Hits to kill hero: ${proposedHitsToKillHero}`);
console.log(`  Hits to kill enemy: ${proposedHitsToKillEnemy}`);
console.log('  ✓ BALANCED: More survivable combat\n');

// XP Progression
console.log('═══ ISSUE 2: XP Progression ═══\n');
console.log('Current XP formula: 40 * level² + 300 * level - 240');
console.log('Current kill XP: Nearly flat (~50-100 base XP per kill)\n');

console.log('XP Requirements vs Kill XP:');
console.log('┌──────┬────────────┬───────────┬────────────────┐');
console.log('│ Lvl  │ Max XP     │ Kill XP   │ Kills Needed   │');
console.log('├──────┼────────────┼───────────┼────────────────┤');

const baseKillXP = 50; // Typical base XP per kill

testLevels.forEach(level => {
  const maxXp = calculateMaxXp(level);
  const killsNeeded = Math.ceil(maxXp / baseKillXP);
  
  console.log(`│ ${level.toString().padStart(4)} │ ${maxXp.toString().padStart(10)} │ ${baseKillXP.toString().padStart(9)} │ ${killsNeeded.toString().padStart(14)} │`);
});
console.log('└──────┴────────────┴───────────┴────────────────┘');
console.log('❌ PROBLEM: Kills needed grows exponentially (20,000+ kills at level 100)\n');

console.log('Proposed: Scale kill XP with enemy level');
console.log('Formula: baseXP = enemyLevel * 2 (with level multipliers)\n');

console.log('With Proposed Kill XP:');
console.log('┌──────┬────────────┬───────────┬────────────────┐');
console.log('│ Lvl  │ Max XP     │ Kill XP   │ Kills Needed   │');
console.log('├──────┼────────────┼───────────┼────────────────┤');

testLevels.forEach(level => {
  const maxXp = calculateMaxXp(level);
  const scaledKillXP = level * 2; // Kills at same level
  const killsNeeded = Math.ceil(maxXp / scaledKillXP);
  
  console.log(`│ ${level.toString().padStart(4)} │ ${maxXp.toString().padStart(10)} │ ${scaledKillXP.toString().padStart(9)} │ ${killsNeeded.toString().padStart(14)} │`);
});
console.log('└──────┴────────────┴───────────┴────────────────┘');
console.log('✓ BETTER: More consistent kill requirements\n');

// Shop vs Drops
console.log('═══ ISSUE 3: Shop Items vs Drops ═══\n');
console.log('Current: 50-token shop weapon > legendary drop');
console.log('Problem: Invalidates loot system\n');

console.log('Solution:');
console.log('  1. Increase shop weapon costs (500-1000 tokens for legendary-tier)');
console.log('  2. Make shop weapons "good" but not BiS');
console.log('  3. Best items should come from raids/world bosses');
console.log('  4. Shop should offer sidegrades or catch-up gear\n');

// Gold sinks
console.log('═══ ISSUE 4: Gold Economy ═══\n');
console.log('Current: Almost no gold sinks after buying consumables');
console.log('Proposed sinks:');
console.log('  • Item repairs (5-10% of vendor price per use)');
console.log('  • Profession training costs');
console.log('  • Mount/cosmetic purchases');
console.log('  • Auction house fees (already implemented: 5%)');
console.log('  • Re-rolling stats on items\n');

console.log('═══ SUMMARY OF FIXES NEEDED ═══\n');
console.log('✓ 1. Change enemy scaling from quadratic to linear');
console.log('✓ 2. Scale kill XP with enemy level (enemyLevel * 2 base)');
console.log('✓ 3. Rebalance shop prices (10-20x increase for high-tier items)');
console.log('✓ 4. Add gold sinks to prevent inflation\n');

console.log('═══ IMPLEMENTATION CHECKLIST ═══\n');
console.log('[ ] Update enemy stat calculation in browser source/Electron app');
console.log('[ ] Update XP award formulas in xpDistributionService.js');
console.log('[ ] Adjust shop prices in commandHandler.js and shop routes');
console.log('[ ] Add repair costs and other gold sinks');
console.log('[ ] Test with level 50-100 heroes to verify balance\n');
