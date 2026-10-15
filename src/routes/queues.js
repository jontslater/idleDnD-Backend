import express from 'express';
import { db } from '../index.js';
import { requireAuth } from '../middleware/auth.js';
import { requireAuthOrStreamerKey } from '../middleware/requireAuthOrStreamerKey.js';
import {
  createQueue,
  getOpenQueueForStreamer,
  joinQueue,
  leaveQueue
} from '../services/queueService.js';
import { listKnownDungeonQueueKeys, listKnownRaidQueueKeys } from '../data/queueKeyMapping.js';

const router = express.Router();

function serializeQueue(queue) {
  if (!queue) return null;
  const launchAt = queue.launchAt?.toMillis?.() ?? queue.launchAt ?? null;
  const expiresAt = queue.expiresAt?.toMillis?.() ?? queue.expiresAt ?? null;
  return {
    ...queue,
    launchAt,
    expiresAt
  };
}

router.get('/keys/dungeons', (_req, res) => {
  res.json({ keys: listKnownDungeonQueueKeys() });
});

router.get('/keys/raids', (_req, res) => {
  res.json({ keys: listKnownRaidQueueKeys() });
});

/**
 * GET /api/queues/:twitchId — open battlefield queue for streamer
 */
router.get('/:twitchId', async (req, res) => {
  try {
    const { twitchId } = req.params;
    const queue = await getOpenQueueForStreamer(twitchId);
    if (!queue) {
      return res.json({ queue: null });
    }
    res.json({ queue: serializeQueue(queue) });
  } catch (error) {
    console.error('[GET /api/queues/:twitchId]', error);
    res.status(500).json({ error: 'Failed to fetch queue' });
  }
});

/**
 * POST /api/queues — streamer creates queue (JWT or overlay key)
 * Body: { type: 'dungeon'|'raid', queueKey: string, twitchId?: string }
 */
router.post('/', requireAuthOrStreamerKey, async (req, res) => {
  try {
    const { type, queueKey } = req.body;
    if (!type || !queueKey) {
      return res.status(400).json({ error: 'type and queueKey are required' });
    }
    if (type !== 'dungeon' && type !== 'raid') {
      return res.status(400).json({ error: 'type must be dungeon or raid' });
    }

    let twitchId;
    let streamerName;
    if (req.authType === 'streamer-key') {
      twitchId = req.streamer.twitchId;
      streamerName = req.streamer.twitchUsername;
    } else {
      twitchId = req.body.twitchId || req.user?.twitchUserId;
      streamerName = req.user?.twitchUsername || twitchId;
      if (!twitchId) {
        return res.status(400).json({ error: 'twitchId required for JWT create' });
      }
      // Broadcaster-only for now — MOD_HOOK: allow mods when role data is available on req.user
      if (String(twitchId) !== String(req.user?.twitchUserId)) {
        return res.status(403).json({ error: 'Only the streamer can create a queue for this channel' });
      }
    }

    const battlefieldId = `twitch:${twitchId}`;
    const result = await createQueue(battlefieldId, twitchId, streamerName, type, queueKey);
    if (!result.success) {
      return res.status(400).json({ error: result.message, existingQueue: result.existingQueue });
    }
    res.status(201).json({
      success: true,
      queue: serializeQueue(result.queue),
      message: result.message
    });
  } catch (error) {
    console.error('[POST /api/queues]', error);
    res.status(500).json({ error: 'Failed to create queue' });
  }
});

/**
 * POST /api/queues/:queueId/join
 * queueId = battlefieldQueues document id (twitch:{streamerTwitchId})
 */
router.post('/:queueId/join', requireAuth, async (req, res) => {
  try {
    const { queueId } = req.params;
    const { heroId, userId } = req.body;
    const authUserId = req.user?.userId;
    const twitchUserId = req.user?.twitchUserId;

    if (!heroId) {
      return res.status(400).json({ error: 'heroId is required' });
    }

    const heroDoc = await db.collection('heroes').doc(heroId).get();
    if (!heroDoc.exists) {
      return res.status(404).json({ error: 'Hero not found' });
    }
    const hero = { id: heroDoc.id, ...heroDoc.data() };

    const ownerId = hero.twitchUserId || heroDoc.id;
    if (String(ownerId) !== String(twitchUserId) && String(heroDoc.id) !== String(authUserId)) {
      return res.status(403).json({ error: 'Hero ownership mismatch' });
    }

    const queueDoc = await db.collection('battlefieldQueues').doc(queueId).get();
    if (!queueDoc.exists) {
      return res.status(404).json({ error: 'Queue not found' });
    }
    const queue = queueDoc.data();

    const result = await joinQueue(
      queue.code,
      hero,
      hero.name || twitchUserId,
      twitchUserId || userId || ownerId,
      { expectedBattlefieldId: queue.battlefieldId }
    );

    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    res.json({
      success: true,
      queue: serializeQueue(result.queue),
      message: result.message,
      isReady: result.isReady
    });
  } catch (error) {
    console.error('[POST /api/queues/:queueId/join]', error);
    res.status(500).json({ error: 'Failed to join queue' });
  }
});

/**
 * POST /api/queues/:queueId/leave
 */
router.post('/:queueId/leave', requireAuth, async (req, res) => {
  try {
    const twitchUserId = req.user?.twitchUserId;
    if (!twitchUserId) {
      return res.status(400).json({ error: 'Missing twitch user id' });
    }

    const result = await leaveQueue(twitchUserId, req.user?.twitchUsername || twitchUserId);
    if (!result.success) {
      return res.status(400).json({ error: result.message });
    }

    res.json({
      success: true,
      queue: serializeQueue(result.queue),
      message: result.message
    });
  } catch (error) {
    console.error('[POST /api/queues/:queueId/leave]', error);
    res.status(500).json({ error: 'Failed to leave queue' });
  }
});

export default router;
