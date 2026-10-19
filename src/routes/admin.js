import express from 'express';
import { db } from '../index.js';
import { requireAdmin } from '../middleware/auth.js';

const router = express.Router();

router.get('/heroes', requireAdmin, async (req, res) => {
  try {
    const snapshot = await db.collection('heroes').get();
    const heroes = snapshot.docs.map((doc) => {
      const data = { ...doc.data(), id: doc.id };
      delete data.twitchAccessToken;
      delete data.twitchRefreshToken;
      delete data.twitchTokenExpiresAt;
      return data;
    });
    res.json({ heroes, count: heroes.length });
  } catch (error) {
    console.error('[Admin] list heroes:', error);
    res.status(500).json({ error: 'Failed to list heroes' });
  }
});

export default router;
