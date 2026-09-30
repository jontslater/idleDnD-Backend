/**
 * Overlay Sync Routes
 * Handle browser source overlay synchronization with idempotent updates
 */

import express from 'express';
import { db } from '../index.js';
import admin from 'firebase-admin';
import { requireStreamerAccess } from '../middleware/auth.js';

const router = express.Router();

// Maximum gains per batch per hero to prevent exploits
const MAX_XP_PER_BATCH = 10000;
const MAX_GOLD_PER_BATCH = 5000;

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
    const { streamerId, batchId, deltas } = req.body;
    
    if (!streamerId) {
      return res.status(400).json({ error: 'streamerId is required' });
    }
    
    if (!batchId) {
      return res.status(400).json({ error: 'batchId is required (client-generated UUID)' });
    }
    
    if (!Array.isArray(deltas) || deltas.length === 0) {
      return res.status(400).json({ error: 'deltas array is required' });
    }
    
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
    
    for (const delta of deltas) {
      try {
        const { heroId, xpGained = 0, goldGained = 0 } = delta;
        
        if (!heroId) {
          errorCount++;
          results.push({ heroId: 'unknown', success: false, error: 'Missing heroId' });
          continue;
        }
        
        // Validate gains are positive numbers and clamp to max per batch
        let validXp = Math.max(0, Math.floor(Number(xpGained) || 0));
        let validGold = Math.max(0, Math.floor(Number(goldGained) || 0));
        
        // Clamp to prevent exploits
        const xpClamped = validXp > MAX_XP_PER_BATCH;
        const goldClamped = validGold > MAX_GOLD_PER_BATCH;
        
        validXp = Math.min(validXp, MAX_XP_PER_BATCH);
        validGold = Math.min(validGold, MAX_GOLD_PER_BATCH);
        
        if (xpClamped || goldClamped) {
          console.warn(`[Overlay Sync] Clamped gains for hero ${heroId}: XP ${xpGained}->${validXp}, Gold ${goldGained}->${validGold}`);
        }
        
        if (validXp === 0 && validGold === 0) {
          // Skip no-op deltas
          continue;
        }
        
        // Get hero document
        const heroRef = db.collection('heroes').doc(heroId);
        const heroDoc = await heroRef.get();
        
        if (!heroDoc.exists) {
          errorCount++;
          results.push({ heroId, success: false, error: 'Hero not found' });
          continue;
        }
        
        const hero = heroDoc.data();
        
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
    
    // Mark batch as processed (prevents double-application on retry)
    await batchRef.set({
      streamerId,
      batchId,
      processedAt: Date.now(),
      deltasProcessed: successCount,
      deltasFailed: errorCount,
      timestamp: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log(`[Overlay Sync] Batch ${batchId} processed: ${successCount} success, ${errorCount} errors`);
    
    res.json({
      success: true,
      alreadyProcessed: false,
      deltasApplied: successCount,
      deltasFailed: errorCount,
      results: results
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
