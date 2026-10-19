import admin from 'firebase-admin';
import { buildFounderHeroUpdate } from './cosmeticsService.js';

/**
 * Revoke founder pack + cosmetics from account and all heroes after refund/dispute.
 */
export async function revokeFounderPurchase(db, purchase) {
  const userId = String(purchase.userId);
  const userRef = db.collection('users').doc(userId);
  await userRef.set(
    {
      founderPackTier: null,
      ownedCosmetics: [],
      founderRevokedAt: admin.firestore.FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  const heroesSnap = await db.collection('heroes').where('twitchUserId', '==', userId).get();
  const batch = db.batch();
  heroesSnap.docs.forEach((heroDoc) => {
    const hero = heroDoc.data();
    batch.update(heroDoc.ref, {
      founderPackTier: null,
      founderPackTierLevel: null,
      ownedCosmetics: [],
      equippedCosmetics: {},
      cosmetics: null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
  });
  if (!heroesSnap.empty) {
    await batch.commit();
  }
}

export async function revokeTokenPackPurchase(db, purchase) {
  if (!purchase.packType || !purchase.heroId) return;
  const { TOKEN_PACKS } = await import('../data/tokenPacks.js');
  const packConfig = TOKEN_PACKS[purchase.packType];
  if (!packConfig) return;
  const heroRef = db.collection('heroes').doc(purchase.heroId);
  const heroDoc = await heroRef.get();
  if (!heroDoc.exists) return;
  const hero = heroDoc.data();
  await heroRef.update({
    tokens: Math.max(0, (hero.tokens || 0) - packConfig.tokens),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
}
