/**
 * Comprehensive Auction House Test Script
 * 
 * Tests all auction house functionality:
 * - Creating listings (single items and stacks)
 * - Placing bids
 * - Buyouts
 * - Cancelling listings
 * - Verifying item transfers
 * - Verifying payment transfers
 * - Verifying listing fee handling
 */

import admin from 'firebase-admin';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

// Load environment variables
dotenv.config();

// Initialize Firebase Admin
let db;
try {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY || '{}');
  if (Object.keys(serviceAccount).length > 0) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    db = admin.firestore();
  } else {
    // Try loading from file
    try {
      const { readFileSync } = await import('fs');
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = dirname(__filename);
      const serviceAccountPath = join(__dirname, '..', 'serviceAccountKey.json');
      const serviceAccountContent = readFileSync(serviceAccountPath, 'utf8');
      const serviceAccountFile = JSON.parse(serviceAccountContent);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccountFile)
      });
      db = admin.firestore();
    } catch (err) {
      console.error('❌ FIREBASE_SERVICE_ACCOUNT_KEY not set and serviceAccountKey.json not found');
      process.exit(1);
    }
  }
} catch (error) {
  console.error('❌ Failed to initialize Firebase:', error);
  process.exit(1);
}

// Firebase initialization is done above

// Test configuration
const API_URL = process.env.API_URL || 'http://localhost:3001';

// Test hero usernames (will be resolved to hero IDs)
const TEST_SELLER_USERNAME = 'theneverendingwar';
const TEST_BUYER_USERNAME = 'tehchno';

let TEST_SELLER_HERO_ID = '';
let TEST_BUYER_HERO_ID = '';

// Helper function to find hero by username (searches by hero name)
async function findHeroByUsername(username) {
  try {
    // Search all heroes and find by name (case-insensitive partial match)
    const allHeroesSnapshot = await db.collection('heroes').get();
    
    for (const doc of allHeroesSnapshot.docs) {
      const hero = doc.data();
      const heroName = (hero.name || '').toLowerCase();
      const searchName = username.toLowerCase();
      
      // Check if hero name contains the username or matches exactly
      if (heroName === searchName || heroName.includes(searchName) || searchName.includes(heroName)) {
        // Return hero data with document ID
        // The API uses Firestore document IDs (doc.id), not the hero.id field
        const heroData = { ...hero };
        // Preserve internal ID if it exists
        heroData.internalId = hero.id;
        heroData.docId = doc.id;
        // Use document ID as the main id for API calls
        heroData.id = doc.id;
        return heroData;
      }
      
      // Also check twitchUserId as string (in case username matches)
      if (hero.twitchUserId && String(hero.twitchUserId).toLowerCase() === searchName) {
        const heroData = { ...hero };
        heroData.internalId = hero.id;
        heroData.docId = doc.id;
        heroData.id = doc.id;
        return heroData;
      }
    }
    
    // If no match found, return null
    return null;
  } catch (error) {
    console.error(`Error finding hero for username ${username}:`, error);
    return null;
  }
}

// Helper function to get hero data
// The API uses Firestore document IDs, so we should use document IDs for lookups
async function getHero(heroId) {
  // Try by document ID first (this is what the API uses)
  const heroDoc = await db.collection('heroes').doc(heroId).get();
  if (heroDoc.exists) {
    const data = heroDoc.data();
    return { ...data, docId: heroDoc.id };
  }
  
  // If not found by document ID, try searching by internal ID (hero.id field)
  const heroesById = await db.collection('heroes')
    .where('id', '==', heroId)
    .limit(1)
    .get();
  
  if (!heroesById.empty) {
    const doc = heroesById.docs[0];
    const data = doc.data();
    return { ...data, docId: doc.id };
  }
  
  // Try characterId field
  const heroesByCharId = await db.collection('heroes')
    .where('characterId', '==', heroId)
    .limit(1)
    .get();
  
  if (!heroesByCharId.empty) {
    const doc = heroesByCharId.docs[0];
    const data = doc.data();
    return { ...data, docId: doc.id };
  }
  
  throw new Error(`Hero ${heroId} not found by document ID, internal ID, or characterId`);
}

