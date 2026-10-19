import { strict as assert } from 'assert';
import {
  g,
  xpToNextLevel,
  damageReductionFromArmor,
  chatDamageHealMultiplier,
  enemyStats,
  combatKillBaseXp,
  cumulativeIdleHoursToLevel,
  XP_LEVEL_COEFFICIENT,
  COMBAT_CAPS,
  deriveHeroCombatStats
} from '../src/data/balance.js';
import { KILL_DROP_CHANCES } from '../src/data/lootConfig.js';

function approx(a, b, eps = 0.02) {
  return Math.abs(a - b) <= eps;
}

async function runTests() {
  console.log('Balance formula tests\n');
  let passed = 0;
  let failed = 0;

  const run = (name, fn) => {
    console.log(`\n${name}`);
    try {
      fn();
      console.log('  ✓ Passed');
      passed++;
    } catch (e) {
      console.log('  ✗ Failed:', e.message);
      failed++;
    }
  };

  run('g(L) growth', () => {
    assert.equal(g(1), 1);
    assert(approx(g(50), 5.9));
    assert(approx(g(100), 10.9));
  });

  run('xpToNext uses coefficient 60', () => {
    assert.equal(XP_LEVEL_COEFFICIENT, 60);
    const l10 = xpToNextLevel(10);
    const l25 = xpToNextLevel(25);
    const l50 = xpToNextLevel(50);
    const l99 = xpToNextLevel(99);
    assert(l10 > 1500 && l10 < 1700, `L10 xp ${l10}`);
    assert(l25 > 7500 && l25 < 8500, `L25 xp ${l25}`);
    assert(l50 > 28000 && l50 < 32000, `L50 xp ${l50}`);
    assert(l99 > 110000 && l99 < 130000, `L99 xp ${l99}`);
  });

  run('cumulative idle hours toward L100', () => {
    const { hours } = cumulativeIdleHoursToLevel(100);
    assert(hours > 140 && hours < 220, `expected ~175h idle, got ${hours.toFixed(1)}`);
  });

  run('armor DR capped at 75%', () => {
    const dr = damageReductionFromArmor(99999, 50);
    assert.equal(dr, COMBAT_CAPS.damageReduction);
    const tank = deriveHeroCombatStats({
      role: 'tank',
      classKey: 'guardian',
      level: 25,
      gearRarity: 'rare',
      itemLevel: 25
    });
    const drTank = damageReductionFromArmor(tank.armor, 25);
    assert(drTank > 0.4 && drTank < 0.65);
  });

  run('chat boost +2% per chatter cap 20%', () => {
    assert.equal(chatDamageHealMultiplier(0), 1);
    assert(approx(chatDamageHealMultiplier(5), 1.1));
    assert(approx(chatDamageHealMultiplier(10), 1.2));
    assert(approx(chatDamageHealMultiplier(100), 1.2));
  });

  run('enemy raid boss scales with party', () => {
    const five = enemyStats(50, 'raidBoss', 5);
    const ten = enemyStats(50, 'raidBoss', 10);
    assert(ten.hp > five.hp);
  });

  run('kill drop chances authoritative 8%', () => {
    assert.equal(KILL_DROP_CHANCES.normal, 0.08);
    assert.equal(combatKillBaseXp(25, 'normal'), Math.floor(12 * g(25)));
  });

  run('GET /api/balance payload builds', async () => {
    const { buildBalanceJsonObject } = await import('../src/data/balance.js');
    const json = buildBalanceJsonObject();
    assert.equal(json.version, 1);
    assert(json.sampleXpToNext[10] > 0);
    assert(json.loot.normalKillDropChance === 0.08);
  });

  console.log('\n' + '='.repeat(60));
  console.log(`Balance tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

runTests();
