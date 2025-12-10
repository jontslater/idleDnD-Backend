/**
 * Test script for Whisper functionality
 * Tests hero ID vs user ID handling
 * 
 * Usage: npm run test-whisper
 * Make sure the backend server is running on http://localhost:3001
 */

import fetch from 'node-fetch';

const BASE_URL = 'http://localhost:3001';
const TEST_USER_ID = 'VjQrMq10rdy6EMDaXceV'; // Your test user ID
const TEST_HERO_ID = 'VjQrMq10rdy6EMDaXceV'; // Your test hero ID (might be the same)
const TEST_RECIPIENT_HERO_ID = 'BVLjZQcGYX1jawVyHSd6'; // The problematic hero ID

// Color codes for console output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

function log(message, color = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSection(title) {
  console.log('\n' + '='.repeat(60));
  log(title, 'cyan');
  console.log('='.repeat(60));
}

async function testSearchAPI() {
  logSection('TEST 1: Search API - Check returned IDs');
  
  try {
    const response = await fetch(`${BASE_URL}/api/parties/search?username=tehchno`);
    const data = await response.json();
    
    if (data.success && data.matches && data.matches.length > 0) {
      log('✓ Search API returned results', 'green');
      data.matches.forEach((match, index) => {
        log(`\nMatch ${index + 1}:`, 'blue');
        console.log('  userId:', match.userId);
        console.log('  twitchUserId:', match.twitchUserId || 'NOT SET');
        console.log('  heroId:', match.heroId);
        console.log('  username:', match.username);
        console.log('  heroName:', match.heroName);
        
        // Check if userId looks like a hero ID
        if (match.userId && match.userId.length > 15 && !/^\d+$/.test(match.userId)) {
          log('  ⚠ WARNING: userId looks like a hero document ID!', 'red');
        } else {
          log('  ✓ userId looks like a user ID', 'green');
        }
      });
      
      return data.matches[0];
    } else {
      log('✗ Search API returned no results', 'red');
      return null;
    }
  } catch (error) {
    log(`✗ Search API error: ${error.message}`, 'red');
    return null;
  }
}

async function getHeroInfo(heroId) {
  logSection(`TEST 2: Get Hero Info for ${heroId}`);
  
  try {
    // Try to get hero info by querying heroes collection (if you have an endpoint)
    // Or we can infer from the search results
    log(`Hero ID: ${heroId}`, 'blue');
    log('This should be a hero document ID', 'yellow');
    return { heroId };
  } catch (error) {
    log(`✗ Error getting hero info: ${error.message}`, 'red');
    return null;
  }
}

async function testSendWhisper(senderUserId, senderHeroId, recipientId, recipientType) {
  logSection(`TEST 3: Send Whisper (${recipientType})`);
  log(`Sender User ID: ${senderUserId}`, 'blue');
  log(`Sender Hero ID: ${senderHeroId}`, 'blue');
  log(`Recipient ID: ${recipientId}`, 'blue');
  log(`Recipient Type: ${recipientType}`, 'blue');
  
  try {
    const response = await fetch(`${BASE_URL}/api/web-chat/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        userId: senderUserId,
        heroId: senderHeroId,
        channel: 'whisper',
        message: `Test whisper - recipient type: ${recipientType}, recipient: ${recipientId}`,
        recipientId: recipientId,
      }),
    });
    
    const data = await response.json();
    
    if (response.ok && data.success) {
      log('✓ Whisper sent successfully', 'green');
      console.log('  Message ID:', data.messageId);
      console.log('  Message Data:', JSON.stringify(data.message, null, 2));
      
      // Check the stored recipientId
      if (data.message && data.message.recipientId) {
        const storedRecipientId = data.message.recipientId;
        log(`\n  Stored recipientId: ${storedRecipientId}`, 'blue');
        
        // Check if it's a hero ID or user ID
        if (storedRecipientId.length > 15 && !/^\d+$/.test(storedRecipientId)) {
          log('  ⚠ WARNING: Stored recipientId looks like a hero document ID!', 'red');
          log('  ✗ This should be a user ID (Twitch ID)', 'red');
        } else {
          log('  ✓ Stored recipientId looks like a user ID', 'green');
        }
        
        // Compare with what we sent
        if (storedRecipientId === recipientId && recipientType === 'hero-id') {
          log('  ✗ ERROR: Hero ID was stored as-is instead of converting to user ID!', 'red');
        } else if (storedRecipientId !== recipientId && recipientType === 'hero-id') {
          log('  ✓ Hero ID was converted to user ID', 'green');
        }
      }
      
      return data;
    } else {
      log(`✗ Whisper send failed: ${data.error || 'Unknown error'}`, 'red');
      return null;
    }
  } catch (error) {
    log(`✗ Error sending whisper: ${error.message}`, 'red');
    return null;
  }
}

async function testGetHistory(userId, recipientId) {
  logSection('TEST 4: Get Whisper History');
  log(`User ID: ${userId}`, 'blue');
  log(`Recipient ID: ${recipientId}`, 'blue');
  
  try {
    const response = await fetch(
      `${BASE_URL}/api/web-chat/history?channel=whisper&userId=${userId}&recipientId=${recipientId}&limit=10`
    );
    const data = await response.json();
    
    if (response.ok && data.success) {
      log(`✓ Retrieved ${data.messages?.length || 0} messages`, 'green');
      
      if (data.messages && data.messages.length > 0) {
        data.messages.forEach((msg, index) => {
          log(`\nMessage ${index + 1}:`, 'blue');
          console.log('  userId:', msg.userId);
          console.log('  recipientId:', msg.recipientId);
          console.log('  message:', msg.message);
          
          // Check IDs
          if (msg.userId && msg.userId.length > 15 && !/^\d+$/.test(msg.userId)) {
            log('  ⚠ userId looks like a hero ID', 'yellow');
          }
          if (msg.recipientId && msg.recipientId.length > 15 && !/^\d+$/.test(msg.recipientId)) {
            log('  ⚠ recipientId looks like a hero ID', 'red');
          }
        });
      }
      
      return data;
    } else {
      log(`✗ History retrieval failed: ${data.error || 'Unknown error'}`, 'red');
      return null;
    }
  } catch (error) {
    log(`✗ Error getting history: ${error.message}`, 'red');
    return null;
  }
}

async function main() {
  log('\n🚀 Starting Whisper Test Suite', 'cyan');
  log('Make sure the backend server is running on http://localhost:3001\n', 'yellow');
  
  // Test 1: Check what the search API returns
  const searchResult = await testSearchAPI();
  
  if (!searchResult) {
    log('\n✗ Cannot continue without search results. Exiting.', 'red');
    return;
  }
  
  const recipientHeroId = searchResult.heroId;
  const recipientUserId = searchResult.userId || searchResult.twitchUserId;
  
  log(`\n📊 Test Data:`, 'cyan');
  log(`  Recipient Hero ID: ${recipientHeroId}`, 'blue');
  log(`  Recipient User ID: ${recipientUserId}`, 'blue');
  
  // Test 2: Try sending whisper with user ID (should work)
  if (recipientUserId && recipientUserId !== recipientHeroId) {
    await testSendWhisper(TEST_USER_ID, TEST_HERO_ID, recipientUserId, 'user-id');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
  }
  
  // Test 3: Try sending whisper with hero ID (should convert to user ID)
  if (recipientHeroId) {
    await testSendWhisper(TEST_USER_ID, TEST_HERO_ID, recipientHeroId, 'hero-id');
    await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
  }
  
  // Test 4: Try with the problematic hero ID
  await testSendWhisper(TEST_USER_ID, TEST_HERO_ID, TEST_RECIPIENT_HERO_ID, 'hero-id-problematic');
  await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1 second
  
  // Test 5: Get history
  if (recipientUserId) {
    await testGetHistory(TEST_USER_ID, recipientUserId);
  }
  
  logSection('Test Suite Complete');
  log('\n✅ Review the results above to identify any issues', 'green');
}

// Run the tests
main().catch(error => {
  log(`\n✗ Fatal error: ${error.message}`, 'red');
  console.error(error);
  process.exit(1);
});

