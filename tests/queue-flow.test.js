/**
 * Battlefield queue flow (chat + REST + sweeper) with in-memory Firestore.
 */

import request from 'supertest';
import { strict as assert } from 'assert';
import jwt from 'jsonwebtoken';
import admin from 'firebase-admin';
import { applyTestEnv, TEST_JWT_SECRET, VALID_STREAMER_KEY } from './setupTestEnv.js';

applyTestEnv();

const STREAMER_TWITCH = 'streamer1';
const BATTLEFIELD_ID = `twitch:${STREAMER_TWITCH}`;

function legendaryGear() {
  const slots = ['weapon', 'helm', 'chest', 'legs', 'boots', 'gloves', 'ring', 'amulet'];
  const equipment = {};
  for (const slot of slots) {
    equipment[slot] = { rarity: 'legendary', name: slot };
  }
  return equipment;
}

function seedHeroes(db) {
  const roles = [
    { id: 'hero-tank', role: 'guardian' },
    { id: 'hero-healer', role: 'cleric' },
    { id: 'hero-dps1', role: 'mage' },
    { id: 'hero-dps2', role: 'ranger' },
    { id: 'hero-dps3', role: 'berserker' }
  ];
  const twitchIds = ['t1', 't2', 't3', 't4', 't5'];
  roles.forEach((r, i) => {
    db.collection('heroes').doc(r.id).set({
      twitchUserId: twitchIds[i],
      name: r.id,
      role: r.role,
      level: 20,
      equipment: legendaryGear(),
      currentBattlefieldId: BATTLEFIELD_ID
    });
  });
  return { roles, twitchIds };
}

function tokenFor(twitchUserId, userId) {
  return jwt.sign(
    { userId, twitchUserId, twitchUsername: userId },
    TEST_JWT_SECRET,
    { expiresIn: '1h' }
  );
}

