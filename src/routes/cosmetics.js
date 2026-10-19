import express from 'express';
import { db } from '../index.js';
import { requireAuth, requireOwnership } from '../middleware/auth.js';
import {
  getPublicCatalog,
  getOwnedCosmeticIds,
  purchaseCosmetic,
  equipCosmetic
} from '../services/cosmeticsService.js';

const router = express.Router();

router.get('/', (_req, res) => {
  res.json({ catalog: getPublicCatalog() });
});

router.get('/owned', requireAuth, async (req, res) => {
  try {
    const twitchUserId = req.user.twitchUserId;
    const owned = await getOwnedCosmeticIds(db, twitchUserId);
    res.json({ ownedCosmetics: owned });
  } catch (error) {
    console.error('[Cosmetics] owned:', error);
    res.status(500).json({ error: 'Failed to load owned cosmetics' });
  }
});

router.post('/purchase', requireAuth, async (req, res) => {
  try {
    const { cosmeticId, heroId } = req.body;
    if (!cosmeticId) {
      return res.status(400).json({ error: 'cosmeticId is required' });
    }
    const heroDocId = heroId || req.user.userId;
    if (!heroDocId) {
      return res.status(400).json({ error: 'heroId is required when JWT has no hero id' });
    }
    const result = await purchaseCosmetic(db, {
      twitchUserId: req.user.twitchUserId,
      heroDocId,
      cosmeticId
    });
    res.json({ success: true, ...result });
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) console.error('[Cosmetics] purchase:', error);
    res.status(status).json({ error: error.message || 'Purchase failed' });
  }
});

router.post('/:userId/equip', requireAuth, requireOwnership, async (req, res) => {
  try {
    const { slot, cosmeticId } = req.body;
    const result = await equipCosmetic(db, {
      heroDocId: req.params.userId,
      twitchUserId: req.user.twitchUserId,
      slot,
      cosmeticId
    });
    res.json({ success: true, ...result });
  } catch (error) {
    const status = error.status || 500;
    if (status >= 500) console.error('[Cosmetics] equip:', error);
    res.status(status).json({ error: error.message || 'Equip failed' });
  }
});

export default router;
