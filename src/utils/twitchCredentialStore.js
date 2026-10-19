import crypto from 'crypto';
import admin from 'firebase-admin';

const COLLECTION = 'twitchCredentials';

export const TWITCH_VIEWER_SCOPES = 'user:read:email';
export const TWITCH_STREAMER_SCOPES = 'user:read:email chat:read chat:edit';

function encryptionKey() {
  const raw =
    process.env.TWITCH_CREDENTIALS_KEY ||
    process.env.CREDENTIALS_ENCRYPTION_KEY ||
    process.env.JWT_SECRET;
  if (!raw) {
    throw new Error('TWITCH_CREDENTIALS_KEY (or JWT_SECRET) required to store Twitch credentials');
  }
  return crypto.createHash('sha256').update(raw).digest();
}

function encrypt(plaintext) {
  const key = encryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const enc = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

function decrypt(blob) {
  if (!blob) return null;
  const key = encryptionKey();
  const buf = Buffer.from(blob, 'base64');
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 */
export async function saveTwitchCredentials(db, twitchUserId, { accessToken, refreshToken, expiresAt, scopes }) {
  if (!twitchUserId || !accessToken) {
    throw new Error('twitchUserId and accessToken required');
  }
  await db.collection(COLLECTION).doc(String(twitchUserId)).set(
    {
      accessTokenEnc: encrypt(accessToken),
      refreshTokenEnc: refreshToken ? encrypt(refreshToken) : null,
      expiresAt: expiresAt || Date.now() + 3600_000,
      scopes: scopes || TWITCH_VIEWER_SCOPES,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    },
    { merge: true }
  );
}

export async function getTwitchCredentials(db, twitchUserId) {
  if (!twitchUserId) return null;
  const doc = await db.collection(COLLECTION).doc(String(twitchUserId)).get();
  if (!doc.exists) return null;
  const d = doc.data();
  return {
    accessToken: decrypt(d.accessTokenEnc),
    refreshToken: d.refreshTokenEnc ? decrypt(d.refreshTokenEnc) : null,
    expiresAt: d.expiresAt,
    scopes: d.scopes
  };
}

export async function getTwitchCredentialsForHero(db, hero) {
  if (!hero?.twitchUserId) return null;
  return getTwitchCredentials(db, hero.twitchUserId);
}

/** Remove legacy token fields from all heroes for a Twitch user. */
export async function stripTwitchTokensFromHeroes(db, twitchUserId) {
  const snap = await db.collection('heroes').where('twitchUserId', '==', twitchUserId).get();
  if (snap.empty) return 0;
  const batch = db.batch();
  snap.docs.forEach((doc) => {
    batch.update(doc.ref, {
      twitchAccessToken: admin.firestore.FieldValue.delete(),
      twitchRefreshToken: admin.firestore.FieldValue.delete(),
      twitchTokenExpiresAt: admin.firestore.FieldValue.delete()
    });
  });
  await batch.commit();
  return snap.size;
}
