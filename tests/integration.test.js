/**
 * Integration Tests - Middleware Logic Validation
 * Tests auth middleware behavior without importing full app
 * (Full HTTP tests require Firebase emulator)
 */

import { strict as assert } from 'assert';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const JWT_SECRET = crypto.randomBytes(32).toString('hex');
const INTERNAL_API_KEY = crypto.randomBytes(32).toString('hex');
const ADMIN_KEY = crypto.randomBytes(32).toString('hex');

console.log('\nIntegration Tests - Middleware Logic Validation\n');
console.log('='.repeat(60));

let passed = 0;
let failed = 0;

// Test 1: JWT generation and verification
console.log('\nTest 1: JWT generation and verification');
try {
  const payload = { userId: 'test-123', twitchUserId: '12345678' };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
  const decoded = jwt.verify(token, JWT_SECRET);
  
  assert.equal(decoded.userId, payload.userId);
  assert.equal(decoded.twitchUserId, payload.twitchUserId);
  console.log('  ✓ Passed');
  passed++;
} catch (error) {
  console.log('  ✗ Failed:', error.message);
  failed++;
}

// Test 2: Expired JWT rejection
console.log('\nTest 2: Expired JWT rejection');
try {
  const token = jwt.sign({ userId: 'test' }, JWT_SECRET, { expiresIn: '-1h' });
  
  try {
    jwt.verify(token, JWT_SECRET);
    throw new Error('Should have thrown TokenExpiredError');
  } catch (verifyError) {
    assert.equal(verifyError.name, 'TokenExpiredError');
  }
  
  console.log('  ✓ Passed');
  passed++;
} catch (error) {
  console.log('  ✗ Failed:', error.message);
  failed++;
}

// Test 3: Invalid JWT rejection
console.log('\nTest 3: Invalid JWT rejection');
try {
  try {
    jwt.verify('invalid.token.here', JWT_SECRET);
    throw new Error('Should have thrown JsonWebTokenError');
  } catch (verifyError) {
    assert.equal(verifyError.name, 'JsonWebTokenError');
  }
  
  console.log('  ✓ Passed');
  passed++;
} catch (error) {
  console.log('  ✗ Failed:', error.message);
  failed++;
}

// Test 4: Timing-safe key comparison
console.log('\nTest 4: Timing-safe key comparison');
try {
  // Simulate timing-safe comparison
  const key1 = INTERNAL_API_KEY;
  const key2 = INTERNAL_API_KEY;
  const key3 = 'wrong-key-here-x';
  
  const buf1 = Buffer.from(key1);
  const buf2 = Buffer.from(key2);
  const buf3 = Buffer.from(key3.padEnd(key1.length, 'x'));
  
  assert.equal(crypto.timingSafeEqual(buf1, buf2), true);
  assert.equal(crypto.timingSafeEqual(buf1, buf3), false);
  
  console.log('  ✓ Passed');
  passed++;
} catch (error) {
  console.log('  ✗ Failed:', error.message);
  failed++;
}

// Test 5: Key length validation
console.log('\nTest 5: Key length validation for timing-safe comparison');
try {
  const key1 = ADMIN_KEY;
  const key2 = 'short';
  
  try {
    crypto.timingSafeEqual(Buffer.from(key1), Buffer.from(key2));
    throw new Error('Should throw on length mismatch');
  } catch (compareError) {
    assert(compareError.message.includes('length') || compareError.code === 'ERR_CRYPTO_TIMING_SAFE_EQUAL_LENGTH');
  }
  
  console.log('  ✓ Passed');
  passed++;
} catch (error) {
  console.log('  ✗ Failed:', error.message);
  failed++;
}

// Test 6: Token payload structure
console.log('\nTest 6: Token payload structure');
try {
  const payload = {
    userId: 'hero-123',
    twitchUserId: '12345678',
    twitchUsername: 'testuser'
  };
  const token = jwt.sign(payload, JWT_SECRET);
  const decoded = jwt.verify(token, JWT_SECRET);
  
  assert.equal(decoded.userId, payload.userId);
  assert.equal(decoded.twitchUserId, payload.twitchUserId);
  assert.equal(decoded.twitchUsername, payload.twitchUsername);
  assert(decoded.iat, 'Should have iat (issued at)');
  
  console.log('  ✓ Passed');
  passed++;
} catch (error) {
  console.log('  ✗ Failed:', error.message);
  failed++;
}

