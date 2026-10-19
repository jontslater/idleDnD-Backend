/**
 * Item binding: bop / boe / account / none — generator + route enforcement.
 */

import request from 'supertest';
import { strict as assert } from 'assert';
import jwt from 'jsonwebtoken';
import { applyTestEnv, TEST_JWT_SECRET } from './setupTestEnv.js';
import { generateGearItem } from '../src/data/gear/generator.js';
import { GEAR_SETS } from '../src/data/gear/sets.js';
import {
  applyBindOnEquip,
  bindingForGeneratedGear,
  bindingViolation,
  inferDefaultBinding,
  isPlayerTradable,
  resolveBinding
} from '../src/utils/itemBinding.js';

applyTestEnv();

const { app, db } = await import('../src/index.js');

function token(heroId, twitchUserId = 'bind-9001') {
  return jwt.sign({ userId: heroId, twitchUserId, twitchUsername: 'binduser' }, TEST_JWT_SECRET, {
    expiresIn: '1h'
  });
}

function gear(binding, overrides = {}) {
  return {
    id: overrides.id || `gear-${binding}-${Math.random().toString(36).slice(2, 8)}`,
    name: overrides.name || 'Test Blade',
    slot: 'weapon',
    rarity: 'rare',
    binding,
    attack: 10,
    ...overrides
  };
}