// Helper function to make API requests
async function apiRequest(method, endpoint, data = null) {
  const url = `${API_URL}/api/auction${endpoint}`;
  const options = {
    method,
    headers: {
      'Content-Type': 'application/json'
    }
  };
  
  if (data) {
    options.body = JSON.stringify(data);
  }
  
  try {
    const response = await fetch(url, options);
    const result = await response.json();
    return { status: response.status, data: result };
  } catch (error) {
    return { status: 500, error: error.message };
  }
}

// Helper to log test results
function logTest(testName, passed, details = '') {
  const icon = passed ? '✅' : '❌';
  console.log(`${icon} ${testName}`);
  if (details) {
    console.log(`   ${details}`);
  }
  return passed;
}

// Test 1: Create a listing
async function testCreateListing() {
  console.log('\n📝 Test 1: Creating a Listing');
  
  if (!TEST_SELLER_HERO_ID) {
    console.log('⏭️  Skipped (no TEST_SELLER_HERO_ID)');
    return null;
  }
  
  try {
    // Get seller hero
    const seller = await getHero(TEST_SELLER_HERO_ID);
    
    // Check seller has items
    const inventory = seller.inventory || [];
    if (inventory.length === 0) {
      console.log('⏭️  Skipped (seller has no inventory)');
      return null;
    }
    
    // Pick first item
    const testItem = inventory[0];
    const isStackable = !testItem.slot;
    const quantity = isStackable ? Math.min(5, inventory.filter(i => 
      i.name === testItem.name && 
      (i.rarity || 'common') === (testItem.rarity || 'common')
    ).length) : 1;
    
    // Get initial state
    const initialGold = seller.gold || 0;
    const initialInventorySize = inventory.length;
    
    // Create listing
    const listingData = {
      sellerId: TEST_SELLER_HERO_ID,
      sellerUsername: seller.name || 'Test Seller',
      item: {
        ...testItem,
        heroId: undefined,
        heroName: undefined,
        allItems: undefined,
        stackKey: undefined,
        displayName: undefined
      },
      startingPrice: 100,
      buyoutPrice: 200,
      currency: 'gold',
      quantity: quantity,
      duration: '24'
    };
    
    const result = await apiRequest('POST', '/list', listingData);
    
    if (result.status === 201 && result.data.id) {
      // Verify seller state
      const sellerAfter = await getHero(TEST_SELLER_HERO_ID);
      const afterInventorySize = (sellerAfter.inventory || []).length;
      const afterGold = sellerAfter.gold || 0;
      
      // Get actual listing fee from the response
      const actualListingFee = result.data.listingFee || 0;
      const expectedGold = initialGold - actualListingFee;
      const expectedInventorySize = initialInventorySize - quantity;
      
      // Allow 2 gold tolerance for rounding differences
      const feeCorrect = Math.abs(afterGold - expectedGold) <= 2;
      const inventoryCorrect = afterInventorySize === expectedInventorySize;
      
      logTest('Listing created', true, `Listing ID: ${result.data.id}`);
      logTest('Listing fee deducted', feeCorrect, 
        `Expected: ${expectedGold} (fee: ${actualListingFee}), Got: ${afterGold}`);
      logTest('Items removed from inventory', inventoryCorrect, 
        `Expected: ${expectedInventorySize}, Got: ${afterInventorySize}`);
      
      return result.data;
    } else {
      logTest('Listing created', false, `Status: ${result.status}, Error: ${JSON.stringify(result.data)}`);
      return null;
    }
  } catch (error) {
    logTest('Listing created', false, error.message);
    return null;
  }
}

