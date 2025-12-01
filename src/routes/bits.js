import express from 'express';
import admin from 'firebase-admin';
import jwt from 'jsonwebtoken';
import { db } from '../index.js';
import { generateGearItem, TANK_EQUIPMENT_SLOTS, EQUIPMENT_SLOTS, ROLE_CONFIG } from '../services/gearService.js';

const router = express.Router();

// Middleware to verify Twitch JWT token
const verifyTwitchToken = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    // In development, allow requests without auth
    if (process.env.NODE_ENV === 'development') {
      return next();
    }
    return res.status(401).json({ error: 'No authorization token provided' });
  }
  
  const token = authHeader.substring(7);
  const secret = process.env.TWITCH_EXTENSION_SECRET;
  
  if (!secret) {
    console.error('TWITCH_EXTENSION_SECRET not set in environment');
    return res.status(500).json({ error: 'Server configuration error' });
  }
  
  try {
    const decoded = jwt.verify(token, Buffer.from(secret, 'base64'));
    req.twitchUser = decoded;
    next();
  } catch (error) {
    console.error('Token verification failed:', error);
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// Process Bits purchase
router.post('/purchase', verifyTwitchToken, async (req, res) => {
  try {
    const { type, rarity, slot, item, bits, transactionId, userId, channelId } = req.body;
    
    // Validate required fields
    if (!transactionId || !userId || !bits) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Check if transaction already processed
    const existingTransaction = await db.collection('transactions')
      .where('transactionId', '==', transactionId)
      .limit(1)
      .get();
    
    if (!existingTransaction.empty) {
      return res.status(400).json({ error: 'Transaction already processed' });
    }
    
    // Find hero
    const heroSnapshot = await db.collection('heroes')
      .where('twitchUserId', '==', userId)
      .limit(1)
      .get();
    
    if (heroSnapshot.empty) {
      return res.status(404).json({ error: 'Hero not found. Use !join [class] in chat first!' });
    }
    
    const heroDoc = heroSnapshot.docs[0];
    const hero = heroDoc.data();
    
    // Assign hero to streamer's battlefield if channelId is provided
    // Format: twitch:channelId (channelId is the broadcaster's Twitch user ID)
    if (channelId && !hero.currentBattlefieldId) {
      const battlefieldId = `twitch:${channelId}`;
      await heroDoc.ref.update({
        currentBattlefieldId: battlefieldId,
        currentBattlefieldType: 'streamer',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`🎯 Assigned hero ${userId} to streamer battlefield: ${battlefieldId}`);
    } else if (channelId && hero.currentBattlefieldId !== `twitch:${channelId}`) {
      // Update battlefield if hero is in a different one
      const battlefieldId = `twitch:${channelId}`;
      await heroDoc.ref.update({
        currentBattlefieldId: battlefieldId,
        currentBattlefieldType: 'streamer',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`🎯 Updated hero ${userId} battlefield to: ${battlefieldId}`);
    }
    let message = '';
    
    // Process purchase based on type
    if (type === 'gear') {
      // Validate inputs
      if (!rarity || !slot) {
        return res.status(400).json({ error: 'Missing rarity or slot for gear purchase' });
      }
      
      // Validate role
      const heroRole = hero.role || 'berserker';
      if (!ROLE_CONFIG[heroRole]) {
        return res.status(400).json({ error: `Invalid hero role: ${heroRole}` });
      }
      
      // Validate slot for role
      const category = ROLE_CONFIG[heroRole].category;
      const availableSlots = category === 'tank' ? TANK_EQUIPMENT_SLOTS : EQUIPMENT_SLOTS;
      
      if (!availableSlots.includes(slot)) {
        return res.status(400).json({ 
          error: `Invalid slot ${slot} for ${heroRole}. ${category === 'tank' ? 'Tanks can use shield.' : 'Only tanks can use shield.'}` 
        });
      }
      
      // Generate gear item
      const heroLevel = hero.level || 1;
      let gearItem;
      try {
        gearItem = generateGearItem(heroRole, slot, rarity, heroLevel);
      } catch (error) {
        return res.status(400).json({ error: `Failed to generate gear: ${error.message}` });
      }
      
      // Check if slot is occupied
      const currentEquipment = hero.equipment || {};
      const currentItem = currentEquipment[slot];
      
      // Prepare update
      const updateData = {
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      };
      
      if (currentItem) {
        // Slot is occupied - add to inventory
        const inventory = Array.isArray(hero.inventory) ? [...hero.inventory] : [];
        inventory.push(gearItem);
        updateData.inventory = inventory;
        message = `Purchased ${rarity} ${slot} for ${bits} Bits! Added to inventory (slot occupied by ${currentItem.name || 'current item'}).`;
      } else {
        // Slot is empty - auto-equip
        updateData[`equipment.${slot}`] = gearItem;
        message = `Purchased and equipped ${rarity} ${slot} for ${bits} Bits!`;
      }
      
      // Update hero
      await heroDoc.ref.update(updateData);
    } else if (type === 'consumable') {
      switch (item) {
        case 'health_potion':
          await heroDoc.ref.update({
            'potions.health': admin.firestore.FieldValue.increment(1),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          message = `Purchased Health Potion for ${bits} Bits!`;
          break;
          
        case 'token_bundle':
          await heroDoc.ref.update({
            tokens: admin.firestore.FieldValue.increment(5),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          message = `Purchased 5 tokens for ${bits} Bits!`;
          break;
          
        case 'xp_boost':
          // Add buff to hero
          const buffExpiry = Date.now() + (30 * 60 * 1000); // 30 minutes
          await heroDoc.ref.update({
            [`activeBuffs.xpBonus`]: {
              value: 0.5,
              expiresAt: buffExpiry,
              name: 'XP Boost'
            },
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          });
          message = `Purchased XP Boost for ${bits} Bits! +50% XP for 30 minutes`;
          break;
          
        default:
          return res.status(400).json({ error: 'Unknown item' });
      }
    } else {
      return res.status(400).json({ error: 'Invalid purchase type' });
    }
    
    // Log transaction
    await db.collection('transactions').add({
      transactionId,
      userId,
      channelId,
      type,
      rarity,
      slot,
      item,
      bits,
      message,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    // Get updated hero
    const updatedHero = await heroDoc.ref.get();
    const updatedHeroData = { id: updatedHero.id, ...updatedHero.data() };
    
    // Include gear item in response if it was a gear purchase
    const response = {
      success: true,
      message,
      hero: updatedHeroData
    };
    
    if (type === 'gear') {
      response.item = gearItem;
      response.equipped = !currentItem;
    }
    
    res.json(response);
  } catch (error) {
    console.error('Error processing Bits purchase:', error);
    res.status(500).json({ error: 'Failed to process purchase' });
  }
});

export default router;
