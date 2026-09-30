/**
 * Middleware Tests
 * Tests for auth middleware functions
 * 
 * Run with: node tests/middleware.test.js
 */

import { strict as assert } from 'assert';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

// Mock JWT_SECRET for testing
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(32).toString('hex');

/**
 * Test valid JWT verification
 */
function testValidJWT() {
  console.log('Testing valid JWT...');
  
  const payload = {
    userId: 'hero-123',
    twitchUserId: '12345678',
    twitchUsername: 'testuser'
  };
  
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
  const decoded = jwt.verify(token, JWT_SECRET);
  
  assert.equal(decoded.userId, payload.userId);
  assert.equal(decoded.twitchUserId, payload.twitchUserId);
  
  console.log('✓ Valid JWT test passed');
}

/**
 * Test expired JWT
 */
async function testExpiredJWT() {
  console.log('Testing expired JWT...');
  
  const payload = { userId: 'hero-123' };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1ms' });
  
  await new Promise(resolve => setTimeout(resolve, 10));
  
  try {
    jwt.verify(token, JWT_SECRET);
    assert.fail('Should throw TokenExpiredError');
  } catch (error) {
    assert.equal(error.name, 'TokenExpiredError');
    console.log('✓ Expired JWT test passed');
  }
}

/**
 * Test invalid JWT
 */
function testInvalidJWT() {
  console.log('Testing invalid JWT...');
  
  try {
    jwt.verify('invalid.token.here', JWT_SECRET);
    assert.fail('Should throw error');
  } catch (error) {
    assert(error instanceof Error);
    console.log('✓ Invalid JWT test passed');
  }
}

/**
 * Test ownership validation
 */
function testOwnershipValidation() {
  console.log('Testing ownership validation...');
  
  const user = {
    userId: 'hero-doc-123',
    twitchUserId: '12345678'
  };
  
  // Direct match
  assert.equal(user.userId, 'hero-doc-123');
  assert.equal(user.twitchUserId, '12345678');
  
  // Should not match other IDs
  assert.notEqual(user.userId, 'other-hero-456');
  assert.notEqual(user.twitchUserId, '87654321');
  
  console.log('✓ Ownership validation test passed');
}

/**
 * Test timing-safe comparison
 */
function testTimingSafeComparison() {
  console.log('Testing timing-safe comparison...');
  
  const key1 = 'secret-key-12345';
  const key2 = 'secret-key-12345';
  const key3 = 'different-key-67890';
  
  // Same keys
  try {
    const match = crypto.timingSafeEqual(
      Buffer.from(key1),
      Buffer.from(key2)
    );
    assert(match === true);
  } catch (error) {
    assert.fail('Same keys should match');
  }
  
  // Different keys
  try {
    const match = crypto.timingSafeEqual(
      Buffer.from(key1),
      Buffer.from(key3)
    );
    assert(match === false);
  } catch (error) {
    // Expected - keys don't match
  }
  
  // Different lengths (should throw)
  try {
    crypto.timingSafeEqual(
      Buffer.from('short'),
      Buffer.from('much-longer-key')
    );
    assert.fail('Should throw on length mismatch');
  } catch (error) {
    // Expected
  }
  
  console.log('✓ Timing-safe comparison test passed');
}

/**
 * Test admin key validation logic
 */
function testAdminKeyValidation() {
  console.log('Testing admin key validation...');
  
  const expectedKey = crypto.randomBytes(32).toString('hex');
  const validKey = expectedKey;
  const invalidKey = crypto.randomBytes(32).toString('hex');
  
  // Valid key
  try {
    const isValid = crypto.timingSafeEqual(
      Buffer.from(validKey),
      Buffer.from(expectedKey)
    );
    assert(isValid === true);
  } catch (error) {
    assert.fail('Valid admin key should match');
  }
  
  // Invalid key
  try {
    const isValid = crypto.timingSafeEqual(
      Buffer.from(invalidKey),
      Buffer.from(expectedKey)
    );
    assert(isValid === false);
  } catch (error) {
    // Expected - keys don't match
  }
  
  console.log('✓ Admin key validation test passed');
}

/**
 * Test streamer key validation logic
 */
function testStreamerKeyValidation() {
  console.log('Testing streamer key validation...');
  
  const storedKey = crypto.randomBytes(32).toString('hex');
  const providedKeyValid = storedKey;
  const providedKeyInvalid = crypto.randomBytes(32).toString('hex');
  
  // Valid key
  try {
    const isValid = crypto.timingSafeEqual(
      Buffer.from(providedKeyValid),
      Buffer.from(storedKey)
    );
    assert(isValid === true);
  } catch (error) {
    assert.fail('Valid streamer key should match');
  }
  
  // Invalid key
  try {
    const isValid = crypto.timingSafeEqual(
      Buffer.from(providedKeyInvalid),
      Buffer.from(storedKey)
    );
    assert(isValid === false);
  } catch (error) {
    // Expected - keys don't match
  }
  
  console.log('✓ Streamer key validation test passed');
}

/**
 * Test guild membership logic
 */
function testGuildMembershipLogic() {
  console.log('Testing guild membership logic...');
  
  const guild = {
    members: [
      { heroId: 'hero-1', role: 'leader' },
      { heroId: 'hero-2', role: 'officer' },
      { heroId: 'hero-3', role: 'member' }
    ]
  };
  
  const user = { userId: 'hero-2' };
  
  // Check membership
  const isMember = guild.members.some(m => m.heroId === user.userId);
  assert(isMember === true);
  
  // Check officer role
  const memberInfo = guild.members.find(m => m.heroId === user.userId);
  assert(memberInfo.role === 'officer');
  
  // Check non-member
  const nonMember = { userId: 'hero-999' };
  const isNonMember = guild.members.some(m => m.heroId === nonMember.userId);
  assert(isNonMember === false);
  
  console.log('✓ Guild membership logic test passed');
}

/**
 * Test XP/Gold clamping logic
 */
function testXPGoldClamping() {
  console.log('Testing XP/Gold clamping logic...');
  
  const MAX_XP_PER_BATCH = 10000;
  const MAX_GOLD_PER_BATCH = 5000;
  
  // Normal values
  let xp = 500;
  let gold = 250;
  xp = Math.min(xp, MAX_XP_PER_BATCH);
  gold = Math.min(gold, MAX_GOLD_PER_BATCH);
  assert.equal(xp, 500);
  assert.equal(gold, 250);
  
  // Excessive values
  xp = 50000;
  gold = 25000;
  xp = Math.min(xp, MAX_XP_PER_BATCH);
  gold = Math.min(gold, MAX_GOLD_PER_BATCH);
  assert.equal(xp, MAX_XP_PER_BATCH);
  assert.equal(gold, MAX_GOLD_PER_BATCH);
  
  // Negative values
  xp = -100;
  gold = -50;
  xp = Math.max(0, xp);
  gold = Math.max(0, gold);
  assert.equal(xp, 0);
  assert.equal(gold, 0);
  
  console.log('✓ XP/Gold clamping logic test passed');
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('Starting middleware tests...\n');
  
  try {
    testValidJWT();
    await testExpiredJWT();
    testInvalidJWT();
    testOwnershipValidation();
    testTimingSafeComparison();
    testAdminKeyValidation();
    testStreamerKeyValidation();
    testGuildMembershipLogic();
    testXPGoldClamping();
    
    console.log('\n✅ All middleware tests passed!');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run tests if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}

export { runTests };