// Test 2: Place a bid
async function testPlaceBid(listingId) {
  console.log('\n💵 Test 2: Placing a Bid');
  
  if (!listingId || !TEST_BUYER_HERO_ID) {
    console.log('⏭️  Skipped (no listing ID or TEST_BUYER_HERO_ID)');
    return false;
  }
  
  try {
    // Get listing
    const listingDoc = await db.collection('auctionListings').doc(listingId).get();
    if (!listingDoc.exists) {
      logTest('Get listing', false, 'Listing not found');
      return false;
    }
    
    const listing = listingDoc.data();
    const buyer = await getHero(TEST_BUYER_HERO_ID);
    
    // Skip if buyer is the seller
    if (buyer.id === listing.sellerId) {
      console.log('⏭️  Skipped (buyer is seller)');
      return false;
    }
    
    const initialCurrency = listing.currency === 'gold' ? (buyer.gold || 0) : (buyer.tokens || 0);
    const bidAmount = listing.startingPrice + 10;
    
    // Place bid
    const bidData = {
      userId: TEST_BUYER_HERO_ID,
      username: buyer.name || 'Test Buyer',
      amount: bidAmount
    };
    
    const result = await apiRequest('POST', `/${listingId}/bid`, bidData);
    
    if (result.status === 200 && result.data.success) {
      // Verify buyer state
      const buyerAfter = await getHero(TEST_BUYER_HERO_ID);
      const afterCurrency = listing.currency === 'gold' ? (buyerAfter.gold || 0) : (buyerAfter.tokens || 0);
      const expectedCurrency = initialCurrency - bidAmount;
      
      // Verify listing
      const listingAfter = await db.collection('auctionListings').doc(listingId).get();
      const listingData = listingAfter.data();
      
      const currencyCorrect = afterCurrency === expectedCurrency;
      const highestBidCorrect = listingData.highestBid === bidAmount;
      const bidCountCorrect = listingData.bids && listingData.bids.length > 0;
      
      logTest('Bid placed', true);
      logTest('Currency deducted', currencyCorrect, 
        `Expected: ${expectedCurrency}, Got: ${afterCurrency}`);
      logTest('Highest bid updated', highestBidCorrect, 
        `Expected: ${bidAmount}, Got: ${listingData.highestBid}`);
      logTest('Bid recorded', bidCountCorrect, 
        `${listingData.bids?.length || 0} bid(s) in listing`);
      
      return currencyCorrect && highestBidCorrect && bidCountCorrect;
    } else {
      logTest('Bid placed', false, `Status: ${result.status}, Error: ${JSON.stringify(result.data)}`);
      return false;
    }
  } catch (error) {
    logTest('Bid placed', false, error.message);
    return false;
  }
}

