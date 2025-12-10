/**
 * Script to create test auctions for different item types
 * This helps test the auction house functionality
 */

import admin from 'firebase-admin';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';

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

// Helper function to find hero by username
async function findHeroByUsername(username) {
  try {
    const allHeroesSnapshot = await db.collection('heroes').get();
    
    for (const doc of allHeroesSnapshot.docs) {
      const hero = doc.data();
      const heroName = (hero.name || '').toLowerCase();
      const searchName = username.toLowerCase();
      
      if (heroName === searchName || heroName.includes(searchName) || searchName.includes(heroName)) {
        return { ...hero, docId: doc.id, id: hero.id || doc.id };
      }
      
      if (hero.twitchUserId && String(hero.twitchUserId).toLowerCase() === searchName) {
        return { ...hero, docId: doc.id, id: hero.id || doc.id };
      }
    }
    
    return null;
  } catch (error) {
    console.error(`Error finding hero for username ${username}:`, error);
    return null;
  }
}

// Calculate vendor price (matches backend logic)
function getVendorSellPrice(item) {
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

// Create test auction
async function createTestAuction(sellerHero, item, startingPrice, buyoutPrice, duration = 24) {
  try {
    // Calculate listing fee
    const vendorPrice = getVendorSellPrice(item);
    const durationMultipliers = {
      12: 0.15,
      24: 0.30,
      48: 0.60
    };
    const multiplier = durationMultipliers[duration] || 0.30;
    const listingFee = Math.max(1, Math.floor(vendorPrice * multiplier));
    
    // Get hero to check currency
    const heroRef = db.collection('heroes').doc(sellerHero.docId || sellerHero.id);
    const heroDoc = await heroRef.get();
    
    if (!heroDoc.exists) {
      console.log(`⚠️  Hero not found: ${sellerHero.name}`);
      return null;
    }
    
    const hero = heroDoc.data();
    const currentGold = hero.gold || 0;
    
    // Deduct listing fee (if hero has enough)
    if (currentGold >= listingFee) {
      await heroRef.update({
        gold: currentGold - listingFee,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } else {
      console.log(`⚠️  ${sellerHero.name} doesn't have enough gold (need ${listingFee}, have ${currentGold})`);
      return null;
    }
    
    // Calculate expiration
    const expirationTime = Date.now() + (duration * 60 * 60 * 1000);
    
    // Clean item - remove frontend-only properties
    const cleanItem = { ...item };
    delete cleanItem.heroId;
    delete cleanItem.heroName;
    delete cleanItem.allItems;
    delete cleanItem.stackKey;
    delete cleanItem.displayName;
    
    // Create listing
    const listingData = {
      sellerId: sellerHero.docId || sellerHero.id,
      sellerUsername: sellerHero.name || 'Test Seller',
      item: cleanItem,
      quantity: item.quantity || 1,
      startingPrice: startingPrice,
      buyoutPrice: buyoutPrice || null,
      currency: 'gold',
      listingFee: listingFee,
      duration: duration,
      createdAt: admin.firestore.Timestamp.now(),
      expiresAt: admin.firestore.Timestamp.fromDate(new Date(expirationTime)),
      status: 'active',
      bids: [],
      highestBid: 0,
      soldTo: null,
      soldAt: null
    };
    
    const listingRef = await db.collection('auctionListings').add(listingData);
    console.log(`✅ Created listing: ${item.name} - ${startingPrice}g (${duration}h)`);
    
    return listingRef.id;
  } catch (error) {
    console.error(`❌ Error creating listing for ${item.name}:`, error);
    return null;
  }
}

// Main function
async function createTestAuctions() {
  console.log('🧪 Creating Test Auctions\n');
  
  // Find test heroes
  const seller1 = await findHeroByUsername('theneverendingwar');
  const seller2 = await findHeroByUsername('tehchno');
  
  if (!seller1 && !seller2) {
    console.log('❌ Could not find test heroes');
    process.exit(1);
  }
  
  const sellers = [seller1, seller2].filter(s => s !== null);
  console.log(`✅ Found ${sellers.length} seller(s)\n`);
  
  // Test items to create
  const testItems = [
    // Gear items
    {
      name: 'Steel Sword',
      rarity: 'uncommon',
      slot: 'weapon',
      type: 'weapon',
      id: `test_sword_${Date.now()}`,
      stats: { attack: 10 }
    },
    {
      name: 'Iron Shield',
      rarity: 'common',
      slot: 'offhand',
      type: 'shield',
      id: `test_shield_${Date.now()}`,
      stats: { defense: 8 }
    },
    {
      name: 'Leather Boots',
      rarity: 'common',
      slot: 'boots',
      type: 'armor',
      id: `test_boots_${Date.now()}`,
      stats: { defense: 5 }
    },
    {
      name: 'Mythril Helmet',
      rarity: 'rare',
      slot: 'head',
      type: 'armor',
      id: `test_helmet_${Date.now()}`,
      stats: { defense: 15, attack: 5 }
    },
    // Consumables
    {
      name: 'Health Potion',
      rarity: 'common',
      type: 'potion',
      id: `test_potion_${Date.now()}`,
      itemKey: 'healthpotion',
      quantity: 5
    },
    {
      name: 'Mana Potion',
      rarity: 'uncommon',
      type: 'potion',
      id: `test_mana_${Date.now()}`,
      itemKey: 'manapotion',
      quantity: 3
    },
    {
      name: 'XP Boost Scroll',
      rarity: 'rare',
      type: 'buff',
      id: `test_xp_${Date.now()}`,
      itemKey: 'xpboost',
      duration: 300000
    },
    // Materials/Gems
    {
      name: 'Iron Ore',
      rarity: 'common',
      type: 'material',
      id: `test_ore_${Date.now()}`,
      quantity: 20
    },
    {
      name: 'Red Gem',
      rarity: 'uncommon',
      type: 'gem',
      id: `test_gem_${Date.now()}`,
      socketType: 'red'
    },
    {
      name: 'Diamond',
      rarity: 'epic',
      type: 'gem',
      id: `test_diamond_${Date.now()}`,
      socketType: 'prismatic'
    }
  ];
  
  let created = 0;
  let failed = 0;
  
  // Create auctions for each item
  for (const item of testItems) {
    const seller = sellers[Math.floor(Math.random() * sellers.length)];
    
    // Set prices based on item type and rarity
    let basePrice = 50;
    if (item.rarity === 'uncommon') basePrice = 100;
    else if (item.rarity === 'rare') basePrice = 250;
    else if (item.rarity === 'epic') basePrice = 500;
    else if (item.rarity === 'legendary') basePrice = 1000;
    
    // Adjust for quantity
    const quantity = item.quantity || 1;
    const startingPrice = basePrice * quantity;
    const buyoutPrice = startingPrice * 1.5;
    
    // Random duration
    const durations = [12, 24, 48];
    const duration = durations[Math.floor(Math.random() * durations.length)];
    
    const listingId = await createTestAuction(seller, item, startingPrice, buyoutPrice, duration);
    
    if (listingId) {
      created++;
    } else {
      failed++;
    }
    
    // Small delay between creations
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`\n📊 Summary:`);
  console.log(`✅ Created: ${created} auctions`);
  console.log(`❌ Failed: ${failed} auctions`);
  
  process.exit(0);
}

// Run
createTestAuctions().catch(error => {
  console.error('❌ Error:', error);
  process.exit(1);
});



