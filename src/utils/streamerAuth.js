/**
 * Resolve streamer Twitch id from route/body (overlay + battlefield routes).
 */
export function resolveStreamerIdFromRequest(req) {
  if (req.params?.streamerId) return String(req.params.streamerId);
  if (req.params?.battlefieldId) {
    const m = String(req.params.battlefieldId).match(/^twitch:(.+)$/i);
    if (m) return m[1];
  }
  if (req.body?.streamerId) return String(req.body.streamerId);
  const bf = req.body?.battlefieldId;
  if (bf) {
    const m = String(bf).match(/^twitch:(.+)$/i);
    if (m) return m[1];
  }
  return null;
}

export function battlefieldIdForStreamer(streamerId) {
  return `twitch:${streamerId}`;
}

export function assertBattlefieldMatchesStreamer(battlefieldId, streamerId) {
  if (!battlefieldId || !streamerId) return false;
  return String(battlefieldId).toLowerCase() === battlefieldIdForStreamer(streamerId).toLowerCase();
}
