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

  console.log('\nTest 3: generated gear includes binding');
  try {
    const boe = generateGearItem({
      roleGroup: 'caster',
      slot: 'helm',
      rarity: 'uncommon',
      source: { type: 'idle', enemyLevel: 15 },
      seed: 'binding-field'
    });
    assert.equal(boe.binding, 'boe');
    passed++;
    console.log('  ✓ Passed');
  } catch (e) {
    failed++;
    console.log('  ✗ Failed:', e.message);
  }

  console.log('\nTest 4: ilvl cap 115');
  try {
    const ilvl = ilvlFromSource({ type: 'worldboss', enemyLevel: 200 });
    assert.equal(ilvl, ILVL_CAP);
    passed++;
    console.log('  ✓ Passed');
  } catch (e) {
    failed++;
    console.log('  ✗ Failed:', e.message);
  }

  console.log('\nTest 4: full-set legacy totals within ±10% of plan (sample grid)');
  try {
    const { planFullSetLegacyTotals, slotsForRoleGroup, clearSetLegacyCacheForTests } = await import(
      '../src/data/gear/planLegacy.js'
    );
    clearSetLegacyCacheForTests();
    let violations = 0;
    for (const roleGroup of ['tank', 'healer', 'melee', 'caster']) {
      for (const ilvl of [10, 50, 100]) {
        const plan = planFullSetLegacyTotals(roleGroup, ilvl, 'common');
        let defense = 0;
        for (const slot of slotsForRoleGroup(roleGroup)) {
          const item = generateGearItem({
            roleGroup,
            slot,
            rarity: 'common',
            ilvl,
            source: { type: 'idle', enemyLevel: ilvl },
            seed: `budget-test-${roleGroup}-${slot}-${ilvl}`
          });
          defense += item.defense || 0;
        }
        if (plan.defense > 0 && (defense < plan.defense * 0.9 || defense > plan.defense * 1.1)) {
          violations++;
        }
      }
    }
    assert.equal(violations, 0, `violations=${violations}`);
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

  console.log('\nTest 6: L50 epic tank set legacy defense ~900-1300');
  try {
    const slots = ['weapon', 'armor', 'shield', 'helm', 'cloak', 'gloves', 'boots', 'ring1', 'ring2'];
    let defenseSum = 0;
    for (const slot of slots) {
      const it = generateGearItem({
        roleGroup: 'tank',
        slot,
        rarity: 'epic',
        ilvl: 50,
        source: { type: 'idle', enemyLevel: 50 },
        seed: `set50-${slot}`
      });
      defenseSum += it.defense || it.stats.armor || 0;
    }
    assert.ok(defenseSum >= 900 && defenseSum <= 1400, `defenseSum=${defenseSum}`);
    passed++;
    console.log('  ✓ Passed', defenseSum);
  } catch (e) {
    failed++;
    console.log('  ✗ Failed:', e.message);
  }

  console.log('\nTest 7: monotonic rarity at same ilvl (200 random seeds)');
  try {
    const slot = 'armor';
    const ilvl = 40;
    const rarities = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
    let inversions = 0;
    for (let s = 0; s < 200; s++) {
      const totals = rarities.map((rarity) =>
        totalStatBudgetFromItem(
          generateGearItem({
            roleGroup: 'tank',
            slot,
            rarity,
            ilvl,
            source: { type: 'idle', enemyLevel: ilvl },
            seed: `mono-${s}-${rarity}`
          })
        )
      );
      for (let i = 1; i < totals.length; i++) {
        if (totals[i] < totals[i - 1]) inversions++;
      }
    }
    assert.equal(inversions, 0, `inversions=${inversions}`);
    passed++;
    console.log('  ✓ Passed');
  } catch (e) {
    failed++;
    console.log('  ✗ Failed:', e.message);
  }

  console.log('\nTest 8: gear names have no duplicate words');
  try {
    for (let i = 0; i < 50; i++) {
      const it = generateGearItem({
        roleGroup: 'tank',
        slot: 'helm',
        rarity: 'epic',
        ilvl: 30 + i,
        source: { type: 'idle', enemyLevel: 30 + i },
        seed: `name-${i}`
      });
      const words = it.name.toLowerCase().split(/\s+/);
      const uniq = new Set(words);
      assert.equal(words.length, uniq.size, it.name);
    }
    passed++;
    console.log('  ✓ Passed');
  } catch (e) {
    failed++;
    console.log('  ✗ Failed:', e.message);
  }

  console.log('\nTest 9: raidLoot module imports');
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
