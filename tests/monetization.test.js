/**
 * Founder / paid perks must not affect gameplay rewards.
 */

import { strict as assert } from 'assert';
import { applyTestEnv } from './setupTestEnv.js';

applyTestEnv();
import {
  getPaidGameplayRewardMultiplier,
  getIdleTokensPerHour,
  computeIdleClaimTokens,
  buildFounderPackCosmeticUpdate,
  IDLE_TOKENS_PER_HOUR
} from '../src/utils/monetization.js';
function heroWithFounder(tier) {
  return {
    id: 'h1',
    level: 50,
    founderPackTier: tier,
    founderPackTierLevel: 4,
    tokens: 100
  };
}

function plainHero() {
  return { id: 'h2', level: 50, tokens: 100 };
}

async function runTests() {
  console.log('Monetization / Founder Cosmetic Tests\n');
  console.log('='.repeat(60));

  let passed = 0;
  let failed = 0;

  console.log('\nTest 1: gameplay multipliers ignore founder tier');
  try {
    assert.equal(getPaidGameplayRewardMultiplier(heroWithFounder('platinum'), 'gold'), 1);
    assert.equal(getPaidGameplayRewardMultiplier(heroWithFounder('platinum'), 'xp'), 1);
    assert.equal(getPaidGameplayRewardMultiplier(heroWithFounder('platinum'), 'loot'), 1);
    console.log('  ✓ Passed');
    passed++;
  } catch (e) {
    console.log('  ✗ Failed:', e.message);
    failed++;
  }

  console.log('\nTest 2: idle claim rate unchanged for founders');
  try {
    const hours = 10;
    const a = computeIdleClaimTokens(hours, heroWithFounder('gold'));
    const b = computeIdleClaimTokens(hours, plainHero());
    assert.equal(a, b);
    assert.equal(getIdleTokensPerHour(heroWithFounder('gold')), IDLE_TOKENS_PER_HOUR);
    console.log('  ✓ Passed');
    passed++;
  } catch (e) {
    console.log('  ✗ Failed:', e.message);
    failed++;
  }

  console.log('\nTest 3: XP distribution equal for founder vs non-founder');
  try {
    const { calculateXPDistribution } = await import('../src/services/xpDistributionService.js');
    const baseXP = 1000;
    const enemyLevel = 50;
    const distFounder = calculateXPDistribution(baseXP, enemyLevel, [heroWithFounder('platinum')]);
    const distPlain = calculateXPDistribution(baseXP, enemyLevel, [plainHero()]);
    assert.equal(distFounder[0].xpGained, distPlain[0].xpGained);
    console.log('  ✓ Passed');
    passed++;
  } catch (e) {
    console.log('  ✗ Failed:', e.message);
    failed++;
  }

  console.log('\nTest 4: founder purchase grants cosmetics not tokens');
  try {
    const hero = { tokens: 50, unlockedTitles: [] };
    const update = buildFounderPackCosmeticUpdate(hero, 'silver', 2);
    assert.equal(update.founderPackTier, 'silver');
    assert.equal(update.founderPackTierLevel, 2);
    assert.equal(update.tokens, undefined);
    assert.equal(update.cosmetics.founderBadge, 'silver');
    console.log('  ✓ Passed');
    passed++;
  } catch (e) {
    console.log('  ✗ Failed:', e.message);
    failed++;
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Monetization tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

runTests();
