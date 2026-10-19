import { db } from '../index.js';
import { getTwitchCredentials } from './twitchCredentialStore.js';
import { ensureFreshTokenForTwitchUser } from './twitchTokenRefresh.js';

/**
 * Resolve a streamer's Twitch OAuth tokens (encrypted store, with refresh).
 * @param {string} twitchUserId
 */
export async function getStreamerTokensByTwitchUserId(twitchUserId) {
  if (!twitchUserId) return null;
  const fresh = await ensureFreshTokenForTwitchUser(twitchUserId);
  if (fresh.success && fresh.accessToken) {
    return { accessToken: fresh.accessToken, refreshToken: fresh.refreshToken };
  }
  return null;
}

/**
 * Lookup streamer tokens by Twitch login (uses heroes collection for id mapping only).
 */
export async function getStreamerTokensByUsername(streamerUsername) {
  const normalized = String(streamerUsername || '').toLowerCase();
  const snap = await db
    .collection('heroes')
    .where('twitchUsername', '==', normalized)
    .limit(1)
    .get();
  if (snap.empty) return null;
  const hero = snap.docs[0].data();
  if (!hero.twitchUserId) return null;
  return getStreamerTokensByTwitchUserId(hero.twitchUserId);
}
