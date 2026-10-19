import express from 'express';
import { buildBalanceJsonObject, getBalanceJsonPath, writeBalanceJson } from '../data/balance.js';
import { listCosmeticTokenCatalog } from '../utils/tokenCosmetics.js';

const router = express.Router();

router.get('/', (req, res) => {
  try {
    res.set('Cache-Control', 'public, max-age=300');
    res.json({
      ...buildBalanceJsonObject(),
      jsonExportPath: 'data/balance.json',
      jsonAbsoluteHint: getBalanceJsonPath(),
      tokenPolicy: {
        cosmeticOnly: true,
        premiumTokenGrants: 'tokens only (no gold on Stripe token packs)',
        allowedSpends: listCosmeticTokenCatalog(),
        blockedSpends: [
          'gear and weapons',
          'stat upgrades',
          'XP boosts',
          'loot boxes with gear',
          'inventory expansion',
          'hero slot unlocks',
          'auction house (token currency)',
          'skill respec costs (when priced in premium tokens)'
        ]
      }
    });
  } catch (err) {
    console.error('[balance] GET /api/balance', err);
    res.status(500).json({ error: 'Failed to load balance definitions' });
  }
});

export function ensureBalanceJsonExported() {
  try {
    writeBalanceJson();
  } catch (e) {
    console.warn('[balance] Failed to write balance.json:', e.message);
  }
}

export default router;
