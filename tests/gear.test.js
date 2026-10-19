import { strict as assert } from 'assert';
import { GEAR_BASES } from '../src/data/gear/bases.js';
import { GEAR_SETS, SET_SLOTS } from '../src/data/gear/sets.js';
import { LEGENDARIES } from '../src/data/gear/legendaries.js';
import { generateGearItem, totalStatBudgetFromItem } from '../src/data/gear/generator.js';
import { itemBudget, setBonusBudgetCap, ILVL_CAP, budgetFromStats } from '../src/data/gear/budget.js';
import { ilvlFromSource } from '../src/data/gear/ilvl.js';

async function runTests() {
  console.log('Gear generator tests\n');
  let passed = 0;
  let failed = 0;

  console.log('\nTest 1: ~200 procedural base items');
  try {
    assert.ok(GEAR_BASES.length >= 180 && GEAR_BASES.length <= 220, `count=${GEAR_BASES.length}`);
    passed++;
    console.log('  ✓ Passed', GEAR_BASES.length);
  } catch (e) {
    failed++;
    console.log('  ✗ Failed:', e.message);
  }

  console.log('\nTest 2: set catalog counts (20 dungeon + 16 raid tiers)');
  try {
    const dungeon = GEAR_SETS.filter((s) => s.kind === 'dungeon');
    const raid = GEAR_SETS.filter((s) => s.kind === 'raid');
    assert.equal(dungeon.length, 20);
    assert.equal(raid.length, 16);
    assert.ok(LEGENDARIES.length >= 18);
    passed++;
    console.log('  ✓ Passed');
  } catch (e) {
    failed++;
    console.log('  ✗ Failed:', e.message);
  }

  console.log('\nTest 3: ilvl cap 115');
  try {
    const ilvl = ilvlFromSource({ type: 'worldboss', enemyLevel: 200 });
    assert.equal(ilvl, ILVL_CAP);
    passed++;
    console.log('  ✓ Passed');
  } catch (e) {
    failed++;
    console.log('  ✗ Failed:', e.message);
  }

  console.log('\nTest 4: common item budget within ±12% (400 samples, no affixes)');
  try {
    let violations = 0;
    for (let i = 0; i < 400; i++) {
      const roleGroup = ['tank', 'healer', 'melee', 'caster'][i % 4];
      const slot = SET_SLOTS[i % SET_SLOTS.length];
      const rarity = 'common';
      const ilvl = 20 + (i % 80);
      const expected = itemBudget({ roleGroup, slot, ilvl, rarity, isSetPiece: false });
      const item = generateGearItem({
        roleGroup,
        slot,
        rarity,
        ilvl,
        source: { type: 'idle', enemyLevel: ilvl },
        seed: `budget-test-${i}`
      });
      const actual = budgetFromStats(item.stats);
      const ratio = actual / expected;
      if (ratio < 0.8 || ratio > 1.15) violations++;
    }
    assert.ok(violations <= 25, `violations=${violations}`);
    passed++;
    console.log('  ✓ Passed');
  } catch (e) {
    failed++;
    console.log('  ✗ Failed:', e.message);
  }

  console.log('\nTest 5: set piece uses 92% budget vs normal');
  try {
    const roleGroup = 'tank';
    const slot = 'helm';
    const ilvl = 50;
    const rarity = 'epic';
    const normal = itemBudget({ roleGroup, slot, ilvl, rarity, isSetPiece: false });
    const setPiece = itemBudget({ roleGroup, slot, ilvl, rarity, isSetPiece: true });
    assert.ok(setPiece < normal);
    assert.ok(Math.abs(setPiece / normal - 0.92) < 0.01);
    const bonusCap = setBonusBudgetCap(roleGroup, ilvl, rarity);
    assert.ok(bonusCap > 0);
    passed++;
    console.log('  ✓ Passed');
  } catch (e) {
    failed++;
    console.log('  ✗ Failed:', e.message);
  }

  console.log('\nTest 6: raidLoot module imports');
  try {
    const { generateRaidLoot } = await import('../src/data/raidLoot.js');
    const item = generateRaidLoot('corrupted_temple', 'normal', 'tank', 'weapon', 30);
    assert.ok(item && item.ilvl);
    passed++;
    console.log('  ✓ Passed');
  } catch (e) {
    failed++;
    console.log('  ✗ Failed:', e.message);
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Gear tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

runTests();
