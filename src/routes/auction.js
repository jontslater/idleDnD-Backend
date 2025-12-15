import express from 'express';
import admin from 'firebase-admin';
import { db } from '../index.js';

const router = express.Router();

// Browse listings with filters
router.get('/listings', async (req, res) => {
  try {
    const { itemType, rarity, minPrice, maxPrice, currency, status = 'active' } = req.query;
    
    let query = db.collection('auctionListings').where('status', '==', status);
    
    // Apply filters
    if (currency && currency !== 'all') {
      query = query.where('currency', '==', currency);
    }
    
    const snapshot = await query.get();
    let listings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    console.log(`📋 Found ${listings.length} active listings before filtering`);
    
    // Helper function to get item category (matches frontend logic)
    const getItemCategory = (item) => {
      if (!item) return 'other';
      if (item.slot) return 'gear';
      if (item.type === 'potion' || item.type === 'buff' || item.name?.toLowerCase().includes('potion') || 
          item.name?.toLowerCase().includes('scroll') || item.name?.toLowerCase().includes('boost')) {
        return 'consumable';
      }
      if (item.name?.toLowerCase().includes('gem') || item.name?.toLowerCase().includes('socket') || 
          item.type?.includes('material')) {
        return 'material';
      }
      return 'other';
    };
    
    // Client-side filtering (Firestore doesn't support all filters)
    if (itemType && itemType !== 'all') {
      // Filter by category (gear, consumable, material) not slot
      listings = listings.filter(l => getItemCategory(l.item) === itemType);
    }
    if (rarity && rarity !== 'all') {
      listings = listings.filter(l => (l.item?.rarity || 'common').toLowerCase() === rarity.toLowerCase());
    }
    if (minPrice) {
      const min = Number(minPrice);
      listings = listings.filter(l => (l.highestBid || l.startingPrice) >= min);
    }
    if (maxPrice) {
      const max = Number(maxPrice);
      listings = listings.filter(l => (l.highestBid || l.startingPrice) <= max);
    }
    
    // Sort by creation date (newest first)
    listings.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() ?? new Date(a.createdAt ?? 0).getTime();
      const bTime = b.createdAt?.toMillis?.() ?? new Date(b.createdAt ?? 0).getTime();
      return bTime - aTime;
    });
    
    res.json(listings);
  } catch (error) {
    console.error('Error fetching listings:', error);
    res.status(500).json({ error: 'Failed to fetch listings' });
  }
});

// Calculate vendor sell price (estimated based on rarity and type)
function getVendorSellPrice(item) {
  const rarityMultipliers = {
    common: 1,
    uncommon: 5,
    rare: 20,
    epic: 100,
    legendary: 500
  };
  
  const basePrice = rarityMultipliers[item.rarity || 'common'] || 1;
  
  // Adjust by item type
  if (item.slot) {
    // Gear: higher value
    return basePrice * 10;
  } else if (item.type === 'potion' || item.type === 'buff' || item.name?.toLowerCase().includes('potion')) {
    // Consumables: moderate value
    return basePrice * 2;
  } else {
    // Materials: lower value
    return basePrice;
  }
}

