import express from 'express';
import admin from 'firebase-admin';
import jwt from 'jsonwebtoken';
import { db } from '../index.js';

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
    let message = '';
    
    // Process purchase based on type
    if (type === 'gear') {
      // For now, just add tokens equivalent to the purchase
      // The actual gear generation happens in the Electron app
      const tokensToAdd = Math.floor(bits / 50); // 50 bits = 1 token equivalent
      
      await heroDoc.ref.update({
        tokens: admin.firestore.FieldValue.increment(tokensToAdd),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      
      message = `Purchased ${rarity} ${slot} for ${bits} Bits! Added ${tokensToAdd} tokens to your balance.`;
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
    
    res.json({
      success: true,
      message,
      hero: { id: updatedHero.id, ...updatedHero.data() }
    });
  } catch (error) {
    console.error('Error processing Bits purchase:', error);
    res.status(500).json({ error: 'Failed to process purchase' });
  }
});

export default router;
