import express from 'express';
import admin from 'firebase-admin';
import Stripe from 'stripe';
import { db } from '../index.js';

const router = express.Router();

// Initialize Stripe
const stripe = process.env.STRIPE_SECRET_KEY ? new Stripe(process.env.STRIPE_SECRET_KEY) : null;

// Pack tier configurations
const PACK_TIERS = {
  bronze: { price: 5, premiumCurrency: 25, name: 'Bronze Founder' },
  silver: { price: 10, premiumCurrency: 75, name: 'Silver Founder' },
  gold: { price: 15, premiumCurrency: 150, name: 'Gold Founder' },
  platinum: { price: 25, premiumCurrency: 250, name: 'Platinum Founder' }
};

// Token pack configurations (standard gacha pricing)
const TOKEN_PACKS = {
  impulse: { price: 0.99, tokens: 100, gold: 1000, name: 'Impulse Pack' },
  starter: { price: 4.99, tokens: 500, gold: 5000, name: 'Starter Pack' },
  value: { price: 9.99, tokens: 1500, gold: 15000, name: 'Value Pack' },
  premium: { price: 24.99, tokens: 5000, gold: 50000, name: 'Premium Pack' }
};

// Tier number mapping (for database storage)
const TIER_LEVELS = {
  bronze: 1,
  silver: 2,
  gold: 3,
  platinum: 4
};

/**
 * Initiate a founders pack purchase
 * POST /api/purchases/founders-pack
 */
