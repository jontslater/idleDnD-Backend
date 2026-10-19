import { db } from '../index.js';

export const MAX_HEROES = 20;
export const DEFAULT_SLOTS_UNLOCKED = 3;

export async function getUserSlotsUnlocked(userId, isTwitch = true) {
  const userRef = db.collection('users').doc(userId);
  const userDoc = await userRef.get();
  if (!userDoc.exists) {
    return DEFAULT_SLOTS_UNLOCKED;
  }
  const userData = userDoc.data();
  return userData.slotsUnlocked || DEFAULT_SLOTS_UNLOCKED;
}

export async function fetchExistingHeroes({ twitchUserId, tiktokUserId }) {
  let existingHeroes = [];

  if (twitchUserId) {
    const snap = await db.collection('heroes').where('twitchUserId', '==', twitchUserId).get();
    existingHeroes = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  if (tiktokUserId && existingHeroes.length === 0) {
    const snap = await db.collection('heroes').where('tiktokUserId', '==', tiktokUserId).get();
    existingHeroes = snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
  }

  return existingHeroes;
}

/**
 * Same slot / cap checks as POST /api/heroes/create.
 * @returns {{ ok: true, existingHeroes, userId, isTwitch } | { ok: false, status: number, body: object }}
 */
export async function assertHeroCreationAllowed({ twitchUserId, tiktokUserId }) {
  if (!twitchUserId && !tiktokUserId) {
    return { ok: false, status: 400, body: { error: 'Twitch or TikTok user ID required' } };
  }

  const userId = twitchUserId || tiktokUserId;
  const isTwitch = !!twitchUserId;
  const existingHeroes = await fetchExistingHeroes({ twitchUserId, tiktokUserId });
  const heroCount = existingHeroes.length;

  if (heroCount >= MAX_HEROES) {
    return {
      ok: false,
      status: 400,
      body: {
        error: `Maximum hero limit reached (${MAX_HEROES} heroes)`,
        heroCount,
        maxHeroes: MAX_HEROES
      }
    };
  }

  const slotsUnlocked = await getUserSlotsUnlocked(userId, isTwitch);
  if (heroCount >= slotsUnlocked) {
    return {
      ok: false,
      status: 400,
      body: {
        error: `Hero slot limit reached. Unlock slot ${heroCount + 1} to create more heroes.`,
        heroCount,
        slotsUnlocked,
        maxHeroes: MAX_HEROES
      }
    };
  }

  return { ok: true, existingHeroes, userId, isTwitch, heroCount };
}
