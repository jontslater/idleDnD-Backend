import express from 'express';
import admin from 'firebase-admin';
import { db } from '../index.js';
import { ROLE_CONFIG } from '../data/roleConfig.js';

const router = express.Router();

// Create test hero for testing (dev only)
router.post('/test/create', async (req, res) => {
  try {
    const { userId, username, heroName, role, level } = req.body;
    
    if (!userId || !username || !heroName) {
      return res.status(400).json({ error: 'userId, username, and heroName are required' });
    }
    
    const testRole = role || 'berserker';
    const testLevel = level || 20;
    
    // Check if hero already exists
    const existingHero = await db.collection('heroes').doc(userId).get();
    if (existingHero.exists) {
      return res.status(400).json({ error: 'Hero already exists for this userId' });
    }
    
    // Get role config
    const roleConfig = ROLE_CONFIG[testRole] || ROLE_CONFIG.berserker;
    
    // Create test hero with equipment that meets raid requirements (500+ item score)
    // Each piece gives ~100 item score, so 5 pieces = 500+ item score
    const testHero = {
      userId,
      name: heroName,
      username,
      role: testRole,
      level: testLevel,
      xp: 0,
      maxXp: 100 + (testLevel * 10),
      gold: 10000,
      tokens: 1000,
      equipment: {
        weapon: {
          name: 'Test Weapon',
          rarity: 'epic',
          attack: 100,
          defense: 0,
          hp: 0,
          itemScore: 200
        },
        armor: {
          name: 'Test Armor',
          rarity: 'epic',
          attack: 0,
          defense: 60,
          hp: 400,
          itemScore: 200
        },
        accessory: {
          name: 'Test Accessory',
          rarity: 'rare',
          attack: 30,
          defense: 20,
          hp: 150,
          itemScore: 100
        }
      },
      stats: {
        attack: roleConfig.baseAttack + (testLevel * 5) + 50,
        defense: roleConfig.baseDefense + (testLevel * 3) + 30,
        maxHp: roleConfig.baseHp + (testLevel * 20) + 200,
        hp: roleConfig.baseHp + (testLevel * 20) + 200,
        critChance: roleConfig.baseCritChance || 0.05,
        hpRegen: roleConfig.baseHpRegen || 1
      },
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    
    await db.collection('heroes').doc(userId).set(testHero);
    
    res.json({
      success: true,
      message: 'Test hero created successfully',
      hero: {
        id: userId,
        ...testHero
      }
    });
  } catch (error) {
    console.error('Error creating test hero:', error);
    res.status(500).json({ error: 'Failed to create test hero', details: error.message });
  }
});

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

// Unlock hero slot endpoint
router.post('/:userId/unlock-slot', async (req, res) => {
  try {
    const userId = req.params.userId;
    const { twitchUserId, tiktokUserId } = req.body;

    // Get user ID (prefer Twitch, fallback to TikTok)
    const actualUserId = twitchUserId || tiktokUserId || userId;
    const isTwitch = !!twitchUserId || !!userId;

    // Get current slots unlocked
    const currentSlots = await getUserSlotsUnlocked(actualUserId, isTwitch);

    // Check if already at max
    if (currentSlots >= MAX_HEROES) {
      return res.status(400).json({
        error: `Already at maximum hero slots (${MAX_HEROES})`,
        slotsUnlocked: currentSlots,
        maxHeroes: MAX_HEROES
      });
    }

    const nextSlot = currentSlots + 1;
    const unlockCost = SLOT_UNLOCK_COSTS[nextSlot] || SLOT_UNLOCK_COSTS[20]; // Default to max cost

    // Get all user's heroes to find tokens
    let existingHeroes = [];
    if (twitchUserId || userId) {
      const twitchCheck = await db.collection('heroes')
        .where('twitchUserId', '==', actualUserId)
        .get();
      existingHeroes = twitchCheck.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
    
    if (tiktokUserId && existingHeroes.length === 0) {
      const tiktokCheck = await db.collection('heroes')
        .where('tiktokUserId', '==', actualUserId)
        .get();
      existingHeroes = tiktokCheck.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    // Sum tokens across all user's heroes
    const totalTokens = existingHeroes.reduce((sum, hero) => sum + (hero.tokens || 0), 0);

    if (totalTokens < unlockCost) {
      return res.status(400).json({
        error: `Insufficient tokens. Required: ${unlockCost}, Available: ${totalTokens}`,
        required: unlockCost,
        available: totalTokens,
        nextSlot,
        currentSlots
      });
    }

    // Deduct tokens from the highest level hero (or first hero if same level)
    const heroToDeduct = existingHeroes.reduce((highest, hero) => {
      if (!highest) return hero;
      return (hero.level || 0) > (highest.level || 0) ? hero : highest;
    }, null);

    if (heroToDeduct) {
      const newTokens = Math.max(0, (heroToDeduct.tokens || 0) - unlockCost);
      await db.collection('heroes').doc(heroToDeduct.id).update({
        tokens: newTokens,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    // Update user's slotsUnlocked
    const userRef = db.collection('users').doc(actualUserId);
    await userRef.set({
      slotsUnlocked: nextSlot,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

    console.log(`[Slot Unlock] User ${actualUserId} unlocked slot ${nextSlot} for ${unlockCost} tokens`);

    res.json({
      success: true,
      slotsUnlocked: nextSlot,
      tokensSpent: unlockCost,
      remainingTokens: totalTokens - unlockCost,
      nextSlotCost: SLOT_UNLOCK_COSTS[nextSlot + 1] || null,
      maxHeroes: MAX_HEROES
    });
  } catch (error) {
    console.error('Error unlocking hero slot:', error);
    res.status(500).json({ error: 'Failed to unlock hero slot', details: error.message });
  }
});

// Get user's slot information
router.get('/:userId/slots', async (req, res) => {
  try {
    const userId = req.params.userId;
    const { twitchUserId, tiktokUserId } = req.query;

    // Get user ID (prefer Twitch, fallback to TikTok)
    const actualUserId = twitchUserId || tiktokUserId || userId;
    const isTwitch = !!twitchUserId || !!userId;

    // Get current slots unlocked
    const slotsUnlocked = await getUserSlotsUnlocked(actualUserId, isTwitch);

    // Get hero count
    let existingHeroes = [];
    if (twitchUserId || userId) {
      const twitchCheck = await db.collection('heroes')
        .where('twitchUserId', '==', actualUserId)
        .get();
      existingHeroes = twitchCheck.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }
    
    if (tiktokUserId && existingHeroes.length === 0) {
      const tiktokCheck = await db.collection('heroes')
        .where('tiktokUserId', '==', actualUserId)
        .get();
      existingHeroes = tiktokCheck.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    const heroCount = existingHeroes.length;
    const nextSlot = slotsUnlocked + 1;
    const nextSlotCost = nextSlot <= MAX_HEROES ? SLOT_UNLOCK_COSTS[nextSlot] : null;

    // Sum tokens across all user's heroes
    const totalTokens = existingHeroes.reduce((sum, hero) => sum + (hero.tokens || 0), 0);

    res.json({
      slotsUnlocked,
      heroCount,
      nextSlot,
      nextSlotCost,
      totalTokens,
      maxHeroes: MAX_HEROES,
      canUnlock: heroCount >= slotsUnlocked && nextSlot <= MAX_HEROES && totalTokens >= (nextSlotCost || 0)
    });
  } catch (error) {
    console.error('Error getting slot information:', error);
    res.status(500).json({ error: 'Failed to get slot information', details: error.message });
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

// Hero slot unlock costs
const SLOT_UNLOCK_COSTS = {
  6: 500,   // Slot 6-8: 500 tokens each
  7: 500,
  8: 500,
  9: 1000,  // Slot 9-12: 1,000 tokens each
  10: 1000,
  11: 1000,
  12: 1000,
  13: 2000, // Slot 13-17: 2,000 tokens each
  14: 2000,
  15: 2000,
  16: 2000,
  17: 2000,
  18: 5000, // Slot 18-20: 5,000 tokens each
  19: 5000,
  20: 5000
};

const DEFAULT_SLOTS_UNLOCKED = 3; // Free tier: 3 heroes
const MAX_HEROES = 20; // Maximum total heroes allowed

// Helper function to get or create user document with slotsUnlocked
async function getUserSlotsUnlocked(userId, isTwitch = true) {
  const userRef = db.collection('users').doc(userId);
  const userDoc = await userRef.get();
  
  if (!userDoc.exists) {
    // Create user document with default slots
    await userRef.set({
      slotsUnlocked: DEFAULT_SLOTS_UNLOCKED,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return DEFAULT_SLOTS_UNLOCKED;
  }
  
  const userData = userDoc.data();
  return userData.slotsUnlocked || DEFAULT_SLOTS_UNLOCKED;
}

// Create new hero with class selection
router.post('/create', async (req, res) => {
  try {
    const { class: classKey, twitchUserId, tiktokUserId, battlefieldId } = req.body;

    if (!classKey || !ROLE_CONFIG[classKey]) {
      return res.status(400).json({ error: 'Invalid class' });
    }

    if (!twitchUserId && !tiktokUserId) {
      return res.status(400).json({ error: 'Twitch or TikTok user ID required' });
    }

    // Get user ID (prefer Twitch, fallback to TikTok)
    const userId = twitchUserId || tiktokUserId;
    const isTwitch = !!twitchUserId;

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
    
    // Check absolute max limit
    if (heroCount >= MAX_HEROES) {
      return res.status(400).json({ 
        error: `Maximum hero limit reached (${MAX_HEROES} heroes)`,
        heroCount,
        maxHeroes: MAX_HEROES
      });
    }

    // Check unlocked slots limit
    const slotsUnlocked = await getUserSlotsUnlocked(userId, isTwitch);
    if (heroCount >= slotsUnlocked) {
      const nextSlot = heroCount + 1;
      const unlockCost = SLOT_UNLOCK_COSTS[nextSlot] || SLOT_UNLOCK_COSTS[20]; // Default to max cost
      return res.status(400).json({ 
        error: `Hero slot limit reached. Unlock slot ${nextSlot} to create more heroes.`,
        heroCount,
        slotsUnlocked,
        nextSlot,
        unlockCost,
        maxHeroes: MAX_HEROES
      });
    }

    const config = ROLE_CONFIG[classKey];
    // Heroes use the Twitch username as their name (passed from frontend)
    // If not provided, use a default based on user ID
    const heroName = req.body.twitchUsername || req.body.name || `User${twitchUserId || tiktokUserId || 'Hero'}`;
    
    // Check if user has founder pack from existing heroes (apply to all heroes)
    let founderPackTier = null;
    let founderPackTierLevel = null;
    if (existingHeroes.length > 0) {
      const firstHero = existingHeroes[0];
      if (firstHero.founderPackTier) {
        founderPackTier = firstHero.founderPackTier;
        founderPackTierLevel = firstHero.founderPackTierLevel;
        console.log(`[Create Hero] Inheriting founder pack tier: ${founderPackTier} from existing hero`);
      }
    }
    
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
      // Inherit founder pack tier from existing heroes (applies to all user's heroes)
      ...(founderPackTier && { founderPackTier }),
      ...(founderPackTierLevel !== null && { founderPackTierLevel }),
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

    // Get quantity (default to 1)
    const quantity = req.body.quantity || 1;
    const totalCost = item.cost * quantity;

    if (currentGold < totalCost) {
      return res.status(400).json({ 
        error: `Not enough gold! Need ${totalCost}g, have ${currentGold}g` 
      });
    }

    // Initialize inventory if needed
    const currentInventory = hero.inventory || [];
    
    // Check inventory space (count unique item types, not quantities)
    // Group consumables by itemKey
    const consumableGroups = new Set();
    const professionGroups = new Set();
    let regularItemCount = 0;
    
    currentInventory.forEach(invItem => {
      if (invItem.professionItem) {
        const key = invItem.recipeKey || invItem.id;
        professionGroups.add(key);
      } else if (invItem.type === 'potion' || invItem.type === 'buff' || invItem.itemKey) {
        const key = invItem.itemKey || invItem.name || invItem.id;
        consumableGroups.add(key);
      } else {
        regularItemCount++;
      }
    });
    
    const currentSlotsUsed = professionGroups.size + consumableGroups.size + regularItemCount;
    const maxSlots = hero.bankSize || 50;
    
    // Adding this item type will use 1 slot if it's new, 0 if we already have it
    const isNewItemType = !consumableGroups.has(itemKey);
    const willExceed = isNewItemType && currentSlotsUsed >= maxSlots;
    
    if (willExceed) {
      return res.status(400).json({ 
        error: `Inventory full! You have ${currentSlotsUsed}/${maxSlots} slots used. Sell items or expand storage.` 
      });
    }

    // Create inventory item(s)
    for (let i = 0; i < quantity; i++) {
      const inventoryItem = {
        id: `${itemKey}_${Date.now()}_${i}`,
        name: item.name,
        type: item.type,
        itemKey: itemKey,
        cost: item.cost,
        purchasedAt: admin.firestore.Timestamp.now(),
        ...(item.duration && { duration: item.duration })
      };
      currentInventory.push(inventoryItem);
    }

    // Deduct gold and add to inventory
    const updates = {
      gold: currentGold - totalCost,
      inventory: currentInventory,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    await heroRef.update(updates);

    console.log(`💰 ${userId} purchased ${quantity}x ${item.name} for ${totalCost}g`);

    res.json({ 
      success: true, 
      message: `Purchased ${quantity}x ${item.name}! Gold remaining: ${currentGold - totalCost}g`,
      newGold: currentGold - totalCost,
      quantity: quantity,
      itemsAdded: quantity
    });
  } catch (error) {
    console.error('Error purchasing gold item:', error);
    res.status(500).json({ error: 'Failed to purchase item' });
  }
});

// Purchase token shop gear
router.post('/:userId/purchase/tokens', async (req, res) => {
  try {
    const { rarity, slot, quantity } = req.body;
    const { userId } = req.params;
    
    // Default quantity to 1 if not provided
    const purchaseQuantity = quantity || 1;

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

    const costPerItem = TOKEN_SHOP_PRICES[rarity];
    const totalCost = costPerItem * purchaseQuantity;
    const heroRef = db.collection('heroes').doc(userId);
    const doc = await heroRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Hero not found' });
    }

    const hero = doc.data();
    const currentTokens = hero.tokens || 0;

    if (currentTokens < totalCost) {
      return res.status(400).json({ 
        error: `Not enough tokens! Need ${totalCost}t (${purchaseQuantity}x ${costPerItem}t), have ${currentTokens}t` 
      });
    }
    
    // Check inventory space
    const currentInventory = hero.inventory || [];
    const consumableGroups = new Set();
    const professionGroups = new Set();
    let regularItemCount = 0;
    
    currentInventory.forEach(item => {
      if (item.professionItem) {
        const key = item.recipeKey || item.id;
        professionGroups.add(key);
      } else if (item.type === 'potion' || item.type === 'buff' || item.itemKey) {
        const key = item.itemKey || item.name || item.id;
        consumableGroups.add(key);
      } else {
        regularItemCount++;
      }
    });
    
    const currentSlotsUsed = professionGroups.size + consumableGroups.size + regularItemCount;
    const maxSlots = hero.bankSize || 50;
    
    // Each gear item takes 1 slot
    if (currentSlotsUsed + purchaseQuantity > maxSlots) {
      return res.status(400).json({ 
        error: `Inventory full! You have ${currentSlotsUsed}/${maxSlots} slots used. Cannot add ${purchaseQuantity} more items. Sell items or expand storage.` 
      });
    }

    // Generate gear based on hero level (same logic as Electron app)
    // Token shop mythic is weaker (3.5x) than raid/dungeon mythic (4.0x)
    const LOOT_RARITIES = {
      common: { statMultiplier: 1.0, color: '#9ca3af' },
      uncommon: { statMultiplier: 1.2, color: '#10b981' },
      rare: { statMultiplier: 1.5, color: '#3b82f6' },
      epic: { statMultiplier: 2.0, color: '#a855f7' },
      legendary: { statMultiplier: 3.0, color: '#eab308' },
      mythic: { statMultiplier: 3.5, color: '#ef4444' }, // Token shop mythic (weaker than raid/dungeon)
      artifact: { statMultiplier: 4.0, color: '#ef4444' }
    };

    const rarityData = LOOT_RARITIES[rarity];
    if (!rarityData) {
      return res.status(400).json({ error: `Invalid rarity: ${rarity}. Valid rarities: ${Object.keys(LOOT_RARITIES).join(', ')}` });
    }

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
    if (!template) {
      return res.status(400).json({ error: `Invalid slot: ${slot}` });
    }

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

    // Add items to inventory (multiple if quantity > 1)
    const itemsToAdd = [];
    for (let i = 0; i < purchaseQuantity; i++) {
      const itemCopy = {
        ...item,
        id: `${rarity}_${slot}_${Date.now()}_${i}` // Unique ID for each item
      };
      itemsToAdd.push(itemCopy);
      hero.inventory.push(itemCopy);
    }

    // Deduct tokens
    await heroRef.update({
      tokens: currentTokens - totalCost,
      inventory: hero.inventory,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`🎫 ${userId} purchased ${purchaseQuantity}x ${rarity} ${slot} for ${totalCost}t`);

    res.json({ 
      success: true, 
      message: `Purchased ${purchaseQuantity}x ${item.name}! Tokens remaining: ${currentTokens - totalCost}t`,
      items: itemsToAdd,
      quantity: purchaseQuantity,
      newTokens: currentTokens - totalCost
    });
  } catch (error) {
    console.error('Error purchasing token gear:', error);
    res.status(500).json({ error: 'Failed to purchase gear' });
  }
});

// Gold Sinks - Balanced, not gacha
// Upgrade equipment with custom stat selection (2 of 4 random stats)
router.post('/:userId/upgrade-item', async (req, res) => {
  try {
    const { userId } = req.params;
    const { itemId, selectedStats, upgradeLevel } = req.body; // upgradeLevel is optional - which level to upgrade/replace

    console.log(`[Upgrade] Received upgrade request: userId=${userId}, itemId=${itemId}, upgradeLevel=${upgradeLevel}, selectedStats:`, selectedStats);

    // Validate selectedStats (must be exactly 2)
    if (!selectedStats || !Array.isArray(selectedStats) || selectedStats.length !== 2) {
      return res.status(400).json({ error: 'Invalid request. Must select exactly 2 stats.' });
    }

    // Validate each stat
    for (const stat of selectedStats) {
      if (!stat.type || typeof stat.value !== 'number') {
        return res.status(400).json({ error: 'Invalid stat format. Each stat must have type and value.' });
      }
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

    // Check max upgrade level (max 2 upgrade levels)
    const currentLevel = item.upgradeLevel || 0;
    const maxLevel = 2;
    if (currentLevel >= maxLevel) {
      return res.status(400).json({ error: 'Item is already fully upgraded (max level +2)' });
    }

    // Calculate upgrade cost (matches frontend formula)
    const rarityMultipliers = {
      'common': 1.0,
      'uncommon': 1.5,
      'rare': 2.0,
      'epic': 3.0,
      'legendary': 5.0,
      'artifact': 10.0
    };

    const baseCost = 100;
    const rarityMultiplier = rarityMultipliers[item.rarity?.toLowerCase() || 'common'] || 1.0;
    const upgradeCost = Math.ceil(baseCost * rarityMultiplier * Math.pow(1.5, currentLevel));

    const currentGold = hero.gold || 0;
    if (currentGold < upgradeCost) {
      return res.status(400).json({ 
        error: `Not enough gold! Need ${upgradeCost}g, have ${currentGold}g` 
      });
    }

    // Prepare upgraded item with new upgrade stats
    // New stats REPLACE existing stats at that level (not stack)
    const newLevel = currentLevel + 1;
    const existingUpgradeStats = item.upgradeStats || [];
    
    // Replace stats at this level if they exist, otherwise add new level
    const newUpgradeEntry = {
      level: newLevel,
      selectedStats: selectedStats.map(stat => ({
        type: stat.type,
        value: stat.value
      }))
    };
    
    // Replace existing stats at this level, or add new
    const filteredUpgradeStats = existingUpgradeStats.filter((upgrade) => upgrade.level !== newLevel);
    const updatedUpgradeStats = [...filteredUpgradeStats, newUpgradeEntry];
    
    const upgradedItem = {
      ...item,
      upgradeLevel: newLevel,
      upgradeStats: updatedUpgradeStats
    };

    const updates = {
      gold: currentGold - upgradeCost,
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

    const statNames = selectedStats.map(s => `${s.value}% ${s.type}`).join(' & ');
    console.log(`⚡ ${userId} upgraded item ${itemId} to +${newLevel} with stats: ${statNames} (cost: ${upgradeCost}g)`);

    res.json({ 
      success: true, 
      message: `Item upgraded to +${newLevel}! Selected: ${statNames}. Gold remaining: ${currentGold - upgradeCost}g`,
      item: upgradedItem,
      newGold: currentGold - upgradeCost
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

    // userId could be hero document ID or twitchUserId - try document ID first
    let heroRef = db.collection('heroes').doc(userId);
    let doc = await heroRef.get();

    // If not found, try looking up by twitchUserId
    if (!doc.exists) {
      const heroesSnapshot = await db.collection('heroes')
        .where('twitchUserId', '==', userId)
        .limit(1)
        .get();
      
      if (!heroesSnapshot.empty) {
        heroRef = db.collection('heroes').doc(heroesSnapshot.docs[0].id);
        doc = heroesSnapshot.docs[0];
      }
    }

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

// Lock/unlock equipment item
router.post('/:userId/equipment/:slot/lock', async (req, res) => {
  try {
    const { userId, slot } = req.params;
    
    const heroRef = db.collection('heroes').doc(userId);
    const doc = await heroRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Hero not found' });
    }
    
    const hero = doc.data();
    const equipment = hero.equipment || {};
    const item = equipment[slot];
    
    if (!item) {
      return res.status(404).json({ error: `No item in ${slot} slot` });
    }
    
    // Update item to be locked
    const lockedItem = {
      ...item,
      locked: true
    };
    
    await heroRef.update({
      [`equipment.${slot}`]: lockedItem,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`🔒 ${userId} locked ${slot} item: ${item.name}`);
    
    res.json({
      success: true,
      message: `${item.name} locked`,
      item: lockedItem
    });
  } catch (error) {
    console.error('Error locking equipment:', error);
    res.status(500).json({ error: 'Failed to lock equipment' });
  }
});

router.post('/:userId/equipment/:slot/unlock', async (req, res) => {
  try {
    const { userId, slot } = req.params;
    
    const heroRef = db.collection('heroes').doc(userId);
    const doc = await heroRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Hero not found' });
    }
    
    const hero = doc.data();
    const equipment = hero.equipment || {};
    const item = equipment[slot];
    
    if (!item) {
      return res.status(404).json({ error: `No item in ${slot} slot` });
    }
    
    // Update item to be unlocked
    const unlockedItem = {
      ...item,
      locked: false
    };
    
    await heroRef.update({
      [`equipment.${slot}`]: unlockedItem,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`🔓 ${userId} unlocked ${slot} item: ${item.name}`);
    
    res.json({
      success: true,
      message: `${item.name} unlocked`,
      item: unlockedItem
    });
  } catch (error) {
    console.error('Error unlocking equipment:', error);
    res.status(500).json({ error: 'Failed to unlock equipment' });
  }
});

// Expand bank storage (add bank slots)
router.post('/:userId/expand-storage', async (req, res) => {
  try {
    const { userId } = req.params;
    const { slots = 15, currency = 'gold' } = req.body; // Default 15 slots, currency: 'gold' or 'tokens'

    // Validate slots (15 slots per expansion)
    if (slots !== 15) {
      return res.status(400).json({ error: 'Must expand by exactly 15 slots per purchase' });
    }

    // Validate currency
    if (currency !== 'gold' && currency !== 'tokens') {
      return res.status(400).json({ error: 'Currency must be "gold" or "tokens"' });
    }

    const heroRef = db.collection('heroes').doc(userId);
    const doc = await heroRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Hero not found' });
    }

    const hero = doc.data();
    
    // Calculate costs based on currency
    let totalCost;
    let currentAmount;
    let updateData = {};
    
    if (currency === 'gold') {
      // Gold cost: 50g per slot = 750g for 15 slots
      const costPerSlot = 50;
      totalCost = costPerSlot * slots; // 750g for 15 slots
      currentAmount = hero.gold || 0;
      
      if (currentAmount < totalCost) {
        return res.status(400).json({ 
          error: `Not enough gold! Need ${totalCost}g, have ${currentAmount}g` 
        });
      }
      
      updateData.gold = currentAmount - totalCost;
    } else {
      // Token cost: 50 tokens for 15 slots (more reasonable vs 750g)
      totalCost = 50; // Fixed cost for 15 slots
      currentAmount = hero.tokens || 0;
      
      if (currentAmount < totalCost) {
        return res.status(400).json({ 
          error: `Not enough tokens! Need ${totalCost}t, have ${currentAmount}t` 
        });
      }
      
      updateData.tokens = currentAmount - totalCost;
    }

    // Get current bank size (default 50 if not set)
    const currentBankSize = hero.bankSize || 50;
    const newBankSize = currentBankSize + slots;

    // Max bank size: 500 slots (reasonable cap)
    if (newBankSize > 500) {
      return res.status(400).json({ error: 'Maximum bank size is 500 slots' });
    }

    updateData.bankSize = newBankSize;
    updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();

    await heroRef.update(updateData);

    const currencySymbol = currency === 'gold' ? 'g' : 't';
    console.log(`📦 ${userId} expanded bank by ${slots} slots (${currentBankSize} -> ${newBankSize}) for ${totalCost}${currencySymbol}`);

    const remainingAmount = currency === 'gold' ? updateData.gold : updateData.tokens;
    const currencyName = currency === 'gold' ? 'Gold' : 'Tokens';

    res.json({ 
      success: true, 
      message: `Bank expanded to ${newBankSize} slots! ${currencyName} remaining: ${remainingAmount}${currencySymbol}`,
      newBankSize,
      [`new${currency.charAt(0).toUpperCase() + currency.slice(1)}`]: remainingAmount
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
 * Claim idle token rewards
 * POST /api/heroes/:heroId/claim-idle-rewards
 * heroId is the hero document ID (from hero.id in frontend)
 * This essentially triggers the !claim command for the hero
 */
router.post('/:heroId/claim-idle-rewards', async (req, res) => {
  try {
    const { heroId } = req.params;

    // Get hero by document ID (this is the hero.id from frontend)
    const heroRef = db.collection('heroes').doc(heroId);
    const doc = await heroRef.get();

    if (!doc.exists) {
      return res.status(404).json({ error: 'Hero not found. The hero ID provided does not exist.' });
    }

    // CRITICAL: Ensure we use doc.id as the ID, not any id field in the data
    // Spread data first, then override with the actual document ID
    const heroData = doc.data();
    const hero = { ...heroData, id: doc.id };
    
    // Verify the ID is correct
    if (hero.id !== doc.id) {
      console.error(`[Claim Rewards] ID mismatch! doc.id=${doc.id}, hero.id=${hero.id}`);
    }
    
    console.log(`[Claim Rewards] Claiming for hero document ${doc.id} (hero.id=${hero.id}, name=${hero.name || hero.username || 'Unknown'})`);
    
    // Import and use the claim command handler (same as !claim chat command)
    const { handleClaimCommand } = await import('../services/commandHandler.js');
    const result = await handleClaimCommand(hero, hero.name || hero.username || 'Player');

    if (result.success) {
      res.json(result);
    } else {
      res.status(400).json(result);
    }
  } catch (error) {
    console.error('Error claiming idle rewards:', error);
    res.status(500).json({ error: 'Failed to claim idle rewards', details: error.message });
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
