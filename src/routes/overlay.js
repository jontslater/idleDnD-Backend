/**
 * Overlay Sync Routes
 * Handle browser source overlay synchronization with idempotent updates
 */

import express from 'express';
import { db } from '../index.js';
import admin from 'firebase-admin';
import { requireStreamerAccess } from '../middleware/auth.js';
import { maxXpGainPerMinute, maxGoldGainPerMinute } from '../data/balance.js';

const router = express.Router();

const overlayBatchWindows = new Map();
const OVERLAY_BATCH_WINDOW_MS = 60_000;
const OVERLAY_MAX_BATCHES_PER_WINDOW = 40;

function checkOverlayBatchRateLimit(streamerId) {
  const now = Date.now();
  let entry = overlayBatchWindows.get(streamerId);
  if (!entry || now - entry.windowStart > OVERLAY_BATCH_WINDOW_MS) {
    entry = { windowStart: now, count: 0 };
    overlayBatchWindows.set(streamerId, entry);
  }
  entry.count += 1;
  if (entry.count > OVERLAY_MAX_BATCHES_PER_WINDOW) {
    return { allowed: false, retryAfterMs: OVERLAY_BATCH_WINDOW_MS - (now - entry.windowStart) };
  }
  return { allowed: true };
}

/**
 * Sync overlay pending deltas (idempotent with batch ID)
 * POST /api/overlay/sync
 * FE #3 requirement 6: Accept acknowledged pending deltas with client-supplied batch ID
 * Ensures retries don't double-apply XP/gold by tracking processed batch IDs
 * 
 * Requires: X-Streamer-Key header or authenticated streamer
 * Validates: All heroes must be on the streamer's battlefield
 * Clamps: XP/gold per hero to prevent exploits
 * 
 * Body: {
 *   streamerId: string,
 *   batchId: string,  // Client-generated UUID for this batch
 *   deltas: [{
 *     heroId: string,
 *     xpGained: number,
 *     goldGained: number,
 *     timestamp: number
 *   }]
 * }
 */
