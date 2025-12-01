/**
 * Loot Token Routes
 * Handles loot token system for raid/dungeon rewards
 */

import express from 'express';
import admin from 'firebase-admin';
import { db } from '../index.js';

const router = express.Router();

// Loot token rewards per raid difficulty
const LOOT_TOKEN_REWARDS = {
  normal: 5,
  heroic: 10,
  mythic: 20
};

/**
 * GET /api/loot-tokens/:userId
 * Get user's loot token balance
 */
router.get('/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const userData = userDoc.data();
    const tokens = userData.lootTokens || 0;

    res.json({
      userId,
      lootTokens: tokens,
      lastUpdated: userData.lootTokensLastUpdated || null
    });
  } catch (error) {
    console.error('[LootTokens] Error getting token balance:', error);
    res.status(500).json({ error: 'Failed to get loot token balance' });
  }
});

/**
 * POST /api/loot-tokens/award
 * Award loot tokens to a user (called after raid/dungeon completion)
 */
router.post('/award', async (req, res) => {
  try {
    const { userId, raidId, difficulty, amount } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    // Calculate token amount
    let tokenAmount = amount;
    if (!tokenAmount && raidId && difficulty) {
      tokenAmount = LOOT_TOKEN_REWARDS[difficulty] || LOOT_TOKEN_REWARDS.normal;
    }
    if (!tokenAmount) {
      tokenAmount = LOOT_TOKEN_REWARDS.normal;
    }

    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const currentTokens = userDoc.data().lootTokens || 0;
    const newBalance = currentTokens + tokenAmount;

    await userRef.update({
      lootTokens: newBalance,
      lootTokensLastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Log token award
    await db.collection('lootTokenHistory').add({
      userId,
      raidId: raidId || null,
      difficulty: difficulty || null,
      amount: tokenAmount,
      previousBalance: currentTokens,
      newBalance: newBalance,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({
      success: true,
      userId,
      amountAwarded: tokenAmount,
      previousBalance: currentTokens,
      newBalance: newBalance
    });
  } catch (error) {
    console.error('[LootTokens] Error awarding tokens:', error);
    res.status(500).json({ error: 'Failed to award loot tokens' });
  }
});

/**
 * POST /api/loot-tokens/spend
 * Spend loot tokens (for purchasing items)
 */
router.post('/spend', async (req, res) => {
  try {
    const { userId, amount, itemId, itemName } = req.body;

    if (!userId || !amount || amount <= 0) {
      return res.status(400).json({ error: 'userId and positive amount are required' });
    }

    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
      return res.status(404).json({ error: 'User not found' });
    }

    const currentTokens = userDoc.data().lootTokens || 0;

    if (currentTokens < amount) {
      return res.status(400).json({
        error: 'Insufficient loot tokens',
        currentBalance: currentTokens,
        required: amount
      });
    }

    const newBalance = currentTokens - amount;

    await userRef.update({
      lootTokens: newBalance,
      lootTokensLastUpdated: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Log token spend
    await db.collection('lootTokenHistory').add({
      userId,
      amount: -amount,
      itemId: itemId || null,
      itemName: itemName || null,
      previousBalance: currentTokens,
      newBalance: newBalance,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });

    res.json({
      success: true,
      userId,
      amountSpent: amount,
      previousBalance: currentTokens,
      newBalance: newBalance
    });
  } catch (error) {
    console.error('[LootTokens] Error spending tokens:', error);
    res.status(500).json({ error: 'Failed to spend loot tokens' });
  }
});

/**
 * GET /api/loot-tokens/history/:userId
 * Get user's loot token transaction history
 */
router.get('/history/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = parseInt(req.query.limit) || 50;

    const historySnapshot = await db
      .collection('lootTokenHistory')
      .where('userId', '==', userId)
      .orderBy('timestamp', 'desc')
      .limit(limit)
      .get();

    const history = historySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
      timestamp: doc.data().timestamp?.toMillis() || null
    }));

    res.json({
      userId,
      history,
      count: history.length
    });
  } catch (error) {
    console.error('[LootTokens] Error getting token history:', error);
    res.status(500).json({ error: 'Failed to get loot token history' });
  }
});

export default router;
