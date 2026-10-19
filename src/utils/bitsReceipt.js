/**
 * Verify Twitch extension Bits JWT + transaction id binding.
 */
export function assertBitsJwtMatchesRequest(req, { transactionId, channelId }) {
  const u = req.twitchUser;
  if (!u) {
    return { ok: false, status: 401, error: 'Missing extension JWT' };
  }
  const jwtTx =
    u.transaction_id ||
    u.transactionId ||
    u.product?.transaction_id ||
    u.product?.transactionId;
  if (jwtTx && transactionId && String(jwtTx) !== String(transactionId)) {
    return { ok: false, status: 400, error: 'transactionId does not match extension JWT', code: 'BITS_TX_MISMATCH' };
  }
  if (channelId && u.channel_id && String(u.channel_id) !== String(channelId)) {
    return { ok: false, status: 400, error: 'channelId does not match extension JWT', code: 'BITS_CHANNEL_MISMATCH' };
  }
  return { ok: true };
}