// Create listing
router.post('/list', async (req, res) => {
  try {
    const { sellerId, sellerUsername, item, startingPrice, buyoutPrice, currency = 'gold', quantity = 1, duration = '24' } = req.body;
    
    if (!sellerId || !item || !startingPrice) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (currency !== 'gold' && currency !== 'tokens') {
      return res.status(400).json({ error: 'Invalid currency' });
    }
    
    const validDurations = ['12', '24', '48'];
    if (!validDurations.includes(duration)) {
      return res.status(400).json({ error: 'Invalid duration. Must be 12, 24, or 48 hours' });
    }
    
    const quantityNum = parseInt(quantity) || 1;
    if (quantityNum < 1) {
      return res.status(400).json({ error: 'Quantity must be at least 1' });
    }
    
    // Clean item first to remove frontend-only properties
    // Remove frontend-only properties like heroId, heroName, allItems, stackKey, displayName
    const { heroId: _heroId, heroName: _heroName, allItems: _allItems, stackKey: _stackKey, displayName: _displayName, ...cleanItem } = item;
    
    // Calculate listing fee (WoW-style: % of vendor price based on duration)
    const vendorPrice = getVendorSellPrice(cleanItem);
    const durationMultipliers = {
      '12': 0.15,  // 15% for 12 hours
      '24': 0.30,  // 30% for 24 hours
      '48': 0.60   // 60% for 48 hours
    };
    
    const multiplier = durationMultipliers[duration] || 0.30;
    const feePerItem = Math.max(1, Math.floor(vendorPrice * multiplier));
    const listingFee = feePerItem * quantityNum;
    
    // Check seller has enough currency
    const heroRef = db.collection('heroes').doc(sellerId);
    const heroDoc = await heroRef.get();
    
    if (!heroDoc.exists) {
      return res.status(404).json({ error: 'Hero not found' });
    }
    
    const hero = heroDoc.data();
    const currentCurrency = currency === 'gold' ? (hero.gold || 0) : (hero.tokens || 0);
    
    if (currentCurrency < listingFee) {
      return res.status(400).json({ 
        error: `Not enough ${currency}. Need ${listingFee}, have ${currentCurrency}` 
      });
    }
    
    // Check items are in inventory
    const inventory = hero.inventory || [];
    console.log(`📦 Hero inventory size: ${inventory.length}`);
    
    // For stackable items, we need to find items matching the stack key
    // The frontend sends the first item from the stack, but we need to find all matching items
    const isStackable = !cleanItem.slot; // Items without a slot are stackable
    let itemsToRemove = [];
    
    if (isStackable) {
      // Find all items with matching name and rarity (for stackables)
      const matchingItems = inventory.filter(i => 
        i.name === cleanItem.name && 
        (i.rarity || 'common') === (cleanItem.rarity || 'common') &&
        !i.slot // Ensure it's stackable
      );
      
      console.log(`🔍 Found ${matchingItems.length} matching stackable items for ${cleanItem.name}`);
      
      if (matchingItems.length < quantityNum) {
        return res.status(400).json({ 
          error: `Not enough items in inventory. Need ${quantityNum}, have ${matchingItems.length}` 
        });
      }
      
      // Take the first N items from the matching stack
      itemsToRemove = matchingItems.slice(0, quantityNum);
    } else {
      // For non-stackable items (gear), find the exact item by ID
      const itemIndex = inventory.findIndex(i => i.id === cleanItem.id);
      if (itemIndex === -1) {
        console.error(`❌ Item not found in inventory: ${cleanItem.id} (${cleanItem.name})`);
        return res.status(400).json({ error: 'Item not in inventory' });
      }
      itemsToRemove = [inventory[itemIndex]];
    }
    
    // Remove items from inventory
    itemsToRemove.forEach(itemToRemove => {
      const index = inventory.findIndex(i => i.id === itemToRemove.id);
      if (index !== -1) {
        inventory.splice(index, 1);
      }
    });
    
    // Prepare item for listing (include quantity only if > 1)
    const listingItem = {
      ...cleanItem
    };
    // Only add quantity field if > 1 (to avoid undefined in Firestore)
    if (quantityNum > 1) {
      listingItem.quantity = quantityNum;
    }
    
    // Deduct listing fee
    const updates = {
      inventory,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    if (currency === 'gold') {
      updates.gold = currentCurrency - listingFee;
    } else {
      updates.tokens = currentCurrency - listingFee;
    }
    
    await heroRef.update(updates);
    
    // Calculate expiration time based on duration
    const durationHours = parseInt(duration);
    const expirationTime = Date.now() + (durationHours * 60 * 60 * 1000);
    
    // Get hero name for sellerUsername if not provided
    const finalSellerUsername = sellerUsername || hero.name || hero.id || 'Unknown';
    
    // Create listing
    const listingData = {
      sellerId,
      sellerUsername: finalSellerUsername,
      item: listingItem,
      quantity: quantityNum,
      startingPrice: Number(startingPrice),
      buyoutPrice: buyoutPrice ? Number(buyoutPrice) : null,
      currency,
      listingFee,
      duration: durationHours,
      createdAt: admin.firestore.Timestamp.now(),
      expiresAt: admin.firestore.Timestamp.fromDate(new Date(expirationTime)),
      status: 'active',
      bids: [],
      highestBid: 0,
      soldTo: null,
      soldAt: null
    };
    
    const listingRef = await db.collection('auctionListings').add(listingData);
    const listingDoc = await listingRef.get();
    
    console.log(`💰 ${sellerId} listed ${quantityNum}x ${listingItem.name} for ${startingPrice} ${currency} (${duration}h, fee: ${listingFee})`);
    
    res.status(201).json({ id: listingDoc.id, ...listingDoc.data() });
  } catch (error) {
    console.error('❌ Error creating listing:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({ error: 'Failed to create listing: ' + (error.message || 'Unknown error') });
  }
});

// Place bid
router.post('/:listingId/bid', async (req, res) => {
  try {
    const { listingId } = req.params;
    const { userId, username, amount } = req.body;
    
    if (!userId || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    const listingRef = db.collection('auctionListings').doc(listingId);
    const listingDoc = await listingRef.get();
    
    if (!listingDoc.exists) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    
    const listing = listingDoc.data();
    
    if (listing.status !== 'active') {
      return res.status(400).json({ error: 'Listing is not active' });
    }
    
    if (listing.sellerId === userId) {
      return res.status(400).json({ error: 'Cannot bid on your own listing' });
    }
    
    const bidAmount = Number(amount);
    const minBid = Math.max(listing.startingPrice, listing.highestBid + 1);
    
    if (bidAmount < minBid) {
      return res.status(400).json({ error: `Bid must be at least ${minBid}` });
    }
    
    // Check buyer has enough currency
    const heroRef = db.collection('heroes').doc(userId);
    const heroDoc = await heroRef.get();
    
    if (!heroDoc.exists) {
      return res.status(404).json({ error: 'Hero not found' });
    }
    
    const hero = heroDoc.data();
    const currentCurrency = listing.currency === 'gold' ? (hero.gold || 0) : (hero.tokens || 0);
    
    if (currentCurrency < bidAmount) {
      return res.status(400).json({ 
        error: `Not enough ${listing.currency}. Need ${bidAmount}, have ${currentCurrency}` 
      });
    }
    
    // Refund previous highest bidder if exists
    if (listing.highestBid > 0 && listing.bids.length > 0) {
      const lastBid = listing.bids[listing.bids.length - 1];
      const lastBidderRef = db.collection('heroes').doc(lastBid.userId);
      const lastBidderDoc = await lastBidderRef.get();
      
      if (lastBidderDoc.exists) {
        const lastBidder = lastBidderDoc.data();
        const refundUpdates = {
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        
        if (listing.currency === 'gold') {
          refundUpdates.gold = (lastBidder.gold || 0) + lastBid.amount;
        } else {
          refundUpdates.tokens = (lastBidder.tokens || 0) + lastBid.amount;
        }
        
        await lastBidderRef.update(refundUpdates);
      }
    }
    
    // Deduct bid amount from buyer
    const buyerUpdates = {
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    if (listing.currency === 'gold') {
      buyerUpdates.gold = currentCurrency - bidAmount;
    } else {
      buyerUpdates.tokens = currentCurrency - bidAmount;
    }
    
    await heroRef.update(buyerUpdates);
    
    // Add bid to listing
    const newBid = {
      userId,
      username: username || hero.name || 'Unknown',
      amount: bidAmount,
      bidAt: admin.firestore.Timestamp.now()
    };
    
    await listingRef.update({
      bids: admin.firestore.FieldValue.arrayUnion(newBid),
      highestBid: bidAmount,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`💵 ${userId} bid ${bidAmount} ${listing.currency} on listing ${listingId}`);
    
    res.json({ success: true, bid: newBid });
  } catch (error) {
    console.error('Error placing bid:', error);
    res.status(500).json({ error: 'Failed to place bid' });
  }
});

// Buyout
router.post('/:listingId/buyout', async (req, res) => {
  try {
    const { listingId } = req.params;
    const { userId, username } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }
    
    const listingRef = db.collection('auctionListings').doc(listingId);
    const listingDoc = await listingRef.get();
    
    if (!listingDoc.exists) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    
    const listing = listingDoc.data();
    
    if (listing.status !== 'active') {
      return res.status(400).json({ error: 'Listing is not active' });
    }
    
    if (!listing.buyoutPrice) {
      return res.status(400).json({ error: 'Listing has no buyout price' });
    }
    
    if (listing.sellerId === userId) {
      return res.status(400).json({ error: 'Cannot buyout your own listing' });
    }
    
    const buyoutPrice = listing.buyoutPrice;
    
    // Check buyer has enough currency
    const buyerRef = db.collection('heroes').doc(userId);
    const buyerDoc = await buyerRef.get();
    
    if (!buyerDoc.exists) {
      return res.status(404).json({ error: 'Hero not found' });
    }
    
    const buyer = buyerDoc.data();
    const currentCurrency = listing.currency === 'gold' ? (buyer.gold || 0) : (buyer.tokens || 0);
    
    if (currentCurrency < buyoutPrice) {
      return res.status(400).json({ 
        error: `Not enough ${listing.currency}. Need ${buyoutPrice}, have ${currentCurrency}` 
      });
    }
    
    // Refund all bidders
    if (listing.bids && listing.bids.length > 0) {
      for (const bid of listing.bids) {
        const bidderRef = db.collection('heroes').doc(bid.userId);
        const bidderDoc = await bidderRef.get();
        
        if (bidderDoc.exists) {
          const bidder = bidderDoc.data();
          const refundUpdates = {
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          };
          
          if (listing.currency === 'gold') {
            refundUpdates.gold = (bidder.gold || 0) + bid.amount;
          } else {
            refundUpdates.tokens = (bidder.tokens || 0) + bid.amount;
          }
          
          await bidderRef.update(refundUpdates);
        }
      }
    }
    
    // Deduct buyout price from buyer
    // For stacked items (quantity > 1), add multiple items to inventory
    const quantity = listing.quantity || 1;
    const itemsToAdd = [];
    for (let i = 0; i < quantity; i++) {
      let itemToAdd = { ...listing.item };
      
      // Ensure consumables have proper properties for auto-use detection
      // This ensures items purchased from auction house work the same as shop purchases
      if (itemToAdd.type === 'potion' || itemToAdd.name?.toLowerCase().includes('health potion')) {
        // Ensure health potions have itemKey for auto-use detection
        if (!itemToAdd.itemKey && itemToAdd.name?.toLowerCase().includes('health potion')) {
          itemToAdd.itemKey = 'healthpotion';
        }
        // Ensure type is set
        if (!itemToAdd.type && itemToAdd.itemKey === 'healthpotion') {
          itemToAdd.type = 'potion';
        }
      }
      
      itemsToAdd.push(itemToAdd);
    }
    
    const buyerUpdates = {
      inventory: admin.firestore.FieldValue.arrayUnion(...itemsToAdd),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    if (listing.currency === 'gold') {
      buyerUpdates.gold = currentCurrency - buyoutPrice;
    } else {
      buyerUpdates.tokens = currentCurrency - buyoutPrice;
    }
    
    await buyerRef.update(buyerUpdates);
    
    // Pay seller (minus 5% transaction fee)
    const transactionFee = Math.floor(buyoutPrice * 0.05);
    const sellerPayment = buyoutPrice - transactionFee;
    
    const sellerRef = db.collection('heroes').doc(listing.sellerId);
    const sellerDoc = await sellerRef.get();
    
    if (sellerDoc.exists) {
      const seller = sellerDoc.data();
      const sellerUpdates = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      if (listing.currency === 'gold') {
        sellerUpdates.gold = (seller.gold || 0) + sellerPayment;
      } else {
        sellerUpdates.tokens = (seller.tokens || 0) + sellerPayment;
      }
      
      await sellerRef.update(sellerUpdates);
    }
    
    // Create transaction record
    await db.collection('auctionTransactions').add({
      listingId,
      sellerId: listing.sellerId,
      buyerId: userId,
      item: listing.item,
      price: buyoutPrice,
      currency: listing.currency,
      transactionFee,
      createdAt: admin.firestore.Timestamp.now()
    });
    
    // Update listing
    await listingRef.update({
      status: 'sold',
      soldTo: userId,
      soldAt: admin.firestore.Timestamp.now(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`✅ ${userId} bought ${listing.item.name} for ${buyoutPrice} ${listing.currency}`);
    
    res.json({ success: true, message: 'Item purchased successfully' });
  } catch (error) {
    console.error('Error processing buyout:', error);
    res.status(500).json({ error: 'Failed to process buyout' });
  }
});

// Cancel listing
router.post('/:listingId/cancel', async (req, res) => {
  try {
    const { listingId } = req.params;
    const { userId } = req.body;
    
    if (!userId) {
      return res.status(400).json({ error: 'User ID required' });
    }
    
    const listingRef = db.collection('auctionListings').doc(listingId);
    const listingDoc = await listingRef.get();
    
    if (!listingDoc.exists) {
      return res.status(404).json({ error: 'Listing not found' });
    }
    
    const listing = listingDoc.data();
    
    if (listing.sellerId !== userId) {
      return res.status(403).json({ error: 'Not authorized to cancel this listing' });
    }
    
    if (listing.status !== 'active') {
      return res.status(400).json({ error: 'Listing is not active' });
    }
    
    // Refund all bidders
    if (listing.bids && listing.bids.length > 0) {
      for (const bid of listing.bids) {
        const bidderRef = db.collection('heroes').doc(bid.userId);
        const bidderDoc = await bidderRef.get();
        
        if (bidderDoc.exists) {
          const bidder = bidderDoc.data();
          const refundUpdates = {
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          };
          
          if (listing.currency === 'gold') {
            refundUpdates.gold = (bidder.gold || 0) + bid.amount;
          } else {
            refundUpdates.tokens = (bidder.tokens || 0) + bid.amount;
          }
          
          await bidderRef.update(refundUpdates);
        }
      }
    }
    
    // Return item to seller
    // For stacked items, return multiple items
    const sellerRef = db.collection('heroes').doc(listing.sellerId);
    const sellerDoc = await sellerRef.get();
    
    if (sellerDoc.exists) {
      const seller = sellerDoc.data();
      const inventory = seller.inventory || [];
      const quantity = listing.quantity || 1;
      
      // Add items back to inventory
      for (let i = 0; i < quantity; i++) {
        inventory.push(listing.item);
      }
      
      await sellerRef.update({
        inventory,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    
    // Update listing
    await listingRef.update({
      status: 'cancelled',
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`❌ ${userId} cancelled listing ${listingId}`);
    
    res.json({ success: true, message: 'Listing cancelled' });
  } catch (error) {
    console.error('Error cancelling listing:', error);
    res.status(500).json({ error: 'Failed to cancel listing' });
  }
});

// Get user's listings
router.get('/my-listings/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    console.log(`📋 Fetching listings for userId: ${userId}`);
    
    // userId could be a user ID or twitch ID - try to find all heroes for this user
    // First, try to get heroes by twitchId (userId might be twitch ID)
    let heroIds = [];
    
    // Try querying heroes by twitchUserId (try both string and number)
    const heroesByTwitch = await db.collection('heroes')
      .where('twitchUserId', '==', userId)
      .get();
    
    heroIds = heroIds.concat(heroesByTwitch.docs.map(doc => doc.id));
    
    // Also try as number if userId is numeric (twitchUserId might be stored as number)
    if (!isNaN(userId) && !heroesByTwitch.docs.length) {
      const heroesByTwitchNum = await db.collection('heroes')
        .where('twitchUserId', '==', Number(userId))
        .get();
      
      heroIds = heroIds.concat(heroesByTwitchNum.docs.map(doc => doc.id));
    }
    
    // Also try by tiktokUserId if it exists
    const heroesByTikTok = await db.collection('heroes')
      .where('tiktokUserId', '==', userId)
      .get();
    
    heroIds = heroIds.concat(heroesByTikTok.docs.map(doc => doc.id));
    
    // Also check if userId is directly a hero ID (backwards compatibility)
    const heroDoc = await db.collection('heroes').doc(userId).get();
    if (heroDoc.exists) {
      heroIds.push(userId);
    }
    
    // Remove duplicates
    heroIds = [...new Set(heroIds)];
    
    console.log(`   Found ${heroIds.length} hero(es): ${heroIds.join(', ')}`);
    
    // If no heroes found, return empty array
    if (heroIds.length === 0) {
      console.log(`   ⚠️ No heroes found for userId: ${userId}`);
      return res.json([]);
    }
    
    // Query listings for all hero IDs
    // Firestore doesn't support OR queries directly, so we need to query each hero ID
    // and combine results, or use 'in' operator (limited to 10 items)
    const allListings = [];
    
    // Split heroIds into chunks of 10 for 'in' queries
    const chunkSize = 10;
    for (let i = 0; i < heroIds.length; i += chunkSize) {
      const chunk = heroIds.slice(i, i + chunkSize);
      const snapshot = await db.collection('auctionListings')
        .where('sellerId', 'in', chunk)
        .get();
      
      snapshot.docs.forEach(doc => {
        allListings.push({ id: doc.id, ...doc.data() });
      });
    }
    
    // Sort by creation date (newest first)
    allListings.sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() ?? new Date(a.createdAt ?? 0).getTime();
      const bTime = b.createdAt?.toMillis?.() ?? new Date(b.createdAt ?? 0).getTime();
      return bTime - aTime;
    });
    
    console.log(`   📦 Returning ${allListings.length} listing(s)`);
    
    res.json(allListings);
  } catch (error) {
    console.error('Error fetching user listings:', error);
    res.status(500).json({ error: 'Failed to fetch listings' });
  }
});

// Get user's active bids
router.get('/my-bids/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const snapshot = await db.collection('auctionListings')
      .where('status', '==', 'active')
      .get();
    
    const listings = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() }))
      .filter(listing => listing.bids?.some(bid => bid.userId === userId));
    
    res.json(listings);
  } catch (error) {
    console.error('Error fetching user bids:', error);
    res.status(500).json({ error: 'Failed to fetch bids' });
  }
});

// Get transaction history
router.get('/history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    
    const snapshot = await db.collection('auctionTransactions')
      .where('buyerId', '==', userId)
      .get();
    
    const buyHistory = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), type: 'buy' }));
    
    const sellSnapshot = await db.collection('auctionTransactions')
      .where('sellerId', '==', userId)
      .get();
    
    const sellHistory = sellSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), type: 'sell' }));
    
    const history = [...buyHistory, ...sellHistory].sort((a, b) => {
      const aTime = a.createdAt?.toMillis?.() ?? 0;
      const bTime = b.createdAt?.toMillis?.() ?? 0;
      return bTime - aTime;
    });
    
    res.json(history);
  } catch (error) {
    console.error('Error fetching transaction history:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
});

export default router;