router.post('/founders-pack', async (req, res) => {
  try {
    const { userId, packTier } = req.body;

    if (!userId || !packTier) {
      return res.status(400).json({ error: 'userId and packTier are required' });
    }

    if (!PACK_TIERS[packTier]) {
      return res.status(400).json({ error: `Invalid pack tier: ${packTier}. Valid tiers: bronze, silver, gold, platinum` });
    }

    const packConfig = PACK_TIERS[packTier];

    console.log(`[Founders Pack] Purchase initiated: userId=${userId}, tier=${packTier}, price=$${packConfig.price}`);

    // Check if user already has a founders pack
    const heroesSnapshot = await db.collection('heroes')
      .where('twitchUserId', '==', userId)
      .limit(1)
      .get();

    if (!heroesSnapshot.empty) {
      const hero = heroesSnapshot.docs[0].data();
      if (hero.founderPackTier) {
        return res.status(400).json({ 
          error: `You already own a ${PACK_TIERS[hero.founderPackTier]?.name || hero.founderPackTier} pack. Upgrades coming soon!` 
        });
      }
    }

    // Create purchase record
    const purchaseId = `fp_${userId}_${Date.now()}`;
    const purchaseData = {
      userId,
      packTier,
      price: packConfig.price,
      premiumCurrency: packConfig.premiumCurrency,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('purchases').doc(purchaseId).set(purchaseData);

    console.log(`[Founders Pack] Purchase record created: ${purchaseId}`);

    res.json({
      success: true,
      purchaseId,
      message: `Purchase initiated. Ready for checkout.`
    });

  } catch (error) {
    console.error('[Founders Pack] Error initiating purchase:', error);
    res.status(500).json({ error: 'Failed to initiate purchase' });
  }
});

/**
 * Complete a founders pack purchase (called after Stripe payment succeeds)
 * POST /api/purchases/complete
 */
router.post('/complete', async (req, res) => {
  try {
    const { purchaseId } = req.body;

    if (!purchaseId) {
      return res.status(400).json({ error: 'purchaseId is required' });
    }

    console.log(`[Founders Pack] Completing purchase: ${purchaseId}`);

    // Get purchase record
    const purchaseRef = db.collection('purchases').doc(purchaseId);
    const purchaseDoc = await purchaseRef.get();

    if (!purchaseDoc.exists) {
      return res.status(404).json({ error: 'Purchase not found' });
    }

    const purchase = purchaseDoc.data();

    if (purchase.status === 'completed') {
      return res.status(400).json({ error: 'Purchase already completed' });
    }

    // Find user's heroes
    const heroesSnapshot = await db.collection('heroes')
      .where('twitchUserId', '==', purchase.userId)
      .get();

    if (heroesSnapshot.empty) {
      return res.status(404).json({ error: 'No heroes found for user' });
    }

    const packConfig = PACK_TIERS[purchase.packTier];
    const tierLevel = TIER_LEVELS[purchase.packTier];

    // Update all user's heroes with founder pack benefits
    const batch = db.batch();
    const updates = [];

    heroesSnapshot.docs.forEach(heroDoc => {
      const heroRef = db.collection('heroes').doc(heroDoc.id);
      const hero = heroDoc.data();

      // Update hero with founder pack tier
      const heroUpdate = {
        founderPackTier: purchase.packTier,
        founderPackTierLevel: tierLevel,
        tokens: (hero.tokens || 0) + packConfig.premiumCurrency,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      // Auto-unlock founder title if not already unlocked
      if (!hero.unlockedTitles || !hero.unlockedTitles.includes('Founder')) {
        heroUpdate.unlockedTitles = admin.firestore.FieldValue.arrayUnion('Founder');
        // Set as active title if no title is currently selected
        if (!hero.activeTitle) {
          heroUpdate.activeTitle = 'Founder';
        }
      }

      batch.update(heroRef, heroUpdate);
      updates.push({ heroId: heroDoc.id, heroName: hero.name || hero.username });
    });

    // Update purchase status
    batch.update(purchaseRef, {
      status: 'completed',
      completedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    await batch.commit();

    console.log(`[Founders Pack] ✅ Purchase completed: ${purchaseId}`);
    console.log(`[Founders Pack] Updated ${updates.length} heroes with ${purchase.packTier} pack benefits`);

    res.json({
      success: true,
      message: `${packConfig.name} pack purchased successfully!`,
      purchase: {
        ...purchase,
        status: 'completed'
      },
      heroesUpdated: updates.length
    });

  } catch (error) {
    console.error('[Founders Pack] Error completing purchase:', error);
    res.status(500).json({ error: 'Failed to complete purchase' });
  }
});

/**
 * Get purchase status
 * GET /api/purchases/status/:purchaseId
 */
router.get('/status/:purchaseId', async (req, res) => {
  try {
    const { purchaseId } = req.params;

    const purchaseDoc = await db.collection('purchases').doc(purchaseId).get();

    if (!purchaseDoc.exists) {
      return res.status(404).json({ error: 'Purchase not found' });
    }

    const purchase = purchaseDoc.data();

    res.json({
      success: true,
      purchase: {
        id: purchaseDoc.id,
        ...purchase
      }
    });

  } catch (error) {
    console.error('[Founders Pack] Error getting purchase status:', error);
    res.status(500).json({ error: 'Failed to get purchase status' });
  }
});

/**
 * Get all founders for Founders Hall (all tiers)
 * GET /api/purchases/founders
 */
router.get('/founders', async (req, res) => {
  try {
    console.log('[Founders Hall] Fetching all founders...');

    const founders = [];
    const foundUserIds = new Set();

    // PRIMARY: Check heroes directly for founderPackTier (most reliable)
    // Get all heroes and filter for those with founderPackTier
    const allHeroesSnapshot = await db.collection('heroes').get();
    console.log(`[Founders Hall] Checking ${allHeroesSnapshot.docs.length} heroes for founderPackTier...`);

    allHeroesSnapshot.docs.forEach(heroDoc => {
      // Skip this specific hero that shouldn't appear in Founders Hall
      if (heroDoc.id === 'NRy5VebeCTxM3wX99k1o') {
        console.log(`[Founders Hall] Skipping excluded hero: ${heroDoc.id}`);
        return;
      }
      
      const hero = heroDoc.data();
      const founderTier = hero.founderPackTier;
      const founderTierLevel = hero.founderPackTierLevel;
      
      // Check if hero has a founder pack tier (case-insensitive)
      // Also check founderPackTierLevel as fallback (1=bronze, 2=silver, 3=gold, 4=platinum)
      let tierToUse = null;
      
      if (founderTier) {
        const tierLower = founderTier.toLowerCase().trim();
        if (['bronze', 'silver', 'gold', 'platinum'].includes(tierLower)) {
          tierToUse = tierLower;
        } else {
          // Log unexpected tier values for debugging
          console.log(`[Founders Hall] Hero ${heroDoc.id} has unexpected founderPackTier: "${founderTier}" (username: ${hero.twitchUsername || hero.username})`);
        }
      }
      
      // Fallback: Check founderPackTierLevel if tier string is missing
      if (!tierToUse && founderTierLevel) {
        const tierMap = { 1: 'bronze', 2: 'silver', 3: 'gold', 4: 'platinum' };
        tierToUse = tierMap[founderTierLevel];
        if (tierToUse) {
          console.log(`[Founders Hall] Using founderPackTierLevel ${founderTierLevel} -> ${tierToUse} for hero ${heroDoc.id}`);
        }
      }
      
      if (!tierToUse) {
        // Log heroes that might be founders but don't have the field set
        const username = (hero.twitchUsername || hero.username || '').toLowerCase();
        if (username === 'theneverendingwar' || username.includes('never')) {
          console.log(`[Founders Hall] DEBUG: Hero ${heroDoc.id} (${hero.twitchUsername || hero.username}) has no founderPackTier. Fields:`, {
            founderPackTier: hero.founderPackTier,
            founderPackTierLevel: hero.founderPackTierLevel,
            twitchUsername: hero.twitchUsername,
            username: hero.username,
            twitchUserId: hero.twitchUserId
          });
        }
        return;
      }

      // Only use twitchUserId - skip heroes without a valid Twitch user ID
      // Normalize to string to ensure consistent comparison (Firestore may store as string or number)
      const userId = hero.twitchUserId ? String(hero.twitchUserId) : null;
      
      if (!userId) {
        console.log(`[Founders Hall] Skipping hero ${heroDoc.id} - no twitchUserId (twitchUsername: ${hero.twitchUsername}, username: ${hero.username})`);
        return;
      }

      // Skip if userId looks like a document ID (20 character alphanumeric) instead of a numeric Twitch ID
      if (!/^\d+$/.test(userId)) {
        console.log(`[Founders Hall] Skipping hero ${heroDoc.id} - userId "${userId}" is not a valid Twitch user ID (looks like document ID)`);
        return;
      }

      // Skip if we already added this user (normalized to string for consistent comparison)
      if (foundUserIds.has(userId)) {
        console.log(`[Founders Hall] Skipping duplicate user: ${userId} (hero ${heroDoc.id})`);
        return;
      }

        foundUserIds.add(userId);

        // Try to get display name - if missing, look up from other heroes with same twitchUserId
        let displayName = hero.twitchUsername || hero.username || hero.name;
        
        // If displayName is still missing and we have twitchUserId, try to find it from other heroes
        if (!displayName && hero.twitchUserId) {
          // Look for other heroes from the same user that might have twitchUsername
          const otherHeroes = allHeroesSnapshot.docs.filter(doc => {
            const otherHero = doc.data();
            return otherHero.twitchUserId === hero.twitchUserId && 
                   doc.id !== heroDoc.id && 
                   (otherHero.twitchUsername || otherHero.username);
          });
          
          if (otherHeroes.length > 0) {
            const otherHero = otherHeroes[0].data();
            displayName = otherHero.twitchUsername || otherHero.username;
            console.log(`[Founders Hall] Found twitchUsername from other hero for user ${hero.twitchUserId}: ${displayName}`);
          } else {
            console.log(`[Founders Hall] No other heroes found with twitchUsername for user ${hero.twitchUserId}, hero ${heroDoc.id}`);
          }
        }
        
        // Final fallback: use userId only if it's a numeric Twitch ID, not a document ID
        // Document IDs are typically 20 characters, Twitch IDs are numeric
        if (!displayName) {
          if (userId && /^\d+$/.test(userId)) {
            // It's a numeric Twitch ID, use it as last resort
            displayName = `User${userId}`;
            console.log(`[Founders Hall] Using numeric Twitch ID as fallback: ${displayName}`);
          } else {
            // It's likely a document ID, try to get from purchase records or use hero name
            console.log(`[Founders Hall] Warning: Hero ${heroDoc.id} missing username, userId looks like document ID: ${userId}`);
            console.log(`[Founders Hall] Hero data: twitchUserId=${hero.twitchUserId}, twitchUsername=${hero.twitchUsername}, username=${hero.username}, name=${hero.name}`);
            displayName = hero.name || `Hero ${heroDoc.id.substring(0, 8)}`;
          }
        }
        
        // Log ALL fields to see what's available
        const allFields = Object.keys(hero);
        console.log(`[Founders Hall] Hero ${heroDoc.id} (${displayName}) - ALL fields:`, allFields);
        console.log(`[Founders Hall] Hero ${heroDoc.id} - Role-related fields:`, {
          role: hero.role,
          class: hero.class,
          characterClass: hero.characterClass,
          characterRole: hero.characterRole,
          heroClass: hero.heroClass,
          type: hero.type
        });
        
        const heroRole = hero.role || hero.class || hero.characterClass || hero.characterRole || hero.heroClass || 'berserker';
        
        console.log(`[Founders Hall] Found founder: ${displayName} (${tierToUse}) - userId: ${userId}, role: ${heroRole}`);

        const founderData = {
          userId,
          username: displayName,
          heroName: hero.name,
          heroRole: heroRole, // Include role for sprite display
          tier: tierToUse,
          purchaseDate: hero.updatedAt?.toMillis() || hero.createdAt?.toMillis() || Date.now(),
          purchaseId: `hero_${heroDoc.id}`
        };
        
        console.log(`[Founders Hall] Pushing founder data:`, founderData);
        founders.push(founderData);
    });

    // SECONDARY: Also check purchase records for additional info
    const purchasesSnapshot = await db.collection('purchases')
      .where('status', '==', 'completed')
      .get();
    
    const founderPurchases = purchasesSnapshot.docs.filter(doc => {
      const data = doc.data();
      return data.packTier && ['bronze', 'silver', 'gold', 'platinum'].includes(data.packTier);
    });

    console.log(`[Founders Hall] Found ${founderPurchases.length} founder pack purchases`);

    // Add any founders from purchases that we don't already have
    for (const purchaseDoc of founderPurchases) {
      const purchase = purchaseDoc.data();
      // Normalize to string for consistent comparison
      const userId = purchase.userId ? String(purchase.userId) : null;
      
      if (!userId) continue;
      
      // Normalize to string for consistent comparison
      const normalizedUserId = String(userId);
      
      if (foundUserIds.has(normalizedUserId)) {
        console.log(`[Founders Hall] Skipping duplicate user from purchases: ${normalizedUserId}`);
        continue;
      }

      foundUserIds.add(normalizedUserId);

      // Get user's heroes for display name
      // Try both string and number since Firestore might store it either way
      let heroesSnapshot = await db.collection('heroes')
        .where('twitchUserId', '==', userId)
        .get();
      
      // If no results, try with number conversion
      if (heroesSnapshot.empty && /^\d+$/.test(userId)) {
        heroesSnapshot = await db.collection('heroes')
          .where('twitchUserId', '==', Number(userId))
          .get();
      }

      let displayName = null;
      let heroName = null;
      let heroRole = 'berserker';

      if (!heroesSnapshot.empty) {
        // Try to find a hero with twitchUsername set (preferred)
        const heroWithUsername = heroesSnapshot.docs.find(doc => {
          const hero = doc.data();
          return hero.twitchUsername || hero.username;
        });
        
        if (heroWithUsername) {
          const hero = heroWithUsername.data();
          displayName = hero.twitchUsername || hero.username;
          heroName = hero.name;
          heroRole = hero.role || hero.class || 'berserker';
        } else {
          // Fallback to first hero
          const hero = heroesSnapshot.docs[0].data();
          displayName = hero.twitchUsername || hero.username || hero.name;
          heroName = hero.name;
          heroRole = hero.role || hero.class || 'berserker';
        }
      }
      
      // Final fallback: if userId is numeric (Twitch ID), format it nicely
      if (!displayName) {
        if (userId && /^\d+$/.test(userId)) {
          displayName = `User${userId}`;
        } else {
          displayName = userId; // Last resort
        }
      }

      founders.push({
        userId,
        username: displayName,
        heroName,
        heroRole,
        tier: purchase.packTier,
        purchaseDate: purchase.completedAt?.toMillis() || purchase.createdAt?.toMillis() || Date.now(),
        purchaseId: purchaseDoc.id
      });
    }

    // Sort by tier (Platinum first) then by purchase date (most recent first)
    founders.sort((a, b) => {
      const aTier = TIER_LEVELS[a.tier] || 0;
      const bTier = TIER_LEVELS[b.tier] || 0;
      if (bTier !== aTier) return bTier - aTier; // Higher tier first
      return b.purchaseDate - a.purchaseDate; // Most recent first
    });

    console.log(`[Founders Hall] Found ${founders.length} founders (all tiers)`);
    
    // Debug: Check for specific user - check ALL heroes for any match
    const debugUser = 'theneverendingwar';
    const debugHeroes = allHeroesSnapshot.docs.filter(doc => {
      const hero = doc.data();
      const twitchUsername = (hero.twitchUsername || '').toLowerCase();
      const username = (hero.username || '').toLowerCase();
      const name = (hero.name || '').toLowerCase();
      const searchTerm = debugUser.toLowerCase();
      return twitchUsername.includes(searchTerm) || 
             username.includes(searchTerm) || 
             name.includes(searchTerm) ||
             twitchUsername === searchTerm ||
             username === searchTerm;
    });
    
    if (debugHeroes.length > 0) {
      console.log(`[Founders Hall] DEBUG: Found ${debugHeroes.length} heroes matching "${debugUser}":`);
      debugHeroes.forEach((heroDoc, idx) => {
        const hero = heroDoc.data();
        const allFields = Object.keys(hero);
        const founderFields = allFields.filter(f => f.toLowerCase().includes('founder'));
        
        console.log(`[Founders Hall] DEBUG Hero ${idx + 1} (${heroDoc.id}):`, {
          twitchUsername: hero.twitchUsername,
          username: hero.username,
          name: hero.name,
          twitchUserId: hero.twitchUserId,
          id: hero.id,
          founderPackTier: hero.founderPackTier,
          founderPackTierLevel: hero.founderPackTierLevel,
          hasFounderTier: !!hero.founderPackTier,
          hasFounderTierLevel: !!hero.founderPackTierLevel,
          tierInList: hero.founderPackTier && ['bronze', 'silver', 'gold', 'platinum'].includes((hero.founderPackTier || '').toLowerCase().trim()),
          allFounderFields: founderFields.map(f => ({ [f]: hero[f] })),
          wasAdded: foundUserIds.has(hero.twitchUserId || hero.id)
        });
      });
    } else {
      console.log(`[Founders Hall] DEBUG: No heroes found matching "${debugUser}"`);
      console.log(`[Founders Hall] DEBUG: Sample usernames from first 10 heroes:`, 
        allHeroesSnapshot.docs.slice(0, 10).map(doc => ({
          twitchUsername: doc.data().twitchUsername,
          username: doc.data().username,
          name: doc.data().name
        }))
      );
    }

    res.json({
      success: true,
      founders,
      debug: {
        totalHeroesChecked: allHeroesSnapshot.docs.length,
        foundersFound: founders.length,
        debugUserFound: debugHeroes.length > 0,
        debugUserData: debugHeroes.length > 0 ? debugHeroes.map(doc => {
          const hero = doc.data();
          return {
            id: doc.id,
            twitchUsername: hero.twitchUsername,
            username: hero.username,
            name: hero.name,
            twitchUserId: hero.twitchUserId,
            founderPackTier: hero.founderPackTier,
            founderPackTierLevel: hero.founderPackTierLevel,
            hasFounderTier: !!hero.founderPackTier,
            hasFounderTierLevel: !!hero.founderPackTierLevel,
            tierValue: hero.founderPackTier || `Level: ${hero.founderPackTierLevel || 'none'}`,
            allFields: Object.keys(hero).filter(k => k.toLowerCase().includes('founder'))
          };
        }) : null
      }
    });

  } catch (error) {
    console.error('[Founders Hall] Error fetching founders:', error);
    res.status(500).json({ error: 'Failed to fetch founders' });
  }
});

/**
 * Set founder status for a user (admin/manual grant)
 * POST /api/purchases/set-founder
 */
router.post('/set-founder', async (req, res) => {
  try {
    const { userId, username, tier } = req.body;

    if ((!userId && !username) || !tier) {
      return res.status(400).json({ error: 'Either userId or username, and tier are required' });
    }

    if (!['bronze', 'silver', 'gold', 'platinum'].includes(tier.toLowerCase())) {
      return res.status(400).json({ error: 'Invalid tier. Must be: bronze, silver, gold, or platinum' });
    }

    const tierLower = tier.toLowerCase();
    const tierLevel = TIER_LEVELS[tierLower];

    let actualUserId = userId;
    let heroesSnapshot;

    // If username provided instead of userId, look it up
    if (username && !userId) {
      console.log(`[Founders Pack] Looking up user by username: ${username}`);
      
      // First try to find by twitchUsername in heroes
      const usernameHeroes = await db.collection('heroes')
        .where('twitchUsername', '==', username.toLowerCase())
        .limit(1)
        .get();
      
      if (!usernameHeroes.empty) {
        const hero = usernameHeroes.docs[0].data();
        actualUserId = hero.twitchUserId;
        console.log(`[Founders Pack] Found userId ${actualUserId} for username ${username}`);
      } else {
        // Try to look up via Twitch API
        try {
          const fetch = (await import('node-fetch')).default;
          const twitchResponse = await fetch(`https://api.twitch.tv/helix/users?login=${username}`, {
            headers: {
              'Client-Id': process.env.TWITCH_CLIENT_ID,
              'Authorization': `Bearer ${process.env.TWITCH_APP_ACCESS_TOKEN || ''}`
            }
          });
          
          if (twitchResponse.ok) {
            const twitchData = await twitchResponse.json();
            if (twitchData.data && twitchData.data.length > 0) {
              actualUserId = twitchData.data[0].id;
              console.log(`[Founders Pack] Found userId ${actualUserId} via Twitch API for username ${username}`);
            } else {
              return res.status(404).json({ error: `User not found: ${username}` });
            }
          } else {
            console.warn(`[Founders Pack] Twitch API lookup failed, trying hero lookup by username field`);
            // Fallback: try username field
            const fallbackHeroes = await db.collection('heroes')
              .where('username', '==', username.toLowerCase())
              .limit(1)
              .get();
            
            if (!fallbackHeroes.empty) {
              const hero = fallbackHeroes.docs[0].data();
              actualUserId = hero.twitchUserId;
              console.log(`[Founders Pack] Found userId ${actualUserId} via username field for ${username}`);
            } else {
              return res.status(404).json({ error: `User not found: ${username}. Please provide userId instead.` });
            }
          }
        } catch (err) {
          console.error(`[Founders Pack] Error looking up user:`, err);
          return res.status(500).json({ error: 'Failed to look up user. Please provide userId instead.' });
        }
      }
    }

    console.log(`[Founders Pack] Setting founder status: userId=${actualUserId}, tier=${tierLower}`);

    // Find user's heroes - try both string and number formats
    try {
      // Try as string first (most common case)
      heroesSnapshot = await db.collection('heroes')
        .where('twitchUserId', '==', actualUserId)
        .get();
      
      // If no results and actualUserId looks like a number, try as number
      if (heroesSnapshot.empty && /^\d+$/.test(actualUserId)) {
        const numericId = parseInt(actualUserId, 10);
        console.log(`[Founders Pack] No heroes found with string twitchUserId "${actualUserId}", trying as number: ${numericId}`);
        heroesSnapshot = await db.collection('heroes')
          .where('twitchUserId', '==', numericId)
          .get();
      }
      
      // Also try the legacy 'twitchId' field (without 'User' suffix)
      if (heroesSnapshot.empty) {
        heroesSnapshot = await db.collection('heroes')
          .where('twitchId', '==', actualUserId)
          .get();
        
        // Try legacy field as number too
        if (heroesSnapshot.empty && /^\d+$/.test(actualUserId)) {
          const numericId = parseInt(actualUserId, 10);
          console.log(`[Founders Pack] Trying legacy 'twitchId' field as number: ${numericId}`);
          heroesSnapshot = await db.collection('heroes')
            .where('twitchId', '==', numericId)
            .get();
        }
      }
    } catch (firestoreError) {
      // Handle Firestore quota errors gracefully
      if (firestoreError.code === 8 || firestoreError.message?.includes('Quota exceeded') || firestoreError.message?.includes('RESOURCE_EXHAUSTED')) {
        console.warn(`[Founders Pack] Firestore quota exceeded for userId ${actualUserId}`);
        return res.status(503).json({ error: 'Service temporarily unavailable. Please try again later.' });
      }
      throw firestoreError;
    }

    if (heroesSnapshot.empty) {
      return res.status(404).json({ error: `No heroes found for user ${actualUserId}` });
    }

    // Update all user's heroes with founder pack benefits
    const batch = db.batch();
    const updates = [];

    const packConfig = PACK_TIERS[tierLower];

    heroesSnapshot.docs.forEach(heroDoc => {
      const heroRef = db.collection('heroes').doc(heroDoc.id);
      const hero = heroDoc.data();

      const heroUpdate = {
        founderPackTier: tierLower,
        founderPackTierLevel: tierLevel,
        // Grant premium tokens (only if hero doesn't already have this tier to avoid double-granting)
        tokens: hero.founderPackTier !== tierLower 
          ? (hero.tokens || 0) + packConfig.premiumCurrency
          : (hero.tokens || 0),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };

      // Auto-unlock founder title if not already unlocked
      if (!hero.unlockedTitles || !hero.unlockedTitles.includes('Founder')) {
        heroUpdate.unlockedTitles = admin.firestore.FieldValue.arrayUnion('Founder');
        // Set as active title if no title is currently selected
        if (!hero.activeTitle) {
          heroUpdate.activeTitle = 'Founder';
        }
      }

      batch.update(heroRef, heroUpdate);
      updates.push({ heroId: heroDoc.id, heroName: hero.name || hero.username });
    });

    await batch.commit();

    console.log(`[Founders Pack] ✅ Set ${tierLower} founder status for ${updates.length} heroes`);

    res.json({
      success: true,
      message: `Set ${PACK_TIERS[tierLower].name} status successfully!`,
      tier: tierLower,
      heroesUpdated: updates.length,
      heroes: updates
    });

  } catch (error) {
    console.error('[Founders Pack] Error setting founder status:', error);
    res.status(500).json({ error: 'Failed to set founder status' });
  }
});

/**
 * Remove founder pack status from a user (admin only)
 * POST /api/purchases/remove-founder
 */
router.post('/remove-founder', async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    console.log(`[Founders Pack] Removing founder status from user: ${userId}`);

    let heroesToUpdate = [];
    
    // First, try to find by twitchUserId (if userId is numeric Twitch ID)
    if (/^\d+$/.test(userId)) {
      const heroesSnapshot = await db.collection('heroes')
        .where('twitchUserId', '==', userId)
        .get();
      heroesToUpdate = heroesSnapshot.docs;
      console.log(`[Founders Pack] Found ${heroesToUpdate.length} heroes by twitchUserId: ${userId}`);
    }
    
    // Also try by hero document ID if userId looks like a document ID (20 char alphanumeric)
    if (heroesToUpdate.length === 0 && /^[a-zA-Z0-9]{20}$/.test(userId)) {
      const heroDoc = await db.collection('heroes').doc(userId).get();
      if (heroDoc.exists) {
        heroesToUpdate = [heroDoc];
        console.log(`[Founders Pack] Found hero by document ID: ${userId}`);
      }
    }
    
    // Also try to find all heroes that might have this as their twitchUserId (string match)
    if (heroesToUpdate.length === 0) {
      const allHeroesSnapshot = await db.collection('heroes').get();
      heroesToUpdate = allHeroesSnapshot.docs.filter(doc => {
        const hero = doc.data();
        return hero.twitchUserId === userId || doc.id === userId;
      });
      console.log(`[Founders Pack] Found ${heroesToUpdate.length} heroes by searching all (userId: ${userId})`);
    }

    if (heroesToUpdate.length === 0) {
      return res.status(404).json({ error: `No heroes found for userId: ${userId}` });
    }

    // Remove founder pack from all found heroes
    const batch = db.batch();
    const updates = [];

    heroesToUpdate.forEach(heroDoc => {
      const heroRef = heroDoc.ref || db.collection('heroes').doc(heroDoc.id);
      const heroData = heroDoc.data();
      
      console.log(`[Founders Pack] Removing founder status from hero ${heroDoc.id} (${heroData.name || heroData.username || 'unknown'})`);
      
      batch.update(heroRef, {
        founderPackTier: admin.firestore.FieldValue.delete(),
        founderPackTierLevel: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      updates.push({ heroId: heroDoc.id, heroName: heroData.name || heroData.username || heroData.twitchUsername });
    });

    await batch.commit();

    console.log(`[Founders Pack] ✅ Removed founder status from ${updates.length} heroes`);

    res.json({
      success: true,
      message: 'Founder status removed successfully',
      heroesUpdated: updates.length,
      heroes: updates
    });

  } catch (error) {
    console.error('[Founders Pack] Error removing founder status:', error);
    res.status(500).json({ error: 'Failed to remove founder status' });
  }
});

/**
 * Initiate a token pack purchase
 * POST /api/purchases/token-pack
 */
router.post('/token-pack', async (req, res) => {
  try {
    const { userId, packType, heroId } = req.body;

    if (!userId || !packType || !heroId) {
      return res.status(400).json({ error: 'userId, packType, and heroId are required' });
    }

    if (!TOKEN_PACKS[packType]) {
      return res.status(400).json({ 
        error: `Invalid pack type: ${packType}. Valid types: impulse, starter, value, premium` 
      });
    }

    const packConfig = TOKEN_PACKS[packType];

    console.log(`[Token Pack] Purchase initiated: userId=${userId}, packType=${packType}, heroId=${heroId}, price=$${packConfig.price}`);

    // Verify hero exists and belongs to user
    const heroDoc = await db.collection('heroes').doc(heroId).get();
    if (!heroDoc.exists) {
      return res.status(404).json({ error: 'Hero not found' });
    }

    const hero = heroDoc.data();
    if (hero.twitchUserId !== userId) {
      return res.status(403).json({ error: 'Hero does not belong to user' });
    }

    // Create purchase record
    const purchaseId = `tp_${userId}_${Date.now()}`;
    const purchaseData = {
      userId,
      heroId,
      packType,
      price: packConfig.price,
      tokens: packConfig.tokens,
      gold: packConfig.gold,
      status: 'pending',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await db.collection('purchases').doc(purchaseId).set(purchaseData);

    console.log(`[Token Pack] Purchase record created: ${purchaseId}`);

    res.json({
      success: true,
      purchaseId,
      message: `Purchase initiated. Ready for checkout.`
    });

  } catch (error) {
    console.error('[Token Pack] Error initiating purchase:', error);
    res.status(500).json({ error: 'Failed to initiate purchase' });
  }
});

/**
 * Complete a token pack purchase (called after Stripe payment succeeds)
 * POST /api/purchases/complete-token-pack
 */
router.post('/complete-token-pack', async (req, res) => {
  try {
    const { purchaseId } = req.body;

    if (!purchaseId) {
      return res.status(400).json({ error: 'purchaseId is required' });
    }

    console.log(`[Token Pack] Completing purchase: ${purchaseId}`);

    // Get purchase record
    const purchaseRef = db.collection('purchases').doc(purchaseId);
    const purchaseDoc = await purchaseRef.get();

    if (!purchaseDoc.exists) {
      return res.status(404).json({ error: 'Purchase not found' });
    }

    const purchase = purchaseDoc.data();

    if (purchase.status === 'completed') {
      return res.status(400).json({ error: 'Purchase already completed' });
    }

    if (purchase.packType === undefined) {
      return res.status(400).json({ error: 'Invalid purchase type (not a token pack)' });
    }

    const packConfig = TOKEN_PACKS[purchase.packType];

    // Get hero document
    const heroRef = db.collection('heroes').doc(purchase.heroId);
    const heroDoc = await heroRef.get();

    if (!heroDoc.exists) {
      return res.status(404).json({ error: 'Hero not found' });
    }

    const hero = heroDoc.data();

    // Update hero with tokens and gold
    const heroUpdate = {
      tokens: (hero.tokens || 0) + packConfig.tokens,
      gold: (hero.gold || 0) + packConfig.gold,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Update purchase status
    await db.batch()
      .update(heroRef, heroUpdate)
      .update(purchaseRef, {
        status: 'completed',
        completedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      })
      .commit();

    console.log(`[Token Pack] ✅ Purchase completed: ${purchaseId}`);
    console.log(`[Token Pack] Granted ${packConfig.tokens} tokens and ${packConfig.gold} gold to hero ${purchase.heroId}`);

    res.json({
      success: true,
      message: `${packConfig.name} purchased successfully!`,
      purchase: {
        ...purchase,
        status: 'completed'
      },
      tokensGranted: packConfig.tokens,
      goldGranted: packConfig.gold
    });

  } catch (error) {
    console.error('[Token Pack] Error completing purchase:', error);
    res.status(500).json({ error: 'Failed to complete purchase' });
  }
});

/**
 * Create Stripe checkout session endpoint
 * POST /api/purchases/create-checkout-session
 */
router.post('/create-checkout-session', async (req, res) => {
  try {
    const { purchaseId, price } = req.body;

    if (!purchaseId || !price) {
      return res.status(400).json({ error: 'purchaseId and price are required' });
    }

    // In development/localhost, allow mock checkout for testing
    const isDevelopment = process.env.NODE_ENV !== 'production' || 
                          process.env.BACKEND_URL?.includes('localhost') ||
                          !process.env.STRIPE_SECRET_KEY;

    if (!stripe) {
      if (isDevelopment) {
        // Return a mock checkout URL for development testing
        console.log('[Stripe] Development mode: Returning mock checkout session');
        return res.json({
          sessionId: `mock_session_${purchaseId}`,
          url: `${process.env.FRONTEND_URL || 'http://localhost:3000'}/purchases/success?purchaseId=${purchaseId}&mock=true`,
          message: 'Mock checkout session (Stripe not configured in development)'
        });
      }
      return res.status(500).json({ error: 'Stripe not configured. Please configure STRIPE_SECRET_KEY environment variable.' });
    }

    // Get purchase record to determine type and metadata
    const purchaseRef = db.collection('purchases').doc(purchaseId);
    const purchaseDoc = await purchaseRef.get();

    if (!purchaseDoc.exists) {
      return res.status(404).json({ error: 'Purchase not found' });
    }

    const purchase = purchaseDoc.data();
    const API_URL = process.env.BACKEND_URL || process.env.RAILWAY_PUBLIC_DOMAIN || 'http://localhost:3001';
    const baseUrl = API_URL.startsWith('http') ? API_URL : `https://${API_URL}`;
    const successUrl = `${baseUrl}/api/purchases/success?purchaseId=${purchaseId}`;
    const cancelUrl = `${baseUrl}/api/purchases/cancel?purchaseId=${purchaseId}`;

    let productName = 'Purchase';
    let productDescription = 'Game purchase';

    if (purchase.packTier) {
      const packConfig = PACK_TIERS[purchase.packTier];
      productName = `${packConfig.name} Pack`;
      productDescription = `Founder's Pack - ${packConfig.premiumCurrency} Tokens`;
    } else if (purchase.packType) {
      const packConfig = TOKEN_PACKS[purchase.packType];
      productName = packConfig.name;
      productDescription = `${packConfig.tokens} Tokens + ${packConfig.gold} Gold`;
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: productName,
              description: productDescription,
            },
            unit_amount: Math.round(price * 100), // Convert to cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata: {
        purchaseId: purchaseId,
        purchaseType: purchase.packTier ? 'founders-pack' : purchase.packType ? 'token-pack' : 'unknown',
        userId: purchase.userId || '',
      },
    });

    res.json({ sessionId: session.id, url: session.url });
  } catch (error) {
    console.error('[Stripe] Error creating checkout session:', error);
    res.status(500).json({ error: 'Failed to create checkout session', details: error.message });
  }
});

/**
 * Success redirect handler
 * GET /api/purchases/success
 */
router.get('/success', async (req, res) => {
  const { purchaseId } = req.query;
  
  // Redirect to frontend success page
  const frontendUrl = process.env.FRONTEND_URL || process.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000';
  res.redirect(`${frontendUrl}/purchases/success?purchaseId=${purchaseId}`);
});

/**
 * Cancel redirect handler
 * GET /api/purchases/cancel
 */
router.get('/cancel', async (req, res) => {
  const { purchaseId } = req.query;
  
  // Redirect to frontend cancel page
  const frontendUrl = process.env.FRONTEND_URL || process.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:3000';
  res.redirect(`${frontendUrl}/purchases/cancel?purchaseId=${purchaseId}`);
});

/**
 * Get user's purchase history
 * GET /api/purchases/history/:userId
 */
router.get('/history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    console.log(`[Purchase History] Fetching purchases for userId: ${userId}`);

    // Get all purchases for this user (both founders packs and token packs)
    // Try with orderBy first, fallback to in-memory sort if index doesn't exist
    let purchases = [];
    try {
      const purchasesSnapshot = await db.collection('purchases')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .get();

      purchases = purchasesSnapshot.docs.map(doc => {
        const purchase = doc.data();
        return {
          id: doc.id,
          ...purchase,
          createdAt: purchase.createdAt?.toMillis?.() || purchase.createdAt?.toDate?.() || purchase.createdAt,
          completedAt: purchase.completedAt?.toMillis?.() || purchase.completedAt?.toDate?.() || purchase.completedAt,
          updatedAt: purchase.updatedAt?.toMillis?.() || purchase.updatedAt?.toDate?.() || purchase.updatedAt,
        };
      });
    } catch (error) {
      // If orderBy fails (no index), fetch without orderBy and sort in memory
      console.warn('[Purchase History] orderBy failed, fetching all and sorting in memory:', error.message);
      const purchasesSnapshot = await db.collection('purchases')
        .where('userId', '==', userId)
        .get();

      purchases = purchasesSnapshot.docs.map(doc => {
        const purchase = doc.data();
        return {
          id: doc.id,
          ...purchase,
          createdAt: purchase.createdAt?.toMillis?.() || purchase.createdAt?.toDate?.() || purchase.createdAt,
          completedAt: purchase.completedAt?.toMillis?.() || purchase.completedAt?.toDate?.() || purchase.completedAt,
          updatedAt: purchase.updatedAt?.toMillis?.() || purchase.updatedAt?.toDate?.() || purchase.updatedAt,
        };
      });
    }

    // Also try querying by twitchUserId if userId is numeric
    let additionalPurchases = [];
    if (!isNaN(userId)) {
      try {
        const twitchPurchasesSnapshot = await db.collection('purchases')
          .where('userId', '==', Number(userId))
          .orderBy('createdAt', 'desc')
          .get();
        
        additionalPurchases = twitchPurchasesSnapshot.docs
          .filter(doc => !purchases.find(p => p.id === doc.id)) // Avoid duplicates
          .map(doc => {
            const purchase = doc.data();
            return {
              id: doc.id,
              ...purchase,
              createdAt: purchase.createdAt?.toMillis?.() || purchase.createdAt?.toDate?.() || purchase.createdAt,
              completedAt: purchase.completedAt?.toMillis?.() || purchase.completedAt?.toDate?.() || purchase.completedAt,
              updatedAt: purchase.updatedAt?.toMillis?.() || purchase.updatedAt?.toDate?.() || purchase.updatedAt,
            };
          });
      } catch (error) {
        // Fallback to no orderBy
        const twitchPurchasesSnapshot = await db.collection('purchases')
          .where('userId', '==', Number(userId))
          .get();
        
        additionalPurchases = twitchPurchasesSnapshot.docs
          .filter(doc => !purchases.find(p => p.id === doc.id))
          .map(doc => {
            const purchase = doc.data();
            return {
              id: doc.id,
              ...purchase,
              createdAt: purchase.createdAt?.toMillis?.() || purchase.createdAt?.toDate?.() || purchase.createdAt,
              completedAt: purchase.completedAt?.toMillis?.() || purchase.completedAt?.toDate?.() || purchase.completedAt,
              updatedAt: purchase.updatedAt?.toMillis?.() || purchase.updatedAt?.toDate?.() || purchase.updatedAt,
            };
          });
      }
    }

    const allPurchases = [...purchases, ...additionalPurchases];

    // Sort by creation date (most recent first) - always sort in memory as final step
    allPurchases.sort((a, b) => {
      const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : (typeof a.createdAt === 'number' ? a.createdAt : 0);
      const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : (typeof b.createdAt === 'number' ? b.createdAt : 0);
      return bTime - aTime;
    });

    console.log(`[Purchase History] Found ${allPurchases.length} purchases for userId: ${userId}`);

    res.json({ purchases: allPurchases });
  } catch (error) {
    console.error('[Purchase History] Error fetching purchases:', error);
    res.status(500).json({ error: 'Failed to fetch purchase history' });
  }
});

/**
 * Get purchase details with hero information
 * GET /api/purchases/:purchaseId/details
 */
router.get('/:purchaseId/details', async (req, res) => {
  try {
    const { purchaseId } = req.params;

    const purchaseDoc = await db.collection('purchases').doc(purchaseId).get();

    if (!purchaseDoc.exists) {
      return res.status(404).json({ error: 'Purchase not found' });
    }

    const purchase = purchaseDoc.data();
    const purchaseData = {
      id: purchaseDoc.id,
      ...purchase,
      createdAt: purchase.createdAt?.toMillis?.() || purchase.createdAt?.toDate?.() || purchase.createdAt,
      completedAt: purchase.completedAt?.toMillis?.() || purchase.completedAt?.toDate?.() || purchase.completedAt,
    };

    // If it's a token pack purchase, get hero info
    if (purchase.packType && purchase.heroId) {
      const heroDoc = await db.collection('heroes').doc(purchase.heroId).get();
      if (heroDoc.exists) {
        const hero = heroDoc.data();
        purchaseData.hero = {
          id: heroDoc.id,
          name: hero.name || hero.username,
          level: hero.level,
          role: hero.role,
        };
      }
    }

    // If it's a founders pack, get all user's heroes
    if (purchase.packTier) {
      const heroesSnapshot = await db.collection('heroes')
        .where('twitchUserId', '==', purchase.userId)
        .get();
      
      purchaseData.heroes = heroesSnapshot.docs.map(doc => {
        const hero = doc.data();
        return {
          id: doc.id,
          name: hero.name || hero.username,
          level: hero.level,
          role: hero.role,
        };
      });
    }

    res.json({ purchase: purchaseData });
  } catch (error) {
    console.error('[Purchase Details] Error fetching purchase details:', error);
    res.status(500).json({ error: 'Failed to fetch purchase details' });
  }
});

export default router;