// Test 3: Buyout
async function testBuyout(listingId) {
  console.log('\n🛒 Test 3: Buyout');
  
  if (!listingId || !TEST_BUYER_HERO_ID) {
    console.log('⏭️  Skipped (no listing ID or TEST_BUYER_HERO_ID)');
    return false;
  }
  
  try {
    // Get listing
    const listingDoc = await db.collection('auctionListings').doc(listingId).get();
    if (!listingDoc.exists) {
      logTest('Get listing', false, 'Listing not found');
      return false;
    }
    
    const listing = listingDoc.data();
    
    // Skip if no buyout price
    if (!listing.buyoutPrice) {
      console.log('⏭️  Skipped (no buyout price)');
      return false;
    }
    
    const buyer = await getHero(TEST_BUYER_HERO_ID);
    const seller = await getHero(listing.sellerId);
    
    // Skip if buyer is seller
    if (buyer.id === listing.sellerId) {
      console.log('⏭️  Skipped (buyer is seller)');
      return false;
    }
    
    const buyoutPrice = listing.buyoutPrice;
    const initialBuyerCurrency = listing.currency === 'gold' ? (buyer.gold || 0) : (buyer.tokens || 0);
    const initialSellerCurrency = listing.currency === 'gold' ? (seller.gold || 0) : (seller.tokens || 0);
    const initialBuyerInventorySize = (buyer.inventory || []).length;
    
    // Calculate expected values
    const transactionFee = Math.floor(buyoutPrice * 0.05);
    const sellerPayment = buyoutPrice - transactionFee;
    const expectedBuyerCurrency = initialBuyerCurrency - buyoutPrice;
    const expectedSellerCurrency = initialSellerCurrency + sellerPayment;
    const quantity = listing.quantity || 1;
    const expectedBuyerInventorySize = initialBuyerInventorySize + quantity;
    
    // Check buyer has enough currency
    if (initialBuyerCurrency < buyoutPrice) {
      console.log(`⏭️  Skipped (buyer has insufficient ${listing.currency})`);
      return false;
    }
    
    // Perform buyout
    const buyoutData = {
      userId: TEST_BUYER_HERO_ID,
      username: buyer.name || 'Test Buyer'
    };
    
    const result = await apiRequest('POST', `/${listingId}/buyout`, buyoutData);
    
    if (result.status === 200 && result.data.success) {
      // Verify buyer state
      const buyerAfter = await getHero(TEST_BUYER_HERO_ID);
      const afterBuyerCurrency = listing.currency === 'gold' ? (buyerAfter.gold || 0) : (buyerAfter.tokens || 0);
      const afterBuyerInventorySize = (buyerAfter.inventory || []).length;
      
      // Verify seller state
      const sellerAfter = await getHero(listing.sellerId);
      const afterSellerCurrency = listing.currency === 'gold' ? (sellerAfter.gold || 0) : (sellerAfter.tokens || 0);
      
      // Verify listing status
      const listingAfter = await db.collection('auctionListings').doc(listingId).get();
      const listingData = listingAfter.data();
      
      const buyerCurrencyCorrect = afterBuyerCurrency === expectedBuyerCurrency;
      const buyerInventoryCorrect = afterBuyerInventorySize === expectedBuyerInventorySize;
      const sellerCurrencyCorrect = afterSellerCurrency === expectedSellerCurrency;
      const listingSold = listingData.status === 'sold';
      const listingSoldTo = listingData.soldTo === TEST_BUYER_HERO_ID;
      
      // Check item(s) is/are in buyer inventory
      const buyerInventory = buyerAfter.inventory || [];
      let itemCount = 0;
      buyerInventory.forEach(item => {
        if (listing.item.id && item.id === listing.item.id) {
          itemCount++;
        } else if (!listing.item.id && item.name === listing.item.name && 
                   (item.rarity || 'common') === (listing.item.rarity || 'common')) {
          itemCount++;
        }
      });
      const itemInInventory = itemCount >= quantity;
      
      logTest('Buyout successful', true);
      logTest('Buyer currency deducted', buyerCurrencyCorrect, 
        `Expected: ${expectedBuyerCurrency}, Got: ${afterBuyerCurrency}`);
      logTest('Seller currency received', sellerCurrencyCorrect, 
        `Expected: ${expectedSellerCurrency}, Got: ${afterSellerCurrency} (payment: ${sellerPayment}, fee: ${transactionFee})`);
      logTest('Item added to buyer inventory', buyerInventoryCorrect && itemInInventory, 
        `Expected size: ${expectedBuyerInventorySize}, Got: ${afterBuyerInventorySize}`);
      logTest('Listing marked as sold', listingSold && listingSoldTo);
      
      return buyerCurrencyCorrect && sellerCurrencyCorrect && buyerInventoryCorrect && itemInInventory && listingSold;
    } else {
      logTest('Buyout successful', false, `Status: ${result.status}, Error: ${JSON.stringify(result.data)}`);
      return false;
    }
  } catch (error) {
    logTest('Buyout successful', false, error.message);
    return false;
  }
}

