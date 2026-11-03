/**
 * Auth and validation helpers for battlefield queue HTTP routes.
 */

export function parseTwitchBattlefieldId(battlefieldId) {
  if (!battlefieldId) return null;
  const decoded = decodeURIComponent(String(battlefieldId)).trim();
  if (!decoded.startsWith('twitch:')) return null;
  const streamerKey = decoded.slice('twitch:'.length).trim();
  return streamerKey || null;
}

export function streamerOwnsBattlefield(battlefieldId, streamerId) {
  const battlefieldStreamer = parseTwitchBattlefieldId(battlefieldId);
  if (!battlefieldStreamer || streamerId == null) return false;
  return String(battlefieldStreamer) === String(streamerId);
}

export function getAuthenticatedTwitchUserId(authUser) {
  if (!authUser) return null;
  return authUser.twitchUserId || authUser.tiktokUserId || null;
}

export function bodyUserIdMatchesAuth(bodyUserId, authUser) {
  const authId = getAuthenticatedTwitchUserId(authUser);
  if (!authId || bodyUserId == null) return false;
  return String(bodyUserId) === String(authId);
}

export function heroBelongsToUser(hero, userId) {
  if (!hero || userId == null) return false;
  const ownerId = hero.twitchUserId || hero.userId || hero.ownerId;
  if (ownerId != null && String(ownerId) === String(userId)) return true;
  return false;
}

/**
 * When accessMode is omitted, treat as battlefield-scoped (portal default).
 */
export function heroMayJoinBattlefieldQueue(hero, queueBattlefieldId) {
  if (!hero || !queueBattlefieldId) return false;
  const accessMode = hero.accessMode ?? 'battlefield';
  if (accessMode !== 'battlefield') return true;
  return hero.currentBattlefieldId === queueBattlefieldId;
}

export function isValidLobbyType(type) {
  return type === 'dungeon' || type === 'raid';
}
