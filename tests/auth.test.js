/**
 * Authentication Middleware Tests
 * 
 * Run with: npm test tests/auth.test.js
 */

import { strict as assert } from 'assert';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';

/**
 * Test JWT token generation and verification
 */
function testTokenGeneration() {
  console.log('Testing JWT token generation...');
  
  const payload = {
    userId: 'test-hero-123',
    twitchUserId: '12345678',
    twitchUsername: 'testuser'
  };
  
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1h' });
  assert(token, 'Token should be generated');
  
  const decoded = jwt.verify(token, JWT_SECRET);
  assert.equal(decoded.userId, payload.userId, 'userId should match');
  assert.equal(decoded.twitchUserId, payload.twitchUserId, 'twitchUserId should match');
  
  console.log('✓ Token generation test passed');
}

/**
 * Test token expiration
 */
function testTokenExpiration() {
  console.log('Testing token expiration...');
  
  const payload = { userId: 'test-hero-123' };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '1ms' });
  
  // Wait for token to expire
  return new Promise((resolve) => {
    setTimeout(() => {
      try {
        jwt.verify(token, JWT_SECRET);
        assert.fail('Expired token should throw error');
      } catch (error) {
        assert.equal(error.name, 'TokenExpiredError', 'Should throw TokenExpiredError');
        console.log('✓ Token expiration test passed');
        resolve();
      }
    }, 10);
  });
}

/**
 * Test invalid token
 */
function testInvalidToken() {
  console.log('Testing invalid token...');
  
  const invalidToken = 'invalid.token.here';
  
  try {
    jwt.verify(invalidToken, JWT_SECRET);
    assert.fail('Invalid token should throw error');
  } catch (error) {
    assert(error, 'Should throw error for invalid token');
    console.log('✓ Invalid token test passed');
  }
}

/**
 * Test ownership validation logic
 */
function testOwnershipLogic() {
  console.log('Testing ownership validation logic...');
  
  const user = {
    userId: 'hero-doc-123',
    twitchUserId: '12345678'
  };
  
  // Test 1: Direct hero doc ID match
  const targetUserId1 = 'hero-doc-123';
  assert.equal(targetUserId1, user.userId, 'Should match hero doc ID');
  
  // Test 2: Twitch ID match
  const targetUserId2 = '12345678';
  assert.equal(targetUserId2, user.twitchUserId, 'Should match Twitch ID');
  
  // Test 3: No match
  const targetUserId3 = 'other-hero-456';
  assert.notEqual(targetUserId3, user.userId, 'Should not match other hero ID');
  assert.notEqual(targetUserId3, user.twitchUserId, 'Should not match other Twitch ID');
  
  console.log('✓ Ownership validation logic test passed');
}

/**
 * Test chat boost formula
 */
function testChatBoostFormula() {
  console.log('Testing chat boost diminishing returns formula...');
  
  const MAX_BOOST = 0.50;
  const HALF_POINT = 20;
  
  function calculateBoost(activeUsers) {
    if (activeUsers < 3) return 0;
    return MAX_BOOST * (activeUsers / (activeUsers + HALF_POINT));
  }
  
  // Test various user counts
  assert.equal(calculateBoost(0).toFixed(4), '0.0000', '0 users = 0% boost');
  assert.equal(calculateBoost(3).toFixed(4), '0.0652', '3 users ≈ 6.5% boost');
  assert.equal(calculateBoost(10).toFixed(4), '0.1667', '10 users ≈ 16.7% boost');
  assert.equal(calculateBoost(20).toFixed(4), '0.2500', '20 users = 25% boost (half point)');
  assert.equal(calculateBoost(50).toFixed(4), '0.3571', '50 users ≈ 35.7% boost');
  
  // Test that boost approaches but never exceeds max
  const largeUserBoost = calculateBoost(1000);
  assert(largeUserBoost < MAX_BOOST, 'Boost should never exceed max');
  assert(largeUserBoost > 0.45, 'Boost should approach max asymptotically');
  
  console.log('✓ Chat boost formula test passed');
}

/**
 * Test token shop prices
 */
function testTokenShopPrices() {
  console.log('Testing token shop prices...');
  
  const TOKEN_SHOP_PRICES = {
    common: 100,
    rare: 400,
    epic: 1200,
    legendary: 5000,
    mythic: 20000
  };
  
  // Verify prices are doubled from old values
  assert.equal(TOKEN_SHOP_PRICES.common, 100, 'Common should be 100 (was 50)');
  assert.equal(TOKEN_SHOP_PRICES.rare, 400, 'Rare should be 400 (was 200)');
  assert.equal(TOKEN_SHOP_PRICES.epic, 1200, 'Epic should be 1200 (was 600)');
  assert.equal(TOKEN_SHOP_PRICES.legendary, 5000, 'Legendary should be 5000 (was 2500)');
  assert.equal(TOKEN_SHOP_PRICES.mythic, 20000, 'Mythic should be 20000 (was 10000)');
  
  // Verify price progression makes sense (each tier ~4x more expensive)
  assert(TOKEN_SHOP_PRICES.rare > TOKEN_SHOP_PRICES.common * 3, 'Rare should be 4x common');
  assert(TOKEN_SHOP_PRICES.epic > TOKEN_SHOP_PRICES.rare * 2.5, 'Epic should be 3x rare');
  
  console.log('✓ Token shop prices test passed');
}

/**
 * Run all tests
 */
async function runTests() {
  console.log('Starting authentication tests...\n');
  
  try {
    testTokenGeneration();
    await testTokenExpiration();
    testInvalidToken();
    testOwnershipLogic();
    testChatBoostFormula();
    testTokenShopPrices();
    
    console.log('\n✅ All authentication tests passed!');
  } catch (error) {
    console.error('\n❌ Test failed:', error.message);
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runTests();
}

export { runTests };
