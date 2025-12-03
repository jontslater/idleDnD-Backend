import express from 'express';
import admin from 'firebase-admin';
import { db } from '../index.js';
import { ROLE_CONFIG } from '../data/roleConfig.js';

const router = express.Router();

// Get all heroes
router.get('/', async (req, res) => {
  try {
    const snapshot = await db.collection('heroes').get();
    const heroes = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    res.json(heroes);
  } catch (error) {
    console.error('Error fetching heroes:', error);
    res.status(500).json({ error: 'Failed to fetch heroes' });
  }
});

// Login reward routes - MUST be before /:userId route to ensure proper matching
// Route: GET /api/heroes/login-reward/:userId/status
router.get('/login-reward/:userId/status', async (req, res) => {
  try {
    const userId = req.params.userId;
    console.log(`[Login Reward] GET /api/heroes/login-reward/${userId}/status - userId: ${userId}`);
    const { getLoginRewardStatus } = await import('../services/loginRewardService.js');
    const status = await getLoginRewardStatus(userId, 'twitch');
    // Service now always returns a status (default if no hero found)
    console.log(`[Login Reward] Status retrieved:`, { canClaim: status.canClaim, rewardStreak: status.rewardStreak, totalLoginDays: status.totalLoginDays });
    res.json(status);
  } catch (error) {
    console.error('Error getting login reward status:', error);
    // Return default status on error instead of 500
    res.json({
      canClaim: true,
      lastLoginDate: null,
      rewardStreak: 0,
      totalLoginDays: 0,
      currentRewardDay: 1,
      nextReward: null
    });
  }
});

router.post('/login-reward/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const provider = req.body.provider || 'twitch'; // Default to twitch, can be 'tiktok'
    const { claimLoginReward } = await import('../services/loginRewardService.js');
    const result = await claimLoginReward(userId, provider);
    res.json(result);
  } catch (error) {
    console.error('Error claiming login reward:', error);
    res.status(400).json({ error: error.message || 'Failed to claim reward' });
  }
});

// Get hero by user ID
router.get('/:userId', async (req, res) => {
  try {
    const doc = await db.collection('heroes').doc(req.params.userId).get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Hero not found' });
    }
    
    const heroData = doc.data();
    console.log(`📥 Fetching hero ${req.params.userId}`);
    console.log(`📦 Inventory in response: ${heroData.inventory?.length || 0} items`);
    if (heroData.inventory && heroData.inventory.length > 0) {
      console.log(`🔍 First item:`, JSON.stringify(heroData.inventory[0]));
    }
    
    res.json({ ...heroData, id: doc.id });
  } catch (error) {
    console.error('Error fetching hero:', error);
    res.status(500).json({ error: 'Failed to fetch hero' });
  }
});

// Get hero by Twitch user ID (single active hero)
// Uses the most recently updated hero for this Twitch ID (sorted in memory)
router.get('/twitch/:twitchUserId', async (req, res) => {
  try {
    const { twitchUserId } = req.params; // string from URL
    const heroesRef = db.collection('heroes');

    const numericId = Number(twitchUserId);
    const snapshot = await heroesRef.where('twitchUserId', '==', twitchUserId).get();

    let heroes = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
    if (heroes.length === 0) {
      return res.status(404).json({ error: 'Hero not found' });
    }

    heroes.sort((a, b) => {
      const aTime = a.updatedAt?.toMillis?.() ?? new Date(a.updatedAt ?? 0).getTime();
      const bTime = b.updatedAt?.toMillis?.() ?? new Date(b.updatedAt ?? 0).getTime();
      return bTime - aTime;
    });

    const hero = heroes[0];
    console.log(`📥 Fetching hero by Twitch ID ${twitchUserId} -> docId=${hero.id}, role=${hero.role}, level=${hero.level}`);
    return res.json(hero);
  } catch (error) {
    console.error('Error fetching hero by Twitch ID:', error);
    res.status(500).json({ error: 'Failed to fetch hero' });
  }
});