// Test 4: Cancel listing (with refund)
async function testCancelListing() {
  console.log('\n❌ Test 4: Cancel Listing');
  
  if (!TEST_SELLER_HERO_ID) {
    console.log('⏭️  Skipped (no TEST_SELLER_HERO_ID)');
    return false;
  }
  
  try {
    // Create a new listing to cancel
    const seller = await getHero(TEST_SELLER_HERO_ID);
    const inventory = seller.inventory || [];
    
    if (inventory.length === 0) {
      console.log('⏭️  Skipped (seller has no inventory)');
      return false;
    }
    
    const testItem = inventory[0];
    const initialGold = seller.gold || 0;
    const initialInventorySize = inventory.length;
    
    // Create listing
    const listingData = {
      sellerId: TEST_SELLER_HERO_ID,
      sellerUsername: seller.name || 'Test Seller',
      item: {
        ...testItem,
        heroId: undefined,
        heroName: undefined,
        allItems: undefined,
        stackKey: undefined,
        displayName: undefined
      },
      startingPrice: 100,
      buyoutPrice: 200,
      currency: 'gold',
      quantity: 1,
      duration: '24'
    };
    
    const createResult = await apiRequest('POST', '/list', listingData);
    
    if (createResult.status !== 201) {
      logTest('Cancel listing', false, 'Failed to create listing for cancel test');
      return false;
    }
    
    const listingId = createResult.data.id;
    const listingFee = createResult.data.listingFee || 0;
    
    // Get seller state right after listing creation (before cancellation)
    const sellerBeforeCancel = await getHero(TEST_SELLER_HERO_ID);
    const goldBeforeCancel = sellerBeforeCancel.gold || 0;
    
    // Cancel listing
    const cancelData = {
      userId: TEST_SELLER_HERO_ID
    };
    
    const result = await apiRequest('POST', `/${listingId}/cancel`, cancelData);
    
    if (result.status === 200 && result.data.success) {
      // Verify seller state (listing fee should NOT be refunded, but item should be returned)
      const sellerAfter = await getHero(TEST_SELLER_HERO_ID);
      const afterGold = sellerAfter.gold || 0;
      const afterInventorySize = (sellerAfter.inventory || []).length;
      
      // Verify listing status
      const listingDoc = await db.collection('auctionListings').doc(listingId).get();
      const listingStatus = listingDoc.data()?.status;
      
      // Item should be returned, but fee should NOT be refunded (per WoW mechanics)
      // Gold should remain the same as before cancellation (no refund)
      const itemReturned = afterInventorySize === initialInventorySize;
      const feeNotRefunded = Math.abs(afterGold - goldBeforeCancel) <= 1; // Allow 1 gold tolerance
      const listingCancelled = listingStatus === 'cancelled';
      
      logTest('Listing cancelled', true);
      logTest('Item returned to inventory', itemReturned, 
        `Expected: ${initialInventorySize}, Got: ${afterInventorySize}`);
      logTest('Listing fee not refunded', feeNotRefunded, 
        `Gold before cancel: ${goldBeforeCancel}, Gold after: ${afterGold} (fee ${listingFee} should NOT be refunded)`);
      logTest('Listing status updated', listingCancelled);
      
      return itemReturned && feeNotRefunded && listingCancelled;
    } else {
      logTest('Listing cancelled', false, `Status: ${result.status}, Error: ${JSON.stringify(result.data)}`);
      return false;
    }
  } catch (error) {
    logTest('Listing cancelled', false, error.message);
    return false;
  }
}

// Helper: Calculate vendor price (matches backend logic)
function calculateVendorPrice(item) {
  const rarityMultipliers = {
    common: 1,
    uncommon: 5,
    rare: 20,
    epic: 100,
    legendary: 500
  };
  
  const basePrice = rarityMultipliers[item.rarity || 'common'] || 1;
  
  if (item.slot) {
    return basePrice * 10;
  } else if (item.type === 'potion' || item.type === 'buff' || item.name?.toLowerCase().includes('potion')) {
    return basePrice * 2;
  } else {
    return basePrice;
  }
}

