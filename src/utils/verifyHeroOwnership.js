import { db } from '../index.js';

/**
 * @param {string} heroId
 * @param {{ userId?: string, twitchUserId?: string }} authUser
 */
export async function verifyHeroOwnedByAuth(heroId, authUser) {
  if (!heroId) {
    return { ok: false, status: 400, error: 'heroId is required' };
  }
  if (heroId === authUser.userId || heroId === authUser.twitchUserId) {
    return { ok: true };
  }
  const doc = await db.collection('heroes').doc(heroId).get();
  if (!doc.exists) {
    return { ok: false, status: 404, error: 'Hero not found' };
  }
  const hero = doc.data();
  if (hero.twitchUserId && authUser.twitchUserId && hero.twitchUserId === authUser.twitchUserId) {
    return { ok: true, hero };
  }
  return { ok: false, status: 403, error: 'Forbidden: hero does not belong to you' };
}
