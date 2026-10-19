/**
 * Security hardening: client-trusted endpoints locked down (items 1–5).
 */

import request from 'supertest';
import { strict as assert } from 'assert';
import jwt from 'jsonwebtoken';
import { applyTestEnv, TEST_JWT_SECRET } from './setupTestEnv.js';

applyTestEnv();

const { app, db } = await import('../src/index.js');

function token(userId = 'hero-sec-1', twitchUserId = '9001') {
  return jwt.sign({ userId, twitchUserId, twitchUsername: 'secuser' }, TEST_JWT_SECRET, {
    expiresIn: '1h'
  });
}

async function runTests() {
  console.log('Security hardening tests\n');
  console.log('='.repeat(60));
  let passed = 0;
  let failed = 0;

  console.log('\nTest 1: loot-tokens award rejects player JWT');
  try {
    const res = await request(app)
      .post('/api/loot-tokens/award')
      .set('Authorization', `Bearer ${token()}`)
      .send({ userId: 'hero-sec-1', amount: 9999 });
    assert.equal(res.status, 401);
    console.log('  ✓ Passed');
    passed++;
  } catch (e) {
    console.log('  ✗ Failed:', e.message);
    failed++;
  }

  console.log('\nTest 2: loot-tokens award rejects non-positive amount with internal key');
  try {
    const res = await request(app)
      .post('/api/loot-tokens/award')
      .set('X-Internal-Key', process.env.INTERNAL_API_KEY)
      .send({ userId: 'hero-sec-1', amount: -5 });
    assert.equal(res.status, 400);
    console.log('  ✓ Passed');
    passed++;
  } catch (e) {
    console.log('  ✗ Failed:', e.message);
    failed++;
  }

  console.log('\nTest 3: equip rejects item not in inventory');
  try {
    const heroId = 'hero-equip-sec';
    await db.collection('heroes').doc(heroId).set({
      twitchUserId: '9001',
      inventory: [],
      equipment: {},
      gold: 0,
      level: 5
    });
    const res = await request(app)
      .post(`/api/professions/${heroId}/equip`)
      .set('Authorization', `Bearer ${token(heroId)}`)
      .send({
        slot: 'weapon',
        itemId: 'fake-legendary',
        item: { id: 'fake-legendary', attack: 99999, slot: 'weapon' }
      });
    assert.equal(res.status, 400);
    console.log('  ✓ Passed');
    passed++;
  } catch (e) {
    console.log('  ✗ Failed:', e.message);
    failed++;
  }

  console.log('\nTest 4: combat/xp rejects player JWT');
  try {
    const res = await request(app)
      .post('/api/battlefields/twitch:9001/combat/xp')
      .set('Authorization', `Bearer ${token()}`)
      .send({ baseXP: 50000, enemyLevel: 50, immediate: true });
    assert.equal(res.status, 403);
    console.log('  ✓ Passed');
    passed++;
  } catch (e) {
    console.log('  ✗ Failed:', e.message);
    failed++;
  }

  console.log('\nTest 5: worldboss create rejects player JWT');
  try {
    const res = await request(app)
      .post('/api/worldboss/create')
      .set('Authorization', `Bearer ${token()}`)
      .send({ hp: 999999999, attack: 99999 });
    assert.equal(res.status, 401);
    console.log('  ✓ Passed');
    passed++;
  } catch (e) {
    console.log('  ✗ Failed:', e.message);
    failed++;
  }

  console.log('\nTest 6: respec ignores client goldCost');
  try {
    const { respecSkillsForPlayer, DEFAULT_PLAYER_RESPEC_GOLD_COST } = await import(
      '../src/services/skillService.js'
    );
    assert.equal(DEFAULT_PLAYER_RESPEC_GOLD_COST, 250);
    const heroId = 'hero-respec-sec';
    await db.collection('heroes').doc(heroId).set({
      twitchUserId: '9001',
      level: 12,
      gold: 0,
      skillPoints: 0,
      skillPointsEarned: 4,
      skills: { berserker_skill_1: { points: 2 } }
    });
    let err;
    try {
      await respecSkillsForPlayer(heroId);
    } catch (e) {
      err = e;
    }
    assert.ok(err?.message?.includes('gold'));
    console.log('  ✓ Passed');
    passed++;
  } catch (e) {
    console.log('  ✗ Failed:', e.message);
    failed++;
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Security hardening tests: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

runTests();
