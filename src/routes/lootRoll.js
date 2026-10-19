import express from 'express';
import { db } from '../index.js';
import { requireStreamerAccess } from '../middleware/auth.js';
import { rollIdleKillLoot } from '../services/idleKillLootService.js';

const router = express.Router();

/**
 * Canonical server idle loot roll.
 * POST /api/battlefields/:battlefieldId/loot/roll
 * Body: { kills: [{ heroId, enemyLevel, kind, contentType? }] }
 */
router.post('/:battlefieldId/loot/roll', requireStreamerAccess, async (req, res) => {
  try {
    const { battlefieldId } = req.params;
    const { kills } = req.body;
    if (!Array.isArray(kills) || kills.length === 0) {
      return res.status(400).json({ error: 'kills array is required' });
    }
    if (kills.length > 30) {
      return res.status(400).json({ error: 'Maximum 30 kills per request' });
    }

    const { createBatchLootContext } = await import('../services/idleKillLootService.js');
    const batchCtx = createBatchLootContext(kills);

    const drops = [];
    const errors = [];
    for (const kill of kills) {
      const result = await rollIdleKillLoot(db, battlefieldId, kill, batchCtx);
      if (!result.ok) {
        errors.push({ kill, error: result.error, status: result.status });
        if (result.status === 403 && result.code === 'BOSS_LOOT_SERVER_ONLY') {
          return res.status(403).json(result);
        }
        continue;
      }
      if (result.dropped && result.item) {
        drops.push({ heroId: result.heroId, item: result.item });
      }
    }

    res.json({ success: true, drops, errors });
  } catch (error) {
    console.error('[loot/roll]', error);
    res.status(500).json({ error: 'Failed to roll loot' });
  }
});

export default router;