// Main test runner
async function runTests() {
  console.log('🧪 Auction House Comprehensive Test Suite\n');
  console.log(`API URL: ${API_URL}\n`);
  
  // Find test heroes by username
  console.log('🔍 Looking up test heroes...');
  const sellerHero = await findHeroByUsername(TEST_SELLER_USERNAME);
  const buyerHero = await findHeroByUsername(TEST_BUYER_USERNAME);
  
  if (sellerHero) {
    // Use the id field which we set to the document ID
    TEST_SELLER_HERO_ID = sellerHero.id || sellerHero.docId;
    const internalId = sellerHero.internalId || 'N/A';
    console.log(`✅ Found seller: ${sellerHero.name || 'Unknown'}`);
    console.log(`   Using ID for API: ${TEST_SELLER_HERO_ID}`);
    if (internalId !== 'N/A' && internalId !== TEST_SELLER_HERO_ID) {
      console.log(`   (Internal ID: ${internalId})`);
    }
  } else {
    console.log(`❌ Could not find seller hero for username: ${TEST_SELLER_USERNAME}`);
  }
  
  if (buyerHero) {
    // Use the id field which we set to the document ID
    TEST_BUYER_HERO_ID = buyerHero.id || buyerHero.docId;
    const internalId = buyerHero.internalId || 'N/A';
    console.log(`✅ Found buyer: ${buyerHero.name || 'Unknown'}`);
    console.log(`   Using ID for API: ${TEST_BUYER_HERO_ID}`);
    if (internalId !== 'N/A' && internalId !== TEST_BUYER_HERO_ID) {
      console.log(`   (Internal ID: ${internalId})`);
    }
  } else {
    console.log(`❌ Could not find buyer hero for username: ${TEST_BUYER_USERNAME}`);
  }
  console.log('');
  
  if (!TEST_SELLER_HERO_ID) {
    console.log('⚠️  Cannot proceed without seller hero');
    process.exit(1);
  }
  
  if (!TEST_BUYER_HERO_ID) {
    console.log('⚠️  Some tests will be skipped without buyer hero');
  }
  
  const results = {
    createListing: false,
    placeBid: false,
    buyout: false,
    cancelListing: false
  };
  
  // Test 1: Create listing
  const listing = await testCreateListing();
  results.createListing = listing !== null;
  
  if (listing) {
    // Test 2: Place bid (only if we have a buyer)
    if (TEST_BUYER_HERO_ID && listing.sellerId !== TEST_BUYER_HERO_ID) {
      results.placeBid = await testPlaceBid(listing.id);
    }
    
    // Test 3: Buyout (create a new listing for this)
    if (TEST_BUYER_HERO_ID && listing.sellerId !== TEST_BUYER_HERO_ID) {
      // Create another listing for buyout test
      const seller = await getHero(TEST_SELLER_HERO_ID);
      const inventory = seller.inventory || [];
      if (inventory.length > 0) {
        const buyoutTestItem = inventory.find(i => i.name !== listing.item.name) || inventory[0];
        const buyoutListingData = {
          sellerId: TEST_SELLER_HERO_ID,
          sellerUsername: seller.name || 'Test Seller',
          item: {
            ...buyoutTestItem,
            heroId: undefined,
            heroName: undefined,
            allItems: undefined,
            stackKey: undefined,
            displayName: undefined
          },
          startingPrice: 100,
          buyoutPrice: 150,
          currency: 'gold',
          quantity: 1,
          duration: '24'
        };
        
        const buyoutCreateResult = await apiRequest('POST', '/list', buyoutListingData);
        if (buyoutCreateResult.status === 201) {
          results.buyout = await testBuyout(buyoutCreateResult.data.id);
        }
      }
    }
  }
  
  // Test 4: Cancel listing
  results.cancelListing = await testCancelListing();
  
  // Summary
  console.log('\n📊 Test Summary');
  console.log('='.repeat(50));
  logTest('Create Listing', results.createListing);
  logTest('Place Bid', results.placeBid);
  logTest('Buyout', results.buyout);
  logTest('Cancel Listing', results.cancelListing);
  
  const totalTests = Object.keys(results).length;
  const passedTests = Object.values(results).filter(r => r).length;
  const percentage = Math.round((passedTests / totalTests) * 100);
  
  console.log('\n' + '='.repeat(50));
  console.log(`Results: ${passedTests}/${totalTests} tests passed (${percentage}%)`);
  
  if (passedTests === totalTests) {
    console.log('✅ All tests passed!');
    process.exit(0);
  } else {
    console.log('❌ Some tests failed');
    process.exit(1);
  }
}

// Run tests
runTests().catch(error => {
  console.error('❌ Test suite error:', error);
  process.exit(1);
});







