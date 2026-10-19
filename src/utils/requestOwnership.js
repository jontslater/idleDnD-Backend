import { db } from '../index.js';

/**
 * @returns {boolean} true if JWT identity may act as this hero document id
 */
export function jwtOwnsHeroId(req, heroDocId) {
  if (!req.user || !heroDocId) return false;
  const { userId, twitchUserId } = req.user;
  return heroDocId === userId || heroDocId === twitchUserId;
}

/**
 * @returns {boolean} true if JWT matches twitch user id string
 */
export function jwtOwnsTwitchUserId(req, twitchUserId) {
  if (!req.user || twitchUserId == null) return false;
  return String(req.user.twitchUserId) === String(twitchUserId);
}

/**
 * Verify hero doc belongs to authenticated JWT user.
 * @returns {Promise<boolean>}
 */
export async function jwtOwnsHeroDocument(req, heroDocId) {
  if (jwtOwnsHeroId(req, heroDocId)) return true;
  if (!req.user?.twitchUserId) return false;
  const doc = await db.collection('heroes').doc(heroDocId).get();
  if (!doc.exists) return false;
  return doc.data().twitchUserId === req.user.twitchUserId;
}

/**
 * Send 403 unless body userId/senderId matches JWT. Returns false if response sent.
 */
export async function requireJwtActor(req, res, actorId, { heroDoc = true } = {}) {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return false;
  }
  const ok = heroDoc ? await jwtOwnsHeroDocument(req, actorId) : jwtOwnsTwitchUserId(req, actorId);
  if (!ok) {
    res.status(403).json({ error: 'Forbidden: identity does not match authenticated user' });
    return false;
  }
  return true;
}
