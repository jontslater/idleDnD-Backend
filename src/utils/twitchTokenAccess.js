import { getTwitchCredentials } from './twitchCredentialStore.js';
import { ensureFreshTokenForTwitchUser } from './twitchTokenRefresh.js';

/**
 * Resolve a streamer's Twitch OAuth tokens from encrypted store (never hero docs).
 */
export async function getTokensForTwitchUser(db, twitchUserId) {
  if (!twitchUserId) return null;
  const fresh = await ensureFreshTokenForTwitchUser(String(twitchUserId));
  if (fresh.success && fresh.accessToken) {
    return {
      accessToken: fresh.accessToken,
      refreshToken: fresh.refreshToken || null
    };
  }
  const creds = await getTwitchCredentials(db, String(twitchUserId));
  if (!creds?.accessToken) return null;
  return { accessToken: creds.accessToken, refreshToken: creds.refreshToken || null };
}

export async function getTokensForStreamerUsername(db, twitchUsername) {
  const normalized = String(twitchUsername || '').toLowerCase().trim();
  if (!normalized) return null;
  const snap = await db.collection('heroes').where('twitchUsername', '==', normalized).limit(1).get();
  if (snap.empty) return null;
  const hero = snap.docs[0].data();
  if (!hero?.twitchUserId) return null;
  return getTokensForTwitchUser(db, hero.twitchUserId);
}