// Get ALL heroes for a Twitch user ID (string/number safe, no Firestore index needed)
router.get('/twitch/:twitchUserId/all', async (req, res) => {
  try {
    const { twitchUserId } = req.params; // always a string in URL params
    const dbRef = db.collection('heroes');

    const snapshot = await dbRef.where('twitchUserId', '==', twitchUserId).get();

    let heroes = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));

    heroes.sort((a, b) => {
      const aTime = a.updatedAt?.toMillis?.() ?? new Date(a.updatedAt ?? 0).getTime();
      const bTime = b.updatedAt?.toMillis?.() ?? new Date(b.updatedAt ?? 0).getTime();
      return bTime - aTime;
    });

    console.log(`📥 Fetching ALL heroes by Twitch ID ${twitchUserId} -> ${heroes.length} hero(s)`);
    return res.json(heroes);
  } catch (err) {
    console.error('Error fetching heroes by Twitch ID:', err);
    return res.status(500).json({ error: 'internal_server_error' });
  }
});

// Hero creation cost configuration
const HERO_CREATION_COSTS = {
  firstTen: { tokens: 0, price: 0 }, // First 10 heroes are free
  eleventhPlus: { tokens: 500, price: 9.99 } // Heroes 11+: 500 tokens or $9.99
};
const MAX_FREE_HEROES = 10;
const MAX_HEROES = 20; // Allow up to 20 heroes total (10 free + 10 paid)