async function runTests() {
  console.log('Queue Flow Tests\n');
  console.log('='.repeat(60));

  let passed = 0;
  let failed = 0;

  const { app, db } = await import('../src/index.js');
  const {
    createQueue,
    joinQueue,
    leaveQueue,
    sweepDueQueues,
    tryLaunchDueQueue,
    cancelQueue
  } = await import('../src/services/queueService.js');
  const { runQueueSweeperOnce } = await import('../src/services/queueSweeperService.js');

  console.log('\nTest 1: create queue + joins fill roles');
  try {
    globalThis.__IN_MEMORY_FIRESTORE_SEED__ = {
      streamerSettings: {
        streamer1: { overlayKey: VALID_STREAMER_KEY, twitchUsername: 'streamer1' }
      },
      heroes: {}
    };
    seedHeroes(db);

    const created = await createQueue(BATTLEFIELD_ID, STREAMER_TWITCH, 'streamer1', 'dungeon', 'normal');
    assert.equal(created.success, true);
    assert.ok(created.queue.code);
    assert.equal(created.queue.contentId, 'ancient_catacombs');

    const heroDocs = ['hero-tank', 'hero-healer', 'hero-dps1', 'hero-dps2', 'hero-dps3'];
    const twitchIds = ['t1', 't2', 't3', 't4', 't5'];
    let lastJoin;
    for (let i = 0; i < heroDocs.length; i++) {
      const doc = await db.collection('heroes').doc(heroDocs[i]).get();
      const hero = { id: doc.id, ...doc.data() };
      lastJoin = await joinQueue(created.queue.code, hero, hero.name, twitchIds[i], {
        expectedType: 'dungeon',
        expectedBattlefieldId: BATTLEFIELD_ID
      });
      assert.equal(lastJoin.success, true, lastJoin.message);
    }
    assert.equal(lastJoin.isReady, true);
    assert.equal(lastJoin.queue.status, 'ready');
    console.log('  ✓ Passed');
    passed++;
  } catch (e) {
    console.log('  ✗ Failed:', e.message);
    failed++;
  }

  console.log('\nTest 2: launch instance shape + hero battlefield ids');
  try {
    const launched = await tryLaunchDueQueue(BATTLEFIELD_ID);
    assert.equal(launched.launched, false);

    await db.collection('battlefieldQueues').doc(BATTLEFIELD_ID).update({
      launchAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 1000))
    });

    const launched2 = await tryLaunchDueQueue(BATTLEFIELD_ID);
    assert.equal(launched2.launched, true);
    const instanceId = launched2.result.instanceId;

    const instDoc = await db.collection('dungeonInstances').doc(instanceId).get();
    assert.equal(instDoc.exists, true);
    const inst = instDoc.data();
    assert.equal(inst.dungeonId, 'ancient_catacombs');
    assert.equal(inst.status, 'in-progress');
    assert.equal(inst.battlefieldId, BATTLEFIELD_ID);
    assert.ok(Array.isArray(inst.participantIds) && inst.participantIds.length === 5);

    const heroDoc = await db.collection('heroes').doc('hero-tank').get();
    assert.equal(heroDoc.data().currentBattlefieldId, BATTLEFIELD_ID);
    assert.equal(heroDoc.data().activeInstance.instanceId, instanceId);
    console.log('  ✓ Passed');
    passed++;
  } catch (e) {
    console.log('  ✗ Failed:', e.message);
    failed++;
  }

  console.log('\nTest 3: sweeper does not double-launch');
  try {
    const created = await createQueue(BATTLEFIELD_ID, STREAMER_TWITCH, 'streamer1', 'dungeon', 'normal');
    assert.equal(created.success, true);

    const heroDocs = ['hero-tank', 'hero-healer', 'hero-dps1', 'hero-dps2', 'hero-dps3'];
    const twitchIds = ['t1', 't2', 't3', 't4', 't5'];
    for (let i = 0; i < heroDocs.length; i++) {
      const doc = await db.collection('heroes').doc(heroDocs[i]).get();
      const hero = { id: doc.id, ...doc.data() };
      await joinQueue(created.queue.code, hero, hero.name, twitchIds[i], {
        expectedType: 'dungeon',
        expectedBattlefieldId: BATTLEFIELD_ID
      });
    }

    await db.collection('battlefieldQueues').doc(BATTLEFIELD_ID).update({
      launchAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 1000))
    });

    const countInstances = () => (db._collections.get('dungeonInstances')?.size) || 0;
    const beforeCount = countInstances();
    await runQueueSweeperOnce();
    await runQueueSweeperOnce();
    assert.equal(countInstances(), beforeCount + 1);
    console.log('  ✓ Passed');
    passed++;
  } catch (e) {
    console.log('  ✗ Failed:', e.message);
    failed++;
  }

  console.log('\nTest 4: leave during countdown cancels launch');
  try {
    const created = await createQueue(BATTLEFIELD_ID, STREAMER_TWITCH, 'streamer1', 'dungeon', 'normal');
    const heroDocs = ['hero-tank', 'hero-healer', 'hero-dps1', 'hero-dps2', 'hero-dps3'];
    const twitchIds = ['t1', 't2', 't3', 't4', 't5'];
    for (let i = 0; i < heroDocs.length; i++) {
      const doc = await db.collection('heroes').doc(heroDocs[i]).get();
      const hero = { id: doc.id, ...doc.data() };
      await joinQueue(created.queue.code, hero, hero.name, twitchIds[i], {
        expectedType: 'dungeon',
        expectedBattlefieldId: BATTLEFIELD_ID
      });
    }

    const left = await leaveQueue('t5', 'hero-dps3');
    assert.equal(left.success, true);
    const qDoc = await db.collection('battlefieldQueues').doc(BATTLEFIELD_ID).get();
    assert.equal(qDoc.data().status, 'open');
    assert.equal(qDoc.data().launchAt, null);

    await db.collection('battlefieldQueues').doc(BATTLEFIELD_ID).update({
      launchAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() - 1000))
    });
    const sweep = await sweepDueQueues();
    assert.equal(sweep.length, 0);
    console.log('  ✓ Passed');
    passed++;
  } catch (e) {
    console.log('  ✗ Failed:', e.message);
    failed++;
  }

  console.log('\nTest 5: REST join/leave + auth');
  try {
    await cancelQueue(BATTLEFIELD_ID);
    const created = await createQueue(BATTLEFIELD_ID, STREAMER_TWITCH, 'streamer1', 'dungeon', 'normal');
    assert.equal(created.success, true);

    const noAuth = await request(app).post(`/api/queues/${BATTLEFIELD_ID}/join`).send({ heroId: 'hero-tank' });
    assert.equal(noAuth.status, 401);

    const token = tokenFor('t1', 'hero-tank');
    const joinRes = await request(app)
      .post(`/api/queues/${BATTLEFIELD_ID}/join`)
      .set('Authorization', `Bearer ${token}`)
      .send({ heroId: 'hero-tank' });
    assert.equal(joinRes.status, 200);
    assert.equal(joinRes.body.success, true);

    const leaveRes = await request(app)
      .post(`/api/queues/${BATTLEFIELD_ID}/leave`)
      .set('Authorization', `Bearer ${token}`);
    assert.equal(leaveRes.status, 200);

    const getRes = await request(app).get(`/api/queues/${STREAMER_TWITCH}`);
    assert.equal(getRes.status, 200);
    assert.ok(getRes.body.queue);
    console.log('  ✓ Passed');
    passed++;
  } catch (e) {
    console.log('  ✗ Failed:', e.message);
    failed++;
  }

  console.log('\nTest 6: unknown queue key rejected');
  try {
    await cancelQueue(BATTLEFIELD_ID);
    const bad = await createQueue(BATTLEFIELD_ID, STREAMER_TWITCH, 'streamer1', 'dungeon', 'not_a_real_key');
    assert.equal(bad.success, false);
    console.log('  ✓ Passed');
    passed++;
  } catch (e) {
    console.log('  ✗ Failed:', e.message);
    failed++;
  }

  console.log('\n' + '='.repeat(60));
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
