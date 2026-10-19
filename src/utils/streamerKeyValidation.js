import crypto from 'crypto';
import { resolveStreamerIdFromRequest } from './streamerAuth.js';

/**
 * Returns true when X-Streamer-Key matches streamerSettings for the resolved streamer.
 */
export async function isValidStreamerKeyRequest(req) {
  const streamerKey = req.headers['x-streamer-key'];
  if (!streamerKey) return false;
  const streamerId = resolveStreamerIdFromRequest(req);
  if (!streamerId) return false;
  try {
    const { db } = await import('../index.js');
    const settingsDoc = await db.collection('streamerSettings').doc(String(streamerId)).get();
    if (!settingsDoc.exists) return false;
    const storedKey = settingsDoc.data()?.overlayKey;
    if (!storedKey) return false;
    return crypto.timingSafeEqual(Buffer.from(streamerKey), Buffer.from(storedKey));
  } catch {
    return false;
  }
}
