import express from 'express';
import admin from 'firebase-admin';
import jwt from 'jsonwebtoken';
import { db } from '../index.js';

const router = express.Router();

const verifyTwitchToken = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    if (process.env.NODE_ENV === 'development' && process.env.BITS_ALLOW_DEV_BYPASS === '1') {
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

function verifiedBitsUserId(req) {
  const u = req.twitchUser;
  return u?.user_id || u?.userId || u?.opaque_user_id || null;
}

function verifiedBitsAmount(req) {
  const u = req.twitchUser;
  const fromJwt = u?.product?.cost?.amount ?? u?.bits ?? u?.amount;
  if (fromJwt != null && Number(fromJwt) > 0) {
    return Number(fromJwt);
  }
  return null;
}

router.post('/purchase', verifyTwitchToken, async (req, res) => {
  try {
    const { type, item, transactionId, channelId } = req.body;

    const userId = verifiedBitsUserId(req) || req.body.userId;
    const bits = verifiedBitsAmount(req);

    if (!transactionId || !userId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (type === 'gear') {
      return res.status(410).json({
        error: 'Bits gear is disabled. Use Bits for cosmetic effects only.',
        code: 'BITS_GEAR_DISABLED'
      });
    }

    if (!bits || bits <= 0) {
      return res.status(400).json({ error: 'Verified Bits amount missing from extension JWT' });
    }

    const existingTransaction = await db.collection('transactions')
      .where('transactionId', '==', transactionId)
      .limit(1)
      .get();

    if (!existingTransaction.empty) {
      return res.status(400).json({ error: 'Transaction already processed' });
    }

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

    if (type === 'consumable' && item === 'health_potion') {
      await heroDoc.ref.update({
        'potions.health': admin.firestore.FieldValue.increment(1),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      message = `Unlocked Health Potion with ${bits} Bits!`;
    } else if (type === 'cosmetic') {
      return res.status(501).json({
        error: 'Bits cosmetic unlocks are not configured yet',
        code: 'BITS_COSMETIC_PENDING'
      });
    } else {
      return res.status(400).json({ error: 'Invalid unlock type' });
    }

    if (channelId && hero.currentBattlefieldId !== `twitch:${channelId}`) {
      await heroDoc.ref.update({
        currentBattlefieldId: `twitch:${channelId}`,
        currentBattlefieldType: 'streamer',
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }

    await db.collection('transactions').add({
      transactionId,
      userId,
      channelId,
      type,
      item,
      bits,
      message,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    const updatedHero = await heroDoc.ref.get();
    res.json({
      success: true,
      message,
      hero: { id: updatedHero.id, ...updatedHero.data() }
    });
  } catch (error) {
    console.error('Error processing Bits purchase:', error);
    res.status(500).json({ error: 'Failed to process Bits unlock' });
  }
});

export default router;
