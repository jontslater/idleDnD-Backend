/**
 * Resolve a Twitch channel login for chat announcements (not numeric id).
 */

import { db } from '../index.js';

function looksLikeNumericId(value) {
  return value != null && /^\d+$/.test(String(value).trim());
}

/**
 * @returns {Promise<string|null>} Twitch login suitable for sendChatMessageAsBot
 */
export async function resolveStreamerChatChannel(twitchId, hintName = null) {
  if (hintName && !looksLikeNumericId(hintName)) {
    return String(hintName).trim();
  }

  try {
    const settingsDoc = await db.collection('streamerSettings').doc(twitchId).get();
    if (settingsDoc.exists) {
      const username = settingsDoc.data()?.twitchUsername;
      if (username && !looksLikeNumericId(username)) {
        return username;
      }
    }

    const userDoc = await db.collection('users').doc(twitchId).get();
    if (userDoc.exists) {
      const userData = userDoc.data();
      const username = userData.twitchUsername || userData.username || userData.login;
      if (username && !looksLikeNumericId(username)) {
        return username;
      }
    }
  } catch (err) {
    console.error(`[StreamerChannel] Lookup failed for ${twitchId}:`, err);
  }

  return null;
}
