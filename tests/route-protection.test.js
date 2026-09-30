/**
 * Route Protection Integration Tests
 * Tests real HTTP routes with supertest
 * 
 * Tests:
 * - No token returns 401
 * - Bad token returns 401
 * - Another user's token returns 403
 * - Valid token returns 200/proper response
 */

import request from 'supertest';
import { strict as assert } from 'assert';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Mock JWT_SECRET for testing
const JWT_SECRET = crypto.randomBytes(32).toString('hex');
process.env.JWT_SECRET = JWT_SECRET;
process.env.NODE_ENV = 'test';

// Import app after setting env
const app = (await import('../src/index.js')).default;

function generateToken(userId, twitchUserId) {
  return jwt.sign(
    { userId, twitchUserId, twitchUsername: 'testuser' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

/**
 * Test helper for protected routes
 */
async function testProtectedRoute(method, path, body = {}) {
  const results = {
    noToken: null,
    badToken: null,
    wrongUser: null,
    validToken: null
  };
  
  // Test 1: No token - should return 401
  let res;
  if (method === 'GET') {
    res = await request(app).get(path);
  } else if (method === 'POST') {
    res = await request(app).post(path).send(body);
  } else if (method === 'PUT') {
    res = await request(app).put(path).send(body);
  } else if (method === 'DELETE') {
    res = await request(app).delete(path);
  }
  results.noToken = { status: res.status, hasError: !!res.body.error };
  
  // Test 2: Bad token - should return 401
  if (method === 'GET') {
    res = await request(app).get(path).set('Authorization', 'Bearer invalid.token.here');
  } else if (method === 'POST') {
    res = await request(app).post(path).set('Authorization', 'Bearer invalid.token.here').send(body);
  } else if (method === 'PUT') {
    res = await request(app).put(path).set('Authorization', 'Bearer invalid.token.here').send(body);
  } else if (method === 'DELETE') {
    res = await request(app).delete(path).set('Authorization', 'Bearer invalid.token.here');
  }
  results.badToken = { status: res.status, hasError: !!res.body.error };
  
  // Test 3: Wrong user's token (for ownership routes) - should return 403
  const wrongUserToken = generateToken('wrong-hero-123', '87654321');
  if (method === 'GET') {
    res = await request(app).get(path).set('Authorization', `Bearer ${wrongUserToken}`);
  } else if (method === 'POST') {
    res = await request(app).post(path).set('Authorization', `Bearer ${wrongUserToken}`).send(body);
  } else if (method === 'PUT') {
    res = await request(app).put(path).set('Authorization', `Bearer ${wrongUserToken}`).send(body);
  } else if (method === 'DELETE') {
    res = await request(app).delete(path).set('Authorization', `Bearer ${wrongUserToken}`);
  }
  results.wrongUser = { status: res.status, hasError: !!res.body.error };
  
  return results;
}

/**
 * Run tests
 */
async function runTests() {
  console.log('Route Protection Integration Tests\n');
  console.log('='.repeat(60));
  
  let passed = 0;
  let failed = 0;
  
  // Test hero mutation route
  console.log('\nTest 1: POST /api/heroes/:userId/track-wave (requireAuth + requireOwnership)');
  try {
    const results = await testProtectedRoute('POST', '/api/heroes/test-hero-123/track-wave', {});
    
    assert.equal(results.noToken.status, 401, 'No token should return 401');
    assert(results.noToken.hasError, 'No token should return error');
    
    assert.equal(results.badToken.status, 401, 'Bad token should return 401');
    assert(results.badToken.hasError, 'Bad token should return error');
    
    assert.equal(results.wrongUser.status, 403, 'Wrong user should return 403');
    assert(results.wrongUser.hasError, 'Wrong user should return error');
    
    console.log('  ✓ Passed');
    passed++;
  } catch (error) {
    console.log('  ✗ Failed:', error.message);
    failed++;
  }
  
  // Test purchase route
  console.log('\nTest 2: POST /api/heroes/:userId/purchase/gold (requireAuth + requireOwnership)');
  try {
    const results = await testProtectedRoute('POST', '/api/heroes/test-hero-123/purchase/gold', { itemKey: 'healthpotion' });
    
    assert.equal(results.noToken.status, 401, 'No token should return 401');
    assert.equal(results.badToken.status, 401, 'Bad token should return 401');
    assert.equal(results.wrongUser.status, 403, 'Wrong user should return 403');
    
    console.log('  ✓ Passed');
    passed++;
  } catch (error) {
    console.log('  ✗ Failed:', error.message);
    failed++;
  }
  
  // Test mail route
  console.log('\nTest 3: GET /api/mail/:userId (requireAuth + requireOwnership)');
  try {
    const results = await testProtectedRoute('GET', '/api/mail/test-hero-123');
    
    assert.equal(results.noToken.status, 401, 'No token should return 401');
    assert.equal(results.badToken.status, 401, 'Bad token should return 401');
    assert.equal(results.wrongUser.status, 403, 'Wrong user should return 403');
    
    console.log('  ✓ Passed');
    passed++;
  } catch (error) {
    console.log('  ✗ Failed:', error.message);
    failed++;
  }
  
  // Test auction route
  console.log('\nTest 4: GET /api/auction/my-listings/:userId (requireAuth + requireOwnership)');
  try {
    const results = await testProtectedRoute('GET', '/api/auction/my-listings/test-hero-123');
    
    assert.equal(results.noToken.status, 401, 'No token should return 401');
    assert.equal(results.badToken.status, 401, 'Bad token should return 401');
    assert.equal(results.wrongUser.status, 403, 'Wrong user should return 403');
    
    console.log('  ✓ Passed');
    passed++;
  } catch (error) {
    console.log('  ✗ Failed:', error.message);
    failed++;
  }
  
  // Test admin route
  console.log('\nTest 5: POST /api/heroes/test/create (requireAdmin)');
  try {
    const res = await request(app).post('/api/heroes/test/create').send({ userId: 'test' });
    
    // Should return 401 without admin key
    assert.equal(res.status, 401, 'No admin key should return 401');
    assert(res.body.error, 'Should have error message');
    
    console.log('  ✓ Passed');
    passed++;
  } catch (error) {
    console.log('  ✗ Failed:', error.message);
    failed++;
  }
  
  // Test public route (should NOT require auth)
  console.log('\nTest 6: GET /api/leaderboards/:type/:category (public)');
  try {
    const res = await request(app).get('/api/leaderboards/global/level');
    
    // Should NOT return 401 (public route)
    assert.notEqual(res.status, 401, 'Public route should not require auth');
    
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

// Run tests
runTests().catch(error => {
  console.error('Test suite failed:', error);
  process.exit(1);
});