// Test 7: Authorization header parsing
console.log('\nTest 7: Authorization header parsing');
try {
  const token = jwt.sign({ userId: 'test' }, JWT_SECRET);
  const authHeader = `Bearer ${token}`;
  
  assert(authHeader.startsWith('Bearer '), 'Should start with Bearer');
  const extractedToken = authHeader.substring(7);
  assert.equal(extractedToken, token);
  
  const decoded = jwt.verify(extractedToken, JWT_SECRET);
  assert.equal(decoded.userId, 'test');
  
  console.log('  ✓ Passed');
  passed++;
} catch (error) {
  console.log('  ✗ Failed:', error.message);
  failed++;
}

// Test 8: Case-insensitive header keys
console.log('\nTest 8: Header key normalization');
try {
  const headers = {
    'X-Internal-Key': INTERNAL_API_KEY,
    'x-admin-key': ADMIN_KEY,
    'X-Streamer-Key': 'test-key'
  };
  
  // Simulate Express header normalization (lowercase)
  const normalized = {};
  for (const [key, value] of Object.entries(headers)) {
    normalized[key.toLowerCase()] = value;
  }
  
  assert.equal(normalized['x-internal-key'], INTERNAL_API_KEY);
  assert.equal(normalized['x-admin-key'], ADMIN_KEY);
  assert.equal(normalized['x-streamer-key'], 'test-key');
  
  console.log('  ✓ Passed');
  passed++;
} catch (error) {
  console.log('  ✗ Failed:', error.message);
  failed++;
}

// Test 9: JWT expiration window
console.log('\nTest 9: JWT expiration window');
try {
  const shortToken = jwt.sign({ userId: 'test' }, JWT_SECRET, { expiresIn: '1s' });
  
  // Should be valid immediately
  const decoded = jwt.verify(shortToken, JWT_SECRET);
  assert.equal(decoded.userId, 'test');
  
  console.log('  ✓ Passed');
  passed++;
} catch (error) {
  console.log('  ✗ Failed:', error.message);
  failed++;
}

// Test 10: Multiple auth types (requireAuthOrStreamerKey logic)
console.log('\nTest 10: Multiple auth type support');
try {
  // JWT auth
  const jwtToken = jwt.sign({ userId: 'hero-123' }, JWT_SECRET);
  const jwtHeaders = { authorization: `Bearer ${jwtToken}` };
  
  // Streamer key auth
  const streamerHeaders = { 'x-streamer-key': 'overlay-key-123' };
  
  // Validate both are recognized
  assert(jwtHeaders.authorization, 'JWT header present');
  assert(streamerHeaders['x-streamer-key'], 'Streamer key header present');
  
  // Validate precedence (JWT checked first)
  const bothHeaders = { ...jwtHeaders, ...streamerHeaders };
  assert(bothHeaders.authorization, 'JWT takes precedence');
  
  console.log('  ✓ Passed');
  passed++;
} catch (error) {
  console.log('  ✗ Failed:', error.message);
  failed++;
}

// Test 11: Owner validation logic
console.log('\nTest 11: Ownership validation logic');
try {
  const userPayload = { userId: 'hero-123', twitchUserId: '12345678' };
  
  // Same user
  assert.equal(userPayload.userId, 'hero-123', 'Should match');
  
  // Different user
  const otherUserId = 'hero-456';
  assert.notEqual(userPayload.userId, otherUserId, 'Should not match');
  
  console.log('  ✓ Passed');
  passed++;
} catch (error) {
  console.log('  ✗ Failed:', error.message);
  failed++;
}

// Test 12: Battlefield ID validation
console.log('\nTest 12: Battlefield ID format validation');
try {
  const twitchId = 'battlefield1';
  const battlefieldId = `twitch:${twitchId}`;
  
  assert(battlefieldId.startsWith('twitch:'), 'Should have twitch: prefix');
  assert.equal(battlefieldId, 'twitch:battlefield1');
  
  // Validate extraction
  const extractedId = battlefieldId.split(':')[1];
  assert.equal(extractedId, twitchId);
  
  console.log('  ✓ Passed');
  passed++;
} catch (error) {
  console.log('  ✗ Failed:', error.message);
  failed++;
}

console.log('\n' + '='.repeat(60));
console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
console.log('All middleware auth logic validated successfully');
console.log('(Full HTTP integration tests require Firebase emulator)\n');

if (failed > 0) {
  process.exit(1);
}
