/**
 * Integration Tests
 * Real HTTP tests with supertest against the Express app
 */

import { strict as assert } from 'assert';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Set env BEFORE any imports
const JWT_SECRET = crypto.randomBytes(32).toString('hex');
const INTERNAL_API_KEY = crypto.randomBytes(32).toString('hex');
const ADMIN_KEY = crypto.randomBytes(32).toString('hex');

process.env.JWT_SECRET = JWT_SECRET;
process.env.INTERNAL_API_KEY = INTERNAL_API_KEY;
process.env.ADMIN_KEY = ADMIN_KEY;
process.env.NODE_ENV = 'test';

// Stub Firebase connection (will fail gracefully if not available)
// The app should handle Firebase errors in test mode
process.env.FIREBASE_PROJECT_ID = 'test-project';
process.env.FIREBASE_CLIENT_EMAIL = 'test@test.com';
process.env.FIREBASE_PRIVATE_KEY = '-----BEGIN PRIVATE KEY-----\nMIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQC0test\n-----END PRIVATE KEY-----\n';

// Import app
let app;
try {
  const indexModule = await import('../src/index.js');
  app = indexModule.app;
  
  if (!app) {
    throw new Error('App export is undefined');
  }
  
  console.log('✅ Express app loaded successfully');
} catch (error) {
  console.error('❌ Failed to import app:', error.message);
  console.error('Stack:', error.stack);
  process.exit(1);
}

