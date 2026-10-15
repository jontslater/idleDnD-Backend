/**
 * Instance timeout sweeper + Firestore field guards (real admin sentinels).
 */

import { strict as assert } from 'assert';
import admin from 'firebase-admin';
import { applyTestEnv } from './setupTestEnv.js';

applyTestEnv();

async function runTests() {
  console.log('Instance Lifecycle Tests\n');
  console.log('='.repeat(60));

  let passed = 0;
  let failed = 0;

  console.log('\nTest 1: real serverTimestamp inside array is rejected');
  try {
    const { assertNoServerTimestampInsideArrays, isServerTimestampSentinel } =
      await import('../src/testSupport/firestoreFieldGuards.js');
    assert.equal(isServerTimestampSentinel(admin.firestore.FieldValue.serverTimestamp()), true);
    assert.equal(isServerTimestampSentinel(admin.firestore.FieldValue.delete()), false);
    let threw = false;
    try {
      assertNoServerTimestampInsideArrays([
        { joinedAt: admin.firestore.FieldValue.serverTimestamp() }
      ]);
    } catch (e) {
      threw = true;
      assert.ok(e.message.includes('cannot be used inside of an array'));
    }
    assert.equal(threw, true);
    console.log('  ✓ Passed');
    passed++;
  } catch (e) {
    console.log('  ✗ Failed:', e.message);
    failed++;
  }

  console.log('\nTest 2: stale in-progress instance timed out and hero cleared');
  try {
    const { db } = await import('../src/index.js');
    const { sweepStaleInstances } = await import('../src/services/instanceTimeoutService.js');
    const old = admin.firestore.Timestamp.fromDate(new Date(Date.now() - 3 * 60 * 60 * 1000));
    const inst = await db.collection('dungeonInstances').add({
      dungeonId: 'ancient_catacombs',
      status: 'in-progress',
      battlefieldId: 'twitch:streamer1',
      participants: [{ heroId: 'hero-timeout', userId: 'hero-timeout', twitchUserId: 't99' }],
      participantIds: ['t99'],
      createdAt: old,
      updatedAt: old
    });
    await db.collection('heroes').doc('hero-timeout').set({
      twitchUserId: 't99',
      activeInstance: { type: 'dungeon', instanceId: inst.id }
    });

    const result = await sweepStaleInstances(60 * 60 * 1000);
    assert.equal(result.dungeons, 1);

    const instDoc = await db.collection('dungeonInstances').doc(inst.id).get();
    assert.equal(instDoc.data().status, 'failed');
    assert.equal(instDoc.data().abandonReason, 'server_timeout');

    const heroDoc = await db.collection('heroes').doc('hero-timeout').get();
    assert.ok(!heroDoc.data().activeInstance?.instanceId);
    console.log('  ✓ Passed');
    passed++;
  } catch (e) {
    console.log('  ✗ Failed:', e.message);
    failed++;
  }

  console.log('\nTest 3: dungeon fail clears instance.participants heroes');
  try {
    const { clearActiveInstanceForParticipants } =
      await import('../src/services/heroInstanceService.js');
    const { db } = await import('../src/index.js');
    await db.collection('heroes').doc('hero-fail-a').set({
      activeInstance: { type: 'dungeon', instanceId: 'x' }
    });
    await db.collection('heroes').doc('hero-fail-b').set({
      activeInstance: { type: 'dungeon', instanceId: 'x' }
    });
    const instanceParticipants = [
      { heroId: 'hero-fail-a', userId: 'u1' },
      { heroId: 'hero-fail-b', userId: 'u2' }
    ];
    await clearActiveInstanceForParticipants(instanceParticipants);
    const a = await db.collection('heroes').doc('hero-fail-a').get();
    const b = await db.collection('heroes').doc('hero-fail-b').get();
    assert.ok(!a.data().activeInstance?.instanceId);
    assert.ok(!b.data().activeInstance?.instanceId);
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
