/**
 * Route protection HTTP tests (supertest + in-memory Firestore).
 */

import request from 'supertest';
import { strict as assert } from 'assert';
import jwt from 'jsonwebtoken';
import { applyTestEnv, TEST_JWT_SECRET } from './setupTestEnv.js';

applyTestEnv();

const { app } = await import('../src/index.js');

function generateToken(userId, twitchUserId) {
  return jwt.sign(
    { userId, twitchUserId, twitchUsername: 'testuser' },
    TEST_JWT_SECRET,
    { expiresIn: '1h' }
  );
}

async function testProtectedRoute(method, path, body = {}) {
  const results = { noToken: null, badToken: null, wrongUser: null };

  let res;
  if (method === 'GET') {
    res = await request(app).get(path);
  } else if (method === 'POST') {
    res = await request(app).post(path).send(body);
  }
  results.noToken = { status: res.status, hasError: !!res.body.error };

  if (method === 'GET') {
    res = await request(app).get(path).set('Authorization', 'Bearer invalid.token.here');
  } else {
    res = await request(app).post(path).set('Authorization', 'Bearer invalid.token.here').send(body);
  }
  results.badToken = { status: res.status, hasError: !!res.body.error };

  const wrongUserToken = generateToken('wrong-hero-123', '87654321');
  if (method === 'GET') {
    res = await request(app).get(path).set('Authorization', `Bearer ${wrongUserToken}`);
  } else {
    res = await request(app).post(path).set('Authorization', `Bearer ${wrongUserToken}`).send(body);
  }
  results.wrongUser = { status: res.status, hasError: !!res.body.error };

  return results;
}

async function runTests() {
  console.log('Route Protection Integration Tests\n');
  console.log('='.repeat(60));

  let passed = 0;
  let failed = 0;

  console.log('\nTest 1: POST /api/heroes/:userId/track-wave');
  try {
    const results = await testProtectedRoute('POST', '/api/heroes/test-hero-123/track-wave', {});
    assert.equal(results.noToken.status, 401);
    assert.equal(results.badToken.status, 401);
    assert.equal(results.wrongUser.status, 403);
    console.log('  ✓ Passed');
    passed++;
  } catch (error) {
    console.log('  ✗ Failed:', error.message);
    failed++;
  }

  console.log('\nTest 2: POST /api/battlefields/register — JWT required');
  try {
    const res = await request(app).post('/api/battlefields/register').send({ heroId: 'x', battlefieldId: 'y' });
    assert.equal(res.status, 401);
    const token = generateToken('hero-on-bf1', '111');
    const res2 = await request(app)
      .post('/api/battlefields/register')
      .set('Authorization', `Bearer ${token}`)
      .send({ heroId: 'hero-on-bf1', battlefieldId: 'twitch:streamer1' });
    assert.notEqual(res2.status, 401);
    assert.notEqual(res2.status, 403);
    console.log(`  ✓ Passed (authed status ${res2.status})`);
    passed++;
  } catch (error) {
    console.log('  ✗ Failed:', error.message);
    failed++;
  }

  console.log('\nTest 3: Internal route without key (401)');
  try {
    const res = await request(app)
      .post('/api/battlefields/test/combat/xp/accumulate')
      .send({ baseXP: 1, enemyLevel: 1 });
    assert.equal(res.status, 401);
    console.log('  ✓ Passed');
    passed++;
  } catch (error) {
    console.log('  ✗ Failed:', error.message);
    failed++;
  }

  console.log('\nTest 4: GET /api/health (public)');
  try {
    const res = await request(app).get('/api/health');
    assert.notEqual(res.status, 401);
    console.log('  ✓ Passed');
    passed++;
  } catch (error) {
    console.log('  ✗ Failed:', error.message);
    failed++;
  }

  console.log('\n' + '='.repeat(60));
  console.log(`\nResults: ${passed} passed, ${failed} failed`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch((error) => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