router.post('/sync', requireStreamerAccess, async (req, res) => {
  try {
    const { streamerId, batchId, deltas, kills } = req.body;
    
    if (!streamerId) {
      return res.status(400).json({ error: 'streamerId is required' });
    }
    
    if (!batchId) {
      return res.status(400).json({ error: 'batchId is required (client-generated UUID)' });
    }
    
    if (!Array.isArray(deltas) || deltas.length === 0) {
      return res.status(400).json({ error: 'deltas array is required' });
    }

    const batchRate = checkOverlayBatchRateLimit(String(streamerId));
    if (!batchRate.allowed) {
      return res.status(429).json({
        error: 'Too many overlay sync batches',
        retryAfterMs: batchRate.retryAfterMs
      });
    }

    const dedupedByHero = new Map();
    for (const delta of deltas) {
      if (!delta?.heroId) continue;
      const prev = dedupedByHero.get(delta.heroId) || { heroId: delta.heroId, xpGained: 0, goldGained: 0 };
      prev.xpGained += Number(delta.xpGained) || 0;
      prev.goldGained += Number(delta.goldGained) || 0;
      dedupedByHero.set(delta.heroId, prev);
    }
    const normalizedDeltas = [...dedupedByHero.values()];
    
    // Check if this batch has already been processed (idempotency check)
    const batchRef = db.collection('overlayBatches').doc(batchId);
    const batchDoc = await batchRef.get();
    
    if (batchDoc.exists) {
      // Batch already processed - return success without re-applying
      const batchData = batchDoc.data();
      console.log(`[Overlay Sync] Batch ${batchId} already processed at ${new Date(batchData.processedAt).toISOString()}, skipping`);
      return res.json({
        success: true,
        alreadyProcessed: true,
        processedAt: batchData.processedAt,
        deltasApplied: 0,
        message: 'Batch already processed (idempotent)'
      });
    }
    
    // Battlefield ID for this streamer
    const battlefieldId = `twitch:${streamerId}`;
    
    // Process each delta
    const results = [];
    let successCount = 0;
    let errorCount = 0;
    
    for (const delta of normalizedDeltas) {
      try {
        const { heroId, xpGained = 0, goldGained = 0 } = delta;
        
        if (!heroId) {
          errorCount++;
          results.push({ heroId: 'unknown', success: false, error: 'Missing heroId' });
          continue;
        }
        
        let validXp = Math.max(0, Math.floor(Number(xpGained) || 0));
        let validGold = Math.max(0, Math.floor(Number(goldGained) || 0));

        const heroRef = db.collection('heroes').doc(heroId);
        const heroDoc = await heroRef.get();

        if (!heroDoc.exists) {
          errorCount++;
          results.push({ heroId, success: false, error: 'Hero not found' });
          continue;
        }

        const hero = heroDoc.data();
        const heroLevel = hero.level || 1;
        const maxXpBatch = maxXpGainPerMinute(heroLevel);
        const maxGoldBatch = maxGoldGainPerMinute(heroLevel);

        const xpClamped = validXp > maxXpBatch;
        const goldClamped = validGold > maxGoldBatch;
        validXp = Math.min(validXp, maxXpBatch);
        validGold = Math.min(validGold, maxGoldBatch);

        if (xpClamped || goldClamped) {
          console.warn(`[Overlay Sync] Clamped gains for hero ${heroId}: XP ${xpGained}->${validXp}, Gold ${goldGained}->${validGold}`);
        }

        if (validXp === 0 && validGold === 0) {
          continue;
        }

        // Verify hero is on this streamer's battlefield
        if (hero.currentBattlefieldId !== battlefieldId) {
          errorCount++;
          results.push({
            heroId,
            success: false,
            error: `Hero not on battlefield ${battlefieldId} (current: ${hero.currentBattlefieldId || 'none'})`
          });
          continue;
        }
        
        // Apply deltas with level-up handling
        const newXp = (hero.xp || 0) + validXp;
        const newGold = (hero.gold || 0) + validGold;
        
        // Handle level-ups (multiple level-ups if XP is high enough)
        const { processLevelUps } = await import('../utils/levelUpHelper.js');
        const levelUpResult = processLevelUps(hero, newXp);
        
        const updateData = {
          gold: newGold,
          xp: levelUpResult.updates.xp,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        
        if (levelUpResult.leveledUp) {
          Object.assign(updateData, levelUpResult.updates);
        }
        
        await heroRef.update(updateData);
        
        successCount++;
        results.push({
          heroId,
          success: true,
          xpApplied: validXp,
          goldApplied: validGold,
          leveledUp: levelUpResult.leveledUp,
          newLevel: levelUpResult.leveledUp ? levelUpResult.newLevel : null
        });
        
      } catch (deltaError) {
        console.error(`[Overlay Sync] Error processing delta for hero ${delta.heroId}:`, deltaError);
        errorCount++;
        results.push({
          heroId: delta.heroId,
          success: false,
          error: deltaError.message || 'Unknown error'
        });
      }
    }
    
    const drops = [];
    if (Array.isArray(kills) && kills.length > 0) {
      const { rollLootForKill } = await import('../services/lootRollService.js');
      const maxKills = Math.min(kills.length, 30);
      for (let i = 0; i < maxKills; i++) {
        const kill = kills[i];
        const heroId = kill.heroId;
        if (!heroId) continue;
        const heroRef = db.collection('heroes').doc(heroId);
        const heroDoc = await heroRef.get();
        if (!heroDoc.exists) continue;
        const hero = { id: heroDoc.id, ...heroDoc.data() };
        if (hero.currentBattlefieldId !== battlefieldId) continue;
        const roll = rollLootForKill(hero, kill, {
          lootPity: hero.lootPity || {},
          setCollection: hero.setCollection || {}
        });
        if (!roll.dropped || !roll.item) continue;
        const inventory = Array.isArray(hero.inventory) ? [...hero.inventory] : [];
        inventory.push(roll.item);
        await heroRef.update({
          inventory,
          lootPity: roll.pity,
          setCollection: roll.setCollection,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        drops.push({ heroId, item: roll.item });
      }
    }

    // Mark batch as processed (prevents double-application on retry)
    await batchRef.set({
      streamerId,
      batchId,
      processedAt: Date.now(),
      deltasProcessed: successCount,
      deltasFailed: errorCount,
      dropsGranted: drops.length,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`[Overlay Sync] Batch ${batchId} processed: ${successCount} success, ${errorCount} errors`);
    
    res.json({
      success: true,
      alreadyProcessed: false,
      deltasApplied: successCount,
      deltasFailed: errorCount,
      results: results,
      drops
    });
    
  } catch (error) {
    console.error('[Overlay Sync] Error processing sync:', error);
    res.status(500).json({ error: 'Failed to sync overlay deltas', details: error.message });
  }
});

/**
 * Get sync status for a batch ID
 * GET /api/overlay/sync/:batchId
 */
router.get('/sync/:batchId', requireStreamerAccess, async (req, res) => {
  try {
    const { batchId } = req.params;
    
    const batchDoc = await db.collection('overlayBatches').doc(batchId).get();
    
    if (!batchDoc.exists) {
      return res.json({
        processed: false,
        message: 'Batch not yet processed or does not exist'
      });
    }
    
    const batchData = batchDoc.data();
    
    res.json({
      processed: true,
      batchId,
      streamerId: batchData.streamerId,
      processedAt: batchData.processedAt,
      deltasProcessed: batchData.deltasProcessed,
      deltasFailed: batchData.deltasFailed
    });
  } catch (error) {
    console.error('[Overlay Sync] Error checking batch status:', error);
    res.status(500).json({ error: 'Failed to check batch status', details: error.message });
  }
});

export default router;
