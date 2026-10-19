/**
 * Middleware tests with in-memory Firestore (exercises real middleware code).
 */

import { strict as assert } from 'assert';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { applyTestEnv, TEST_JWT_SECRET, VALID_STREAMER_KEY, WRONG_STREAMER_KEY } from './setupTestEnv.js';

applyTestEnv();

const { app } = await import('../src/index.js');
const { JWT_SECRET } = await import('../src/config/jwt.js');
const { requireAuth, requireOwnership, requireStreamerAccess } = await import('../src/middleware/auth.js');
const { requireAuthOrStreamerKey } = await import('../src/middleware/requireAuthOrStreamerKey.js');

assert.equal(JWT_SECRET, TEST_JWT_SECRET, 'JWT_SECRET must come from config/env');

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    }
  };
}

function signToken(userId, twitchUserId) {
  return jwt.sign({ userId, twitchUserId, twitchUsername: 'u' }, JWT_SECRET, { expiresIn: '1h' });
}

async function runTests() {
  console.log('\nMiddleware + Firestore Fake Tests\n');
  console.log('='.repeat(60));

  let passed = 0;
  let failed = 0;

  console.log('\nTest 1: requireAuthOrStreamerKey — no credentials (401)');
  try {
    const req = { headers: {} };
    const res = mockRes();
    let nextCalled = false;
    await requireAuthOrStreamerKey(req, res, () => { nextCalled = true; });
    assert.equal(res.statusCode, 401);
    assert.equal(nextCalled, false);
    console.log('  ✓ Passed');
    passed++;
  } catch (e) {
    console.log('  ✗ Failed:', e.message);
    failed++;
  }

  console.log('\nTest 2: requireAuthOrStreamerKey — wrong streamer key (401)');
  try {
    const req = { headers: { 'x-streamer-key': WRONG_STREAMER_KEY } };
    const res = mockRes();
    await requireAuthOrStreamerKey(req, res, () => {});
    assert.equal(res.statusCode, 401);
    console.log('  ✓ Passed');
    passed++;
  } catch (e) {
    console.log('  ✗ Failed:', e.message);
    failed++;
  }

  console.log('\nTest 3: requireAuthOrStreamerKey — valid streamer key (pass)');
  try {
    const req = { headers: { 'x-streamer-key': VALID_STREAMER_KEY } };
    const res = mockRes();
    let nextCalled = false;
    await requireAuthOrStreamerKey(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
    assert.equal(req.authType, 'streamer-key');
    assert.equal(req.streamer.twitchId, 'streamer1');
    assert.equal(req.streamer.battlefieldId, 'twitch:streamer1');
    console.log('  ✓ Passed');
    passed++;
  } catch (e) {
    console.log('  ✗ Failed:', e.message);
    failed++;
  }

  console.log('\nTest 4: requireAuthOrStreamerKey — JWT signed with config secret (pass)');
  try {
    const token = signToken('hero-on-bf1', '111');
    const req = { headers: { authorization: `Bearer ${token}` } };
    const res = mockRes();
    let nextCalled = false;
    await requireAuthOrStreamerKey(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
    assert.equal(req.authType, 'jwt');
    console.log('  ✓ Passed');
    passed++;
  } catch (e) {
    console.log('  ✗ Failed:', e.message);
    failed++;
  }

  console.log('\nTest 5: requireOwnership — wrong user (403)');
  try {
    const req = { user: { userId: 'hero-on-bf1', twitchUserId: '111' }, params: { userId: 'hero-other-bf' } };
    const res = mockRes();
    let nextCalled = false;
    await new Promise((resolve) => {
      requireOwnership(req, res, () => {
        nextCalled = true;
        resolve();
      });
      setTimeout(resolve, 25);
    });
    assert.equal(res.statusCode, 403);
    assert.equal(nextCalled, false);
    console.log('  ✓ Passed');
    passed++;
  } catch (e) {
    console.log('  ✗ Failed:', e.message);
    failed++;
  }

  console.log('\nTest 6: requireOwnership — owner (pass)');
  try {
    const req = { user: { userId: 'hero-on-bf1', twitchUserId: '111' }, params: { userId: 'hero-on-bf1' } };
    const res = mockRes();
    let nextCalled = false;
    requireOwnership(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
    console.log('  ✓ Passed');
    passed++;
  } catch (e) {
    console.log('  ✗ Failed:', e.message);
    failed++;
  }

  console.log('\nTest 7: requireStreamerAccess — valid key (pass)');
  try {
    const req = {
      params: { streamerId: 'streamer1' },
      headers: { 'x-streamer-key': VALID_STREAMER_KEY }
    };
    const res = mockRes();
    let nextCalled = false;
    await requireStreamerAccess(req, res, () => { nextCalled = true; });
    assert.equal(nextCalled, true);
    assert.equal(req.streamerKeyAuth, true);
    console.log('  ✓ Passed');
    passed++;
  } catch (e) {
    console.log('  ✗ Failed:', e.message);
    failed++;
  }

  console.log('\nTest 8: POST /api/quests/update-batch-all — hero on another battlefield (403)');
  try {
    const res = await request(app)
      .post('/api/quests/update-batch-all')
      .set('X-Streamer-Key', VALID_STREAMER_KEY)
      .send({
        updates: [{ userId: '222', updates: [{ trackingKey: 'kill', type: 'daily', increment: 1 }] }]
      });
    assert.equal(res.status, 403);
    console.log('  ✓ Passed');
    passed++;
  } catch (e) {
    console.log('  ✗ Failed:', e.message);
    failed++;
  }

  console.log('\nTest 9: POST /api/quests/update-batch-all — valid key + hero on battlefield (auth passes)');
  try {
    const res = await request(app)
      .post('/api/quests/update-batch-all')
      .set('X-Streamer-Key', VALID_STREAMER_KEY)
      .send({
        updates: [{ userId: '111', updates: [{ trackingKey: 'kill', type: 'daily', increment: 1 }] }]
      });
    assert.notEqual(res.status, 401, 'should not be 401');
    assert.notEqual(res.status, 403, 'should not be 403');
    console.log(`  ✓ Passed (status ${res.status}, auth ok)`);
    passed++;
  } catch (e) {
    console.log('  ✗ Failed:', e.message);
    failed++;
  }

  console.log('\n' + '='.repeat(60));
  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