function generateToken(userId, twitchUserId) {
  return jwt.sign(
    { userId, twitchUserId, twitchUsername: 'testuser' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

async function runTests() {
  console.log('\nIntegration Tests\n');
  console.log('='.repeat(60));
  
  let passed = 0;
  let failed = 0;
  
  // Test 1: Hero mutation without token
  console.log('\nTest 1: Hero mutation without token (401)');
  try {
    const res = await request(app)
      .post('/api/heroes/test-hero-123/track-wave')
      .send({});
    
    assert.equal(res.status, 401, `Expected 401, got ${res.status}`);
    assert(res.body.error, 'Should have error message');
    console.log('  ✓ Passed');
    passed++;
  } catch (error) {
    console.log('  ✗ Failed:', error.message);
    failed++;
  }
  
  // Test 2: Hero mutation with wrong user's token
  console.log('\nTest 2: Hero mutation with wrong user token (403)');
  try {
    const wrongToken = generateToken('wrong-hero-id', '87654321');
    const res = await request(app)
      .post('/api/heroes/test-hero-123/track-wave')
      .set('Authorization', `Bearer ${wrongToken}`)
      .send({});
    
    assert.equal(res.status, 403, `Expected 403, got ${res.status}`);
    assert(res.body.error, 'Should have error message');
    console.log('  ✓ Passed');
    passed++;
  } catch (error) {
    console.log('  ✗ Failed:', error.message);
    failed++;
  }
  
  // Test 3: Hero mutation with owner's token (passes auth)
  console.log('\nTest 3: Hero mutation with owner token (auth passes)');
  try {
    const ownerToken = generateToken('test-hero-123', '12345678');
    const res = await request(app)
      .post('/api/heroes/test-hero-123/track-wave')
      .set('Authorization', `Bearer ${ownerToken}`)
      .send({});
    
    // Should not be 401/403 (auth should work)
    assert.notEqual(res.status, 401, `Auth failed with 401`);
    assert.notEqual(res.status, 403, `Auth failed with 403`);
    console.log(`  ✓ Passed (status: ${res.status}, auth worked)`);
    passed++;
  } catch (error) {
    console.log('  ✗ Failed:', error.message);
    failed++;
  }
  
  // Test 4: Battlefield register with user JWT
  console.log('\nTest 4: Battlefield register with user JWT');
  try {
    const userToken = generateToken('test-hero-123', '12345678');
    const res = await request(app)
      .post('/api/battlefields/register')
      .set('Authorization', `Bearer ${userToken}`)
      .send({
        heroId: 'test-hero-123',
        battlefieldId: 'twitch:12345678'
      });
    
    assert.notEqual(res.status, 401, `Auth failed with 401`);
    assert.notEqual(res.status, 403, `Auth failed with 403`);
    console.log(`  ✓ Passed (status: ${res.status}, auth worked)`);
    passed++;
  } catch (error) {
    console.log('  ✗ Failed:', error.message);
    failed++;
  }
  
  // Test 5: Battlefield register without token
  console.log('\nTest 5: Battlefield register without token (401)');
  try {
    const res = await request(app)
      .post('/api/battlefields/register')
      .send({
        heroId: 'test-hero-123',
        battlefieldId: 'twitch:12345678'
      });
    
    assert.equal(res.status, 401, `Expected 401, got ${res.status}`);
    console.log('  ✓ Passed');
    passed++;
  } catch (error) {
    console.log('  ✗ Failed:', error.message);
    failed++;
  }
  
  // Test 6: Internal route without key
  console.log('\nTest 6: Internal route without key (401/503)');
  try {
    const res = await request(app)
      .post('/api/battlefields/test-field/combat/xp/accumulate')
      .send({ baseXP: 10, enemyLevel: 5 });
    
    assert([401, 503].includes(res.status), `Expected 401/503, got ${res.status}`);
    assert(res.body.error, 'Should have error message');
    console.log(`  ✓ Passed (status: ${res.status})`);
    passed++;
  } catch (error) {
    console.log('  ✗ Failed:', error.message);
    failed++;
  }
  
  // Test 7: Internal route with valid key
  console.log('\nTest 7: Internal route with valid key');
  try {
    const res = await request(app)
      .post('/api/battlefields/test-field/combat/xp/accumulate')
      .set('X-Internal-Key', INTERNAL_API_KEY)
      .send({ baseXP: 10, enemyLevel: 5 });
    
    assert.notEqual(res.status, 401, `Auth failed with 401`);
    assert.notEqual(res.status, 403, `Auth failed with 403`);
    console.log(`  ✓ Passed (status: ${res.status}, auth worked)`);
    passed++;
  } catch (error) {
    console.log('  ✗ Failed:', error.message);
    failed++;
  }
  
  // Test 8: Admin route without key
  console.log('\nTest 8: Admin route without key (401)');
  try {
    const res = await request(app)
      .post('/api/heroes/test/create')
      .send({ userId: 'test', username: 'test', heroName: 'Test' });
    
    assert.equal(res.status, 401, `Expected 401, got ${res.status}`);
    console.log('  ✓ Passed');
    passed++;
  } catch (error) {
    console.log('  ✗ Failed:', error.message);
    failed++;
  }
  
  // Test 9: Admin route with valid key
  console.log('\nTest 9: Admin route with valid key');
  try {
    const res = await request(app)
      .post('/api/heroes/test/create')
      .set('X-Admin-Key', ADMIN_KEY)
      .send({ userId: 'test', username: 'test', heroName: 'Test' });
    
    assert.notEqual(res.status, 401, `Auth failed with 401`);
    assert.notEqual(res.status, 403, `Auth failed with 403`);
    console.log(`  ✓ Passed (status: ${res.status}, auth worked)`);
    passed++;
  } catch (error) {
    console.log('  ✗ Failed:', error.message);
    failed++;
  }
  
  // Test 10: Overlay sync with invalid key
  console.log('\nTest 10: Overlay sync with invalid key (401)');
  try {
    const res = await request(app)
      .post('/api/overlay/sync')
      .set('X-Streamer-Key', 'invalid-key')
      .send({ deltas: [] });
    
    assert.equal(res.status, 401, `Expected 401, got ${res.status}`);
    console.log('  ✓ Passed');
    passed++;
  } catch (error) {
    console.log('  ✗ Failed:', error.message);
    failed++;
  }
  
  // Test 11: Public route
  console.log('\nTest 11: Public route (no auth)');
  try {
    const res = await request(app)
      .get('/api/leaderboards/global/level');
    
    assert.notEqual(res.status, 401, `Public route should not require auth`);
    console.log(`  ✓ Passed (status: ${res.status})`);
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

// Run tests
runTests().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