// Create new hero with class selection
router.post('/create', async (req, res) => {
  try {
    const { class: classKey, twitchUserId, tiktokUserId, battlefieldId, paymentMethod } = req.body;

    if (!classKey || !ROLE_CONFIG[classKey]) {
      return res.status(400).json({ error: 'Invalid class' });
    }

    if (!twitchUserId && !tiktokUserId) {
      return res.status(400).json({ error: 'Twitch or TikTok user ID required' });
    }

    // Get all existing heroes for this user
    let existingHeroes = [];
    
    if (twitchUserId) {
      const twitchCheck = await db.collection('heroes')
        .where('twitchUserId', '==', twitchUserId)
        .get();
      
      existingHeroes = twitchCheck.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
    
    if (tiktokUserId && existingHeroes.length === 0) {
      const tiktokCheck = await db.collection('heroes')
        .where('tiktokUserId', '==', tiktokUserId)
        .get();
      
      existingHeroes = tiktokCheck.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    // Check hero limit
    const heroCount = existingHeroes.length;
    if (heroCount >= MAX_HEROES) {
      return res.status(400).json({ 
        error: `Maximum hero limit reached (${MAX_HEROES} heroes)`,
        heroCount,
        maxHeroes: MAX_HEROES
      });
    }

    // Calculate cost for this hero
    let cost;
    if (heroCount < MAX_FREE_HEROES) {
      cost = HERO_CREATION_COSTS.firstTen; // First 10 heroes are free
    } else {
      cost = HERO_CREATION_COSTS.eleventhPlus; // Heroes 11+ cost tokens or payment
    }

    // If hero 11+, validate payment
    if (heroCount >= MAX_FREE_HEROES) {
      if (!paymentMethod || (paymentMethod !== 'tokens' && paymentMethod !== 'payment')) {
        return res.status(400).json({ 
          error: 'Payment method required for additional heroes',
          cost,
          heroCount
        });
      }

      if (paymentMethod === 'tokens') {
        // Sum tokens across all user's heroes
        const totalTokens = existingHeroes.reduce((sum, hero) => sum + (hero.tokens || 0), 0);
        
        if (totalTokens < cost.tokens) {
          return res.status(400).json({ 
            error: `Insufficient tokens. Required: ${cost.tokens}, Available: ${totalTokens}`,
            required: cost.tokens,
            available: totalTokens,
            heroCount
          });
        }

        // Deduct tokens from the highest level hero (or first hero if same level)
        const heroToDeduct = existingHeroes.reduce((highest, hero) => {
          if (!highest) return hero;
          return (hero.level || 0) > (highest.level || 0) ? hero : highest;
        }, null);

        if (heroToDeduct) {
          const newTokens = Math.max(0, (heroToDeduct.tokens || 0) - cost.tokens);
          await db.collection('heroes').doc(heroToDeduct.id).update({
            tokens: newTokens,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
      } else if (paymentMethod === 'payment') {
        // TODO: Integrate payment processing (Stripe, PayPal, etc.)
        // For now, we'll just validate that payment method was specified
        // In production, you'd verify the payment transaction here
        console.log(`[Hero Creation] Payment method selected: ${paymentMethod}, Cost: $${cost.price}`);
        // You would verify payment here before proceeding
      }
    }

    const config = ROLE_CONFIG[classKey];
    // Heroes use the Twitch username as their name (passed from frontend)
    // If not provided, use a default based on user ID
    const heroName = req.body.twitchUsername || req.body.name || `User${twitchUserId || tiktokUserId || 'Hero'}`;
    const heroData = {
      name: heroName,
      ...(twitchUserId && { twitchUserId }),
      ...(tiktokUserId && { tiktokUserId }),
      role: classKey,
      level: 1,
      hp: config.baseHp,
      maxHp: config.baseHp,
      xp: 0,
      maxXp: 100,
      attack: config.baseAttack,
      defense: config.baseDefense,
      gold: 0,
      tokens: 0,
      totalIdleTokens: 0,
      lastTokenClaim: Date.now(),
      lastCommandTime: Date.now(),
      equipment: {
        weapon: null,
        armor: null,
        accessory: null,
        shield: null
      },
      stats: {
        totalDamage: 0,
        totalHealing: 0,
        damageBlocked: 0
      },
      isDead: false,
      deathTime: null,
      potions: {
        health: 0
      },
      activeBuffs: {},
      profession: null,
      skills: {},
      skillPoints: 0,
      skillPointsEarned: 0,
      joinedAt: Date.now(),
      // Set battlefield ID if provided (for streamer battlefields)
      // Format: "twitch:channelId" or "twitch:username"
      ...(battlefieldId && { 
        currentBattlefieldId: battlefieldId,
        currentBattlefieldType: battlefieldId.startsWith('twitch:') ? 'streamer' : 'world'
      }),
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    const docRef = await db.collection('heroes').add(heroData);
    const doc = await docRef.get();
    
    res.status(201).json({ 
      ...doc.data(), 
      id: doc.id,
      heroCount: heroCount + 1,
      maxHeroes: MAX_HEROES
    });
  } catch (error) {
    console.error('Error creating hero:', error);
    res.status(500).json({ error: 'Failed to create hero' });
  }
});

// Get hero creation cost info
router.get('/create/cost-info', async (req, res) => {
  try {
    const { twitchUserId, tiktokUserId } = req.query;

    if (!twitchUserId && !tiktokUserId) {
      return res.status(400).json({ error: 'Twitch or TikTok user ID required' });
    }

    // Get all existing heroes for this user
    let existingHeroes = [];
    
    if (twitchUserId) {
      const twitchCheck = await db.collection('heroes')
        .where('twitchUserId', '==', twitchUserId)
        .get();
      
      existingHeroes = twitchCheck.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
    
    if (tiktokUserId && existingHeroes.length === 0) {
      const tiktokCheck = await db.collection('heroes')
        .where('tiktokUserId', '==', tiktokUserId)
        .get();
      
      existingHeroes = tiktokCheck.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    const heroCount = existingHeroes.length;
    
    // Calculate cost for next hero
    let cost;
    if (heroCount < MAX_FREE_HEROES) {
      cost = HERO_CREATION_COSTS.firstTen; // First 10 heroes are free
    } else {
      cost = HERO_CREATION_COSTS.eleventhPlus; // Heroes 11+ cost tokens or payment
    }

    // Calculate total available tokens across all heroes
    const totalTokens = existingHeroes.reduce((sum, hero) => sum + (hero.tokens || 0), 0);

    res.json({
      heroCount,
      maxHeroes: MAX_HEROES,
      canCreateMore: heroCount < MAX_HEROES,
      cost,
      availableTokens: totalTokens,
      canAffordWithTokens: totalTokens >= cost.tokens
    });
  } catch (error) {
    console.error('Error getting hero creation cost info:', error);
    res.status(500).json({ error: 'Failed to get cost info' });
  }
});

// Create new hero (legacy endpoint)
router.post('/', async (req, res) => {
  try {
    const heroData = {
      ...req.body,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    const docRef = await db.collection('heroes').add(heroData);
    const doc = await docRef.get();
    
    res.status(201).json({ ...doc.data(), id: doc.id });
  } catch (error) {
    console.error('Error creating hero:', error);
    res.status(500).json({ error: 'Failed to create hero' });
  }
});

// Update hero
router.put('/:userId', async (req, res) => {
  try {
    const heroId = req.params.userId;
    const heroRef = db.collection('heroes').doc(heroId);
    const doc = await heroRef.get();
    
    if (!doc.exists) {
      console.warn(`⚠️ [Update Hero] Hero not found: ${heroId} - This hero may have been deleted or never existed`);
      return res.status(404).json({ error: 'Hero not found', heroId });
    }
    
    const updateData = {
      ...req.body,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await heroRef.update(updateData);
    const updated = await heroRef.get();
    
    res.json({ ...updated.data(), id: updated.id });
  } catch (error) {
    console.error('Error updating hero:', error);
    res.status(500).json({ error: 'Failed to update hero' });
  }
});

// Toggle hero pin status
router.post('/:userId/pin', async (req, res) => {
  try {
    const heroRef = db.collection('heroes').doc(req.params.userId);
    const doc = await heroRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Hero not found' });
    }
    
    const hero = doc.data();
    const currentPinned = hero.pinned || false;
    
    await heroRef.update({
      pinned: !currentPinned,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    const updated = await heroRef.get();
    res.json({ ...updated.data(), id: updated.id });
  } catch (error) {
    console.error('Error toggling hero pin:', error);
    res.status(500).json({ error: 'Failed to toggle hero pin' });
  }
});

// Delete hero
router.delete('/:heroId', async (req, res) => {
  try {
    const { heroId } = req.params;
    const { userId } = req.body; // User ID for authorization check
    
    const heroRef = db.collection('heroes').doc(heroId);
    const doc = await heroRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Hero not found' });
    }
    
    const hero = doc.data();
    
    // Verify the hero belongs to the user
    if (userId && hero.twitchUserId !== userId && hero.tiktokUserId !== userId) {
      return res.status(403).json({ error: 'You can only delete your own heroes' });
    }
    
    // Check if hero is in an active battlefield, dungeon, or raid
    if (hero.currentBattlefieldId) {
      return res.status(400).json({ 
        error: 'Cannot delete hero while in a battlefield. Use !leave first.' 
      });
    }
    
    await heroRef.delete();
    res.json({ message: 'Hero deleted successfully' });
  } catch (error) {
    console.error('Error deleting hero:', error);
    res.status(500).json({ error: 'Failed to delete hero' });
  }
});

// Purchase gold shop item
router.post('/:userId/purchase/gold', async (req, res) => {
  try {
    const { itemKey } = req.body;
    const { userId } = req.params;

    const GOLD_SHOP_ITEMS = {
      healthpotion: { name: 'Health Potion', cost: 10, type: 'potion' }, // Balanced: 10g (was 50g)
      xpboost: { name: 'XP Boost Scroll', cost: 25, type: 'buff', duration: 300000 }, // Balanced: 25g (was 100g)
      attackbuff: { name: 'Sharpening Stone', cost: 15, type: 'buff', duration: 600000 }, // Balanced: 15g (was 150g)
      defensebuff: { name: 'Armor Polish', cost: 15, type: 'buff', duration: 600000 } // Balanced: 15g (was 150g)
    };

    if (!GOLD_SHOP_ITEMS[itemKey]) {
      return res.status(400).json({ error: 'Invalid item' });
    }

    const item = GOLD_SHOP_ITEMS[itemKey];
    const heroRef = db.collection('heroes').doc(userId);
    const doc = await heroRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Hero not found' });
    }

    const hero = doc.data();
    const currentGold = hero.gold || 0;

    if (currentGold < item.cost) {
      return res.status(400).json({ 
        error: `Not enough gold! Need ${item.cost}g, have ${currentGold}g` 
      });
    }

    // Deduct gold
    const updates = {
      gold: currentGold - item.cost,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Apply item effect
    if (item.type === 'potion') {
      updates['potions.health'] = admin.firestore.FieldValue.increment(1);
    } else if (item.type === 'buff') {
      // Add buff to activeBuffs (handled by Electron app in real-time)
      // Website just deducts gold, Electron app applies the buff
    }

    await heroRef.update(updates);

    console.log(`💰 ${userId} purchased ${item.name} for ${item.cost}g`);

    res.json({ 
      success: true, 
      message: `Purchased ${item.name}! Gold remaining: ${currentGold - item.cost}g`,
      newGold: currentGold - item.cost
    });
  } catch (error) {
    console.error('Error purchasing gold item:', error);
    res.status(500).json({ error: 'Failed to purchase item' });
  }
});

// Purchase token shop gear
router.post('/:userId/purchase/tokens', async (req, res) => {
  try {
    const { rarity, slot } = req.body;
    const { userId } = req.params;

    const TOKEN_SHOP_PRICES = {
      common: 50, // Balanced: 50t (was 25t) - 2x increase for monetization
      rare: 200, // Balanced: 200t (was 100t) - 2x increase
      epic: 600, // Balanced: 600t (was 300t) - 2x increase
      legendary: 2500, // Balanced: 2500t (was 1000t) - 2.5x increase
      mythic: 10000 // NEW - ultra-rare tier
    };

    if (!TOKEN_SHOP_PRICES[rarity]) {
      return res.status(400).json({ error: 'Invalid rarity' });
    }

    const validSlots = ['weapon', 'armor', 'accessory', 'shield'];
    if (!validSlots.includes(slot)) {
      return res.status(400).json({ error: 'Invalid slot' });
    }

    const cost = TOKEN_SHOP_PRICES[rarity];
    const heroRef = db.collection('heroes').doc(userId);
    const doc = await heroRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Hero not found' });
    }

    const hero = doc.data();
    const currentTokens = hero.tokens || 0;

    if (currentTokens < cost) {
      return res.status(400).json({ 
        error: `Not enough tokens! Need ${cost}t, have ${currentTokens}t` 
      });
    }

    // Generate gear based on hero level (same logic as Electron app)
    const LOOT_RARITIES = {
      common: { statMultiplier: 1.0, color: '#9ca3af' },
      rare: { statMultiplier: 1.5, color: '#3b82f6' },
      epic: { statMultiplier: 2.0, color: '#a855f7' },
      legendary: { statMultiplier: 3.0, color: '#eab308' }
    };

    const rarityData = LOOT_RARITIES[rarity];
    const heroLevel = hero.level || 1;
    const levelMultiplier = 1 + (heroLevel * 0.1);

    // Base item templates by slot
    const templates = {
      weapon: { name: 'Weapon', attack: 12, defense: 0, hp: 0 },
      armor: { name: 'Armor', attack: 5, defense: 12, hp: 30 },
      accessory: { name: 'Ring', attack: 8, defense: 4, hp: 15 },
      shield: { name: 'Shield', attack: 0, defense: 15, hp: 30 }
    };

    const template = templates[slot];
    const item = {
      id: `${rarity}_${slot}_${Date.now()}`,
      name: `${rarity.charAt(0).toUpperCase() + rarity.slice(1)} ${template.name}`,
      slot,
      rarity,
      color: rarityData.color,
      attack: Math.floor(template.attack * rarityData.statMultiplier * levelMultiplier),
      defense: Math.floor(template.defense * rarityData.statMultiplier * levelMultiplier),
      hp: Math.floor(template.hp * rarityData.statMultiplier * levelMultiplier)
    };

    // Initialize inventory if needed
    if (!hero.inventory) {
      hero.inventory = [];
    }

    // Add to inventory
    hero.inventory.push(item);

    // Deduct tokens
    await heroRef.update({
      tokens: currentTokens - cost,
      inventory: hero.inventory,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`🎫 ${userId} purchased ${rarity} ${slot} for ${cost}t`);

    res.json({ 
      success: true, 
      message: `Purchased ${item.name}! Tokens remaining: ${currentTokens - cost}t`,
      item,
      newTokens: currentTokens - cost
    });
  } catch (error) {
    console.error('Error purchasing token gear:', error);
    res.status(500).json({ error: 'Failed to purchase gear' });
  }
});

// Gold Sinks - Balanced, not gacha
// Upgrade equipment level (1-5 levels)
router.post('/:userId/upgrade-item', async (req, res) => {
  try {
    const { userId } = req.params;
    const { itemId, levels = 1 } = req.body; // levels: 1-5

    if (!itemId || levels < 1 || levels > 5) {
      return res.status(400).json({ error: 'Invalid request. Levels must be 1-5' });
    }

    const heroRef = db.collection('heroes').doc(userId);
    const doc = await heroRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Hero not found' });
    }

    const hero = doc.data();
    
    // Find item in equipment or inventory
    let item = null;
    let itemLocation = null;
    let itemIndex = -1;

    // Check equipment first
    if (hero.equipment) {
      for (const [slot, equippedItem] of Object.entries(hero.equipment)) {
        if (equippedItem && equippedItem.id === itemId) {
          item = equippedItem;
          itemLocation = 'equipment';
          break;
        }
      }
    }

    // Check inventory if not found
    if (!item && hero.inventory) {
      itemIndex = hero.inventory.findIndex(i => i.id === itemId);
      if (itemIndex !== -1) {
        item = hero.inventory[itemIndex];
        itemLocation = 'inventory';
      }
    }

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Calculate upgrade cost (balanced: 100g per level, scales with current item level)
    const currentLevel = item.level || 1;
    const baseCost = 100; // Base cost per level
    const levelMultiplier = 1 + (currentLevel * 0.1); // 10% increase per level
    const totalCost = Math.floor(baseCost * levels * levelMultiplier);

    const currentGold = hero.gold || 0;
    if (currentGold < totalCost) {
      return res.status(400).json({ 
        error: `Not enough gold! Need ${totalCost}g, have ${currentGold}g` 
      });
    }

    // Upgrade item
    const newLevel = currentLevel + levels;
    const statMultiplier = 1 + (newLevel * 0.05); // 5% stat increase per level

    const upgradedItem = {
      ...item,
      level: newLevel,
      attack: Math.floor((item.attack || 0) * statMultiplier),
      defense: Math.floor((item.defense || 0) * statMultiplier),
      hp: Math.floor((item.hp || 0) * statMultiplier)
    };

    const updates = {
      gold: currentGold - totalCost,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Update item in correct location
    if (itemLocation === 'equipment') {
      const slot = Object.keys(hero.equipment).find(s => hero.equipment[s]?.id === itemId);
      updates[`equipment.${slot}`] = upgradedItem;
    } else if (itemLocation === 'inventory') {
      const inventory = [...hero.inventory];
      inventory[itemIndex] = upgradedItem;
      updates.inventory = inventory;
    }

    await heroRef.update(updates);

    console.log(`⚡ ${userId} upgraded item ${itemId} by ${levels} level(s) for ${totalCost}g`);

    res.json({ 
      success: true, 
      message: `Item upgraded to level ${newLevel}! Gold remaining: ${currentGold - totalCost}g`,
      item: upgradedItem,
      newGold: currentGold - totalCost
    });
  } catch (error) {
    console.error('Error upgrading item:', error);
    res.status(500).json({ error: 'Failed to upgrade item' });
  }
});

// Reforge secondary stats (reroll secondary stats, keep primary stats)
router.post('/:userId/reforge-item', async (req, res) => {
  try {
    const { userId } = req.params;
    const { itemId } = req.body;

    if (!itemId) {
      return res.status(400).json({ error: 'Item ID required' });
    }

    const heroRef = db.collection('heroes').doc(userId);
    const doc = await heroRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Hero not found' });
    }

    const hero = doc.data();
    
    // Find item (same logic as upgrade)
    let item = null;
    let itemLocation = null;
    let itemIndex = -1;

    if (hero.equipment) {
      for (const [slot, equippedItem] of Object.entries(hero.equipment)) {
        if (equippedItem && equippedItem.id === itemId) {
          item = equippedItem;
          itemLocation = 'equipment';
          break;
        }
      }
    }

    if (!item && hero.inventory) {
      itemIndex = hero.inventory.findIndex(i => i.id === itemId);
      if (itemIndex !== -1) {
        item = hero.inventory[itemIndex];
        itemLocation = 'inventory';
      }
    }

    if (!item) {
      return res.status(404).json({ error: 'Item not found' });
    }

    // Only rare+ items can be reforged
    if (!item.secondaryStats || (item.rarity !== 'rare' && item.rarity !== 'epic' && item.rarity !== 'legendary' && item.rarity !== 'mythic')) {
      return res.status(400).json({ error: 'Only rare+ items with secondary stats can be reforged' });
    }

    // Reforge cost: 500 gold (balanced, not gacha)
    const reforgeCost = 500;
    const currentGold = hero.gold || 0;

    if (currentGold < reforgeCost) {
      return res.status(400).json({ 
        error: `Not enough gold! Need ${reforgeCost}g, have ${currentGold}g` 
      });
    }

    // Reroll secondary stats (keep same stat types, reroll values)
    const rarityMultipliers = {
      rare: 1.0,
      epic: 1.5,
      legendary: 2.0,
      mythic: 3.0
    };

    const multiplier = rarityMultipliers[item.rarity] || 1.0;
    const newSecondaryStats = { ...item.secondaryStats };

    // Reroll each secondary stat with some variance
    Object.keys(newSecondaryStats).forEach(stat => {
      const baseValue = newSecondaryStats[stat];
      const variance = 0.8 + (Math.random() * 0.4); // 80-120% of base value
      newSecondaryStats[stat] = Math.floor(baseValue * multiplier * variance);
    });

    const reforgedItem = {
      ...item,
      secondaryStats: newSecondaryStats
    };

    const updates = {
      gold: currentGold - reforgeCost,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    // Update item
    if (itemLocation === 'equipment') {
      const slot = Object.keys(hero.equipment).find(s => hero.equipment[s]?.id === itemId);
      updates[`equipment.${slot}`] = reforgedItem;
    } else if (itemLocation === 'inventory') {
      const inventory = [...hero.inventory];
      inventory[itemIndex] = reforgedItem;
      updates.inventory = inventory;
    }

    await heroRef.update(updates);

    console.log(`🔨 ${userId} reforged item ${itemId} for ${reforgeCost}g`);

    res.json({ 
      success: true, 
      message: `Item reforged! Gold remaining: ${currentGold - reforgeCost}g`,
      item: reforgedItem,
      newGold: currentGold - reforgeCost
    });
  } catch (error) {
    console.error('Error reforging item:', error);
    res.status(500).json({ error: 'Failed to reforge item' });
  }
});

// Expand bank storage (add bank slots)
router.post('/:userId/expand-storage', async (req, res) => {
  try {
    const { userId } = req.params;
    const { slots = 10 } = req.body; // Default 10 slots, max 50 per purchase

    if (slots < 1 || slots > 50) {
      return res.status(400).json({ error: 'Slots must be between 1 and 50' });
    }

    const heroRef = db.collection('heroes').doc(userId);
    const doc = await heroRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Hero not found' });
    }

    const hero = doc.data();
    
    // Calculate cost: 50 gold per slot (balanced, one-time purchase)
    const costPerSlot = 50;
    const totalCost = costPerSlot * slots;
    const currentGold = hero.gold || 0;

    if (currentGold < totalCost) {
      return res.status(400).json({ 
        error: `Not enough gold! Need ${totalCost}g, have ${currentGold}g` 
      });
    }

    // Get current bank size (default 50 if not set)
    const currentBankSize = hero.bankSize || 50;
    const newBankSize = currentBankSize + slots;

    // Max bank size: 500 slots (reasonable cap)
    if (newBankSize > 500) {
      return res.status(400).json({ error: 'Maximum bank size is 500 slots' });
    }

    await heroRef.update({
      gold: currentGold - totalCost,
      bankSize: newBankSize,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`📦 ${userId} expanded bank by ${slots} slots (${currentBankSize} -> ${newBankSize}) for ${totalCost}g`);

    res.json({ 
      success: true, 
      message: `Bank expanded to ${newBankSize} slots! Gold remaining: ${currentGold - totalCost}g`,
      newBankSize,
      newGold: currentGold - totalCost
    });
  } catch (error) {
    console.error('Error expanding storage:', error);
    res.status(500).json({ error: 'Failed to expand storage' });
  }
});


// Port hero to new battlefield
router.post('/:userId/port', async (req, res) => {
  try {
    const { userId } = req.params;
    const { battlefieldId, battlefieldType } = req.body;

    if (!battlefieldId) {
      return res.status(400).json({ error: 'Battlefield ID required' });
    }

    // Validate battlefield type
    const validTypes = ['world', 'streamer'];
    if (battlefieldType && !validTypes.includes(battlefieldType)) {
      return res.status(400).json({ error: 'Invalid battlefield type' });
    }

    // Get hero - try by userId first, then by twitchUserId/tiktokUserId
    let heroRef = db.collection('heroes').doc(userId);
    let doc = await heroRef.get();

    if (!doc.exists) {
      // Try to find by twitchUserId or tiktokUserId
      const allHeroes = await db.collection('heroes')
        .where('twitchUserId', '==', userId)
        .limit(1)
        .get();
      
      if (allHeroes.empty) {
        const tiktokHeroes = await db.collection('heroes')
          .where('tiktokUserId', '==', userId)
          .limit(1)
          .get();
        
        if (tiktokHeroes.empty) {
          return res.status(404).json({ error: 'Hero not found' });
        }
        
        heroRef = tiktokHeroes.docs[0].ref;
        doc = await heroRef.get();
      } else {
        heroRef = allHeroes.docs[0].ref;
        doc = await heroRef.get();
      }
    }

    const hero = doc.data();
    const oldBattlefieldId = hero.currentBattlefieldId || null;

    // Update battlefield history
    const battlefieldHistory = hero.battlefieldHistory || [];
    
    // Mark old battlefield entry as left
    if (oldBattlefieldId) {
      const lastEntry = battlefieldHistory[battlefieldHistory.length - 1];
      if (lastEntry && lastEntry.battlefieldId === oldBattlefieldId && !lastEntry.leftAt) {
        lastEntry.leftAt = admin.firestore.Timestamp.now();
      }
    }

    // Add new battlefield entry
    battlefieldHistory.push({
      battlefieldId,
      joinedAt: admin.firestore.Timestamp.now(),
      leftAt: null
    });

    // Determine battlefield type if not provided
    let finalBattlefieldType = battlefieldType;
    if (!finalBattlefieldType) {
      if (battlefieldId === 'world') {
        finalBattlefieldType = 'world';
      } else if (battlefieldId.startsWith('twitch:')) {
        finalBattlefieldType = 'streamer';
      } else {
        finalBattlefieldType = 'world'; // Default
      }
    }

    // Update hero with new battlefield
    await heroRef.update({
      currentBattlefieldId: battlefieldId,
      currentBattlefieldType: finalBattlefieldType,
      lastBattlefieldJoin: admin.firestore.Timestamp.now(),
      battlefieldHistory: battlefieldHistory.slice(-50), // Keep last 50 entries
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`🚀 Hero ${userId} ported from ${oldBattlefieldId || 'none'} to ${battlefieldId}`);

    res.json({
      success: true,
      message: `Hero ported to ${battlefieldId}`,
      oldBattlefieldId,
      newBattlefieldId: battlefieldId,
      battlefieldType: finalBattlefieldType
    });
  } catch (error) {
    console.error('Error porting hero:', error);
    res.status(500).json({ error: 'Failed to port hero' });
  }
});

/**
 * Admin: Give item to hero
 * POST /api/heroes/:userId/admin/give-item
 */
router.post('/:userId/admin/give-item', async (req, res) => {
  try {
    const { userId } = req.params;
    const { item } = req.body;

    const heroRef = db.collection('heroes').doc(userId);
    const doc = await heroRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Hero not found' });
    }

    const hero = doc.data();
    
    // Initialize inventory if it doesn't exist
    if (!hero.inventory) {
      hero.inventory = [];
    }

    // Add item to inventory
    hero.inventory.push(item);

    await heroRef.update({
      inventory: hero.inventory,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({ success: true, message: 'Item added to inventory', item });
  } catch (error) {
    console.error('Error giving item:', error);
    res.status(500).json({ error: 'Failed to give item' });
  }
});

export default router;