async function runTests() {
  console.log('Item binding tests\n');
  let passed = 0;
  let failed = 0;

  console.log('\nTest 1: generator binding by source');
  try {
    const idle = generateGearItem({
      roleGroup: 'melee',
      slot: 'weapon',
      rarity: 'rare',
      source: { type: 'idle', enemyLevel: 30 },
      seed: 'bind-idle'
    });
    const raid = generateGearItem({
      roleGroup: 'melee',
      slot: 'weapon',
      rarity: 'rare',
      source: { type: 'raid', enemyLevel: 80 },
      seed: 'bind-raid',
      setId: GEAR_SETS[0].id,
      isSetPiece: true
    });
    assert.equal(idle.binding, 'boe');
    assert.equal(raid.binding, 'bop');
    passed++;
    console.log('  ✓ Passed');
  } catch (e) {
    failed++;
    console.log('  ✗ Failed:', e.message);
  }

  console.log('\nTest 2: legacy infer + bind on equip');
  try {
    assert.equal(inferDefaultBinding({ slot: 'helm', name: 'Old Helm' }), 'bop');
    assert.equal(inferDefaultBinding({ name: 'Iron Ore', type: 'material', quantity: 5 }), 'none');
    const boe = gear('boe');
    const equipped = applyBindOnEquip(boe);
    assert.equal(equipped.binding, 'bop');
    assert.equal(equipped.soulboundFromEquip, true);
    assert.equal(isPlayerTradable(equipped), false);
    passed++;
    console.log('  ✓ Passed');
  } catch (e) {
    failed++;
    console.log('  ✗ Failed:', e.message);
  }

  const heroId = 'hero-binding';
  const recipientTwitch = 'bind-recipient';
  await db.collection('heroes').doc(heroId).set({
    twitchUserId: 'bind-9001',
    gold: 500,
    inventory: [
      gear('bop', { id: 'bop-1', name: 'Soulbound Cleaver' }),
      gear('boe', { id: 'boe-1', name: 'Tradeable Cleaver' }),
      { id: 'mat-1', name: 'Copper Ore', type: 'material', quantity: 10, binding: 'none' },
      { id: 'acct-1', name: 'Founder Cloak', slot: 'cloak', binding: 'account', cosmeticId: 'founder-cloak' }
    ],
    equipment: {},
    level: 20
  });
  await db.collection('heroes').doc('hero-binding-recipient').set({
    twitchUserId: recipientTwitch,
    gold: 0,
    inventory: [],
    level: 5
  });

  console.log('\nTest 3: mail rejects bop gear');
  try {
    const res = await request(app)
      .post('/api/mail/send')
      .set('Authorization', `Bearer ${token(heroId)}`)
      .send({
        senderId: 'bind-9001',
        senderHeroId: heroId,
        recipientId: recipientTwitch,
        subject: 'trade',
        message: 'hi',
        items: [{ itemId: 'bop-1', quantity: 1 }],
        codAmount: 0
      });
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'ITEM_NOT_TRADEABLE');
    passed++;
    console.log('  ✓ Passed');
  } catch (e) {
    failed++;
    console.log('  ✗ Failed:', e.message);
  }

  console.log('\nTest 4: mail allows boe gear');
  try {
    const res = await request(app)
      .post('/api/mail/send')
      .set('Authorization', `Bearer ${token(heroId)}`)
      .send({
        senderId: 'bind-9001',
        senderHeroId: heroId,
        recipientId: recipientTwitch,
        subject: 'trade',
        message: 'hi',
        items: [{ itemId: 'boe-1', quantity: 1 }],
        codAmount: 0
      });
    assert.equal(res.status, 200);
    passed++;
    console.log('  ✓ Passed');
  } catch (e) {
    failed++;
    console.log('  ✗ Failed:', e.message, e.response?.body);
  }

  console.log('\nTest 5: auction rejects bop listing');
  try {
    const res = await request(app)
      .post('/api/auction/list')
      .set('Authorization', `Bearer ${token(heroId)}`)
      .send({
        sellerId: heroId,
        item: gear('bop', { id: 'bop-auc' }),
        startingPrice: 50
      });
    assert.equal(res.status, 400);
    assert.equal(res.body.code, 'ITEM_NOT_TRADEABLE');
    passed++;
    console.log('  ✓ Passed');
  } catch (e) {
    failed++;
    console.log('  ✗ Failed:', e.message);
  }

  console.log('\nTest 6: vendor sell rejects account-bound');
  try {
    const res = await request(app)
      .post(`/api/heroes/${heroId}/inventory/sell`)
      .set('Authorization', `Bearer ${token(heroId)}`)
      .send({ itemIds: ['acct-1'] });
    assert.equal(res.status, 400);
    passed++;
    console.log('  ✓ Passed');
  } catch (e) {
    failed++;
    console.log('  ✗ Failed:', e.message, e.response?.body);
  }

  console.log('\nTest 7: equip soulbinds boe');
  try {
    await db.collection('heroes').doc(heroId).set({
      twitchUserId: 'bind-9001',
      gold: 500,
      inventory: [gear('boe', { id: 'boe-equip' })],
      equipment: {},
      level: 20
    });
    const res = await request(app)
      .post(`/api/professions/${heroId}/equip`)
      .set('Authorization', `Bearer ${token(heroId)}`)
      .send({ slot: 'weapon', itemId: 'boe-equip' });
    assert.equal(res.status, 200);
    const doc = await db.collection('heroes').doc(heroId).get();
    const equipped = doc.data().equipment?.weapon;
    assert.ok(equipped, 'expected weapon in equipment');
    assert.equal(resolveBinding(equipped), 'bop');
    assert.equal(equipped.soulboundFromEquip, true);
    const unequip = await request(app)
      .post(`/api/professions/${heroId}/unequip`)
      .set('Authorization', `Bearer ${token(heroId)}`)
      .send({ slot: 'weapon' });
    assert.equal(unequip.status, 200);
    const mailRes = await request(app)
      .post('/api/mail/send')
      .set('Authorization', `Bearer ${token(heroId)}`)
      .send({
        senderId: 'bind-9001',
        senderHeroId: heroId,
        recipientId: recipientTwitch,
        subject: 'nope',
        message: 'nope',
        items: [{ itemId: 'boe-equip', quantity: 1 }],
        codAmount: 0
      });
    assert.equal(mailRes.status, 400);
    assert.equal(mailRes.body.code, 'ITEM_NOT_TRADEABLE');
    passed++;
    console.log('  ✓ Passed');
  } catch (e) {
    failed++;
    console.log('  ✗ Failed:', e.message);
  }

  console.log('\nTest 8: bindingViolation trade helper');
  try {
    assert.ok(bindingViolation(gear('boe'), 'trade') === null);
    assert.ok(bindingViolation(gear('bop'), 'trade')?.code === 'ITEM_NOT_TRADEABLE');
    assert.equal(bindingForGeneratedGear({ source: { type: 'dungeon' }, isSetPiece: true }), 'bop');
    passed++;
    console.log('  ✓ Passed');
  } catch (e) {
    failed++;
    console.log('  ✗ Failed:', e.message);
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) process.exit(1);
}

runTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
