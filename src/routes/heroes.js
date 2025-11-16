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

// Create new hero with class selection
router.post('/create', async (req, res) => {
  try {
    const { class: classKey, twitchUserId, tiktokUserId } = req.body;

    if (!classKey || !ROLE_CONFIG[classKey]) {
      return res.status(400).json({ error: 'Invalid class' });
    }

    if (!twitchUserId && !tiktokUserId) {
      return res.status(400).json({ error: 'Twitch or TikTok user ID required' });
    }

    // Check if hero already exists (check both Twitch and TikTok)
    let existingHero = null;
    
    if (twitchUserId) {
      const twitchCheck = await db.collection('heroes')
        .where('twitchUserId', '==', twitchUserId)
        .limit(1)
        .get();
      
      if (!twitchCheck.empty) {
        existingHero = twitchCheck;
      }
    }
    
    if (!existingHero && tiktokUserId) {
      const tiktokCheck = await db.collection('heroes')
        .where('tiktokUserId', '==', tiktokUserId)
        .limit(1)
        .get();
      
      if (!tiktokCheck.empty) {
        existingHero = tiktokCheck;
      }
    }

    if (existingHero && !existingHero.empty) {
      return res.status(400).json({ error: 'Hero already exists for this user' });
    }

    const config = ROLE_CONFIG[classKey];
    const heroData = {
      name: req.body.name || 'Hero',
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
      joinedAt: Date.now(),
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
    const heroRef = db.collection('heroes').doc(req.params.userId);
    const doc = await heroRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Hero not found' });
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

// Delete hero
router.delete('/:userId', async (req, res) => {
  try {
    const heroRef = db.collection('heroes').doc(req.params.userId);
    const doc = await heroRef.get();
    
    if (!doc.exists) {
      return res.status(404).json({ error: 'Hero not found' });
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
      healthpotion: { name: 'Health Potion', cost: 50, type: 'potion' },
      xpboost: { name: 'XP Boost Scroll', cost: 100, type: 'buff', duration: 300000 },
      attackbuff: { name: 'Sharpening Stone', cost: 150, type: 'buff', duration: 600000 },
      defensebuff: { name: 'Armor Polish', cost: 150, type: 'buff', duration: 600000 }
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
      common: 25,
      rare: 100,
      epic: 300,
      legendary: 1000
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

export default router;
