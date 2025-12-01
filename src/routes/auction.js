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
    if (currency) {
      query = query.where('currency', '==', currency);
    }
    
    const snapshot = await query.get();
    let listings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Client-side filtering (Firestore doesn't support all filters)
    if (itemType) {
      listings = listings.filter(l => l.item?.slot === itemType);
    }
    if (rarity) {
      listings = listings.filter(l => l.item?.rarity === rarity);
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

// Create listing
router.post('/list', async (req, res) => {
  try {
    const { sellerId, sellerUsername, item, startingPrice, buyoutPrice, currency = 'gold' } = req.body;
    
    if (!sellerId || !item || !startingPrice) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    if (currency !== 'gold' && currency !== 'tokens') {
      return res.status(400).json({ error: 'Invalid currency' });
    }
    
    // Calculate listing fee (5% of starting price, minimum 10 gold/1 token)
    const listingFee = Math.max(
      currency === 'gold' ? 10 : 1,
      Math.floor(startingPrice * 0.05)
    );
    
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
    
    // Check item is in inventory
    const inventory = hero.inventory || [];
    const itemIndex = inventory.findIndex(i => i.id === item.id);
    
    if (itemIndex === -1) {
      return res.status(400).json({ error: 'Item not in inventory' });
    }
    
    // Remove item from inventory
    inventory.splice(itemIndex, 1);
    
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
    
    // Create listing
    const listingData = {
      sellerId,
      sellerUsername: sellerUsername || hero.name || 'Unknown',
      item,
      startingPrice: Number(startingPrice),
      buyoutPrice: buyoutPrice ? Number(buyoutPrice) : null,
      currency,
      listingFee,
      createdAt: admin.firestore.Timestamp.now(),
      expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)), // 7 days
      status: 'active',
      bids: [],
      highestBid: 0,
      soldTo: null,
      soldAt: null
    };
    
    const listingRef = await db.collection('auctionListings').add(listingData);
    const listingDoc = await listingRef.get();
    
    console.log(`💰 ${sellerId} listed ${item.name} for ${startingPrice} ${currency}`);
    
    res.status(201).json({ id: listingDoc.id, ...listingDoc.data() });
  } catch (error) {
    console.error('Error creating listing:', error);
    res.status(500).json({ error: 'Failed to create listing' });
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
    const buyerUpdates = {
      inventory: admin.firestore.FieldValue.arrayUnion(listing.item),
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
    const sellerRef = db.collection('heroes').doc(userId);
    const sellerDoc = await sellerRef.get();
    
    if (sellerDoc.exists) {
      const seller = sellerDoc.data();
      const inventory = seller.inventory || [];
      inventory.push(listing.item);
      
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
    
    const snapshot = await db.collection('auctionListings')
      .where('sellerId', '==', userId)
      .get();
    
    const listings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    res.json(listings);
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
