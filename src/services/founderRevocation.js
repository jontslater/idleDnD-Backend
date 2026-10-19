import admin from 'firebase-admin';
import { FOUNDER_TIER_COSMETIC_IDS } from '../data/cosmetics.js';

const FOUNDER_HERO_FIELDS = [
  'founderPackTier',
  'founderPackTierLevel',
  'founderBadge',
  'nameColor',
  'nameFrame',
  'auraEffect',
  'spellEffect',
  'activeTitle',
  'selectedTitle'
];

function founderCosmeticIdsForTier(tier) {
  const t = String(tier || '').toLowerCase();
  return FOUNDER_TIER_COSMETIC_IDS[t] || [];
}

/**
 * Revoke founder pack from account (does not remove token-bought cosmetics).
 */
export async function revokeFounderPurchase(db, purchase) {
  const userId = String(purchase.userId);
  const tier = purchase.packTier;
  const founderIds = new Set(founderCosmeticIdsForTier(tier));

  const userRef = db.collection('users').doc(userId);
  const userDoc = await userRef.get();
  const owned = userDoc.exists && Array.isArray(userDoc.data().ownedCosmetics) ? userDoc.data().ownedCosmetics : [];
  const filteredOwned = owned.filter((id) => !founderIds.has(id));

  await userRef.set(
    {
      founderPackTier: null,
      ownedCosmetics: filteredOwned,
      founderRevokedAt: admin.firestore.FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  const heroesSnap = await db.collection('heroes').where('twitchUserId', '==', userId).get();
  const batch = db.batch();
  heroesSnap.docs.forEach((heroDoc) => {
    const hero = heroDoc.data();
    const equipped = { ...(hero.equippedCosmetics || {}) };
    for (const id of founderIds) {
      for (const [slot, val] of Object.entries(equipped)) {
        if (val === id) delete equipped[slot];
      }
    }
    const titles = Array.isArray(hero.titles) ? hero.titles.filter((t) => t !== 'Founder') : [];
    const update = {
      founderPackTier: null,
      founderPackTierLevel: null,
      founderBadge: null,
      nameColor: null,
      nameFrame: null,
      auraEffect: null,
      spellEffect: null,
      equippedCosmetics: equipped,
      titles,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };
    if (hero.activeTitle === 'Founder' || hero.selectedTitle === 'Founder') {
      update.activeTitle = null;
      update.selectedTitle = null;
    }
    batch.update(heroDoc.ref, update);
  });
  if (!heroesSnap.empty) {
    await batch.commit();
  }
}

/**
 * Deduct tokens for a token-pack reversal (may go negative; cosmetics stay).
 */
export async function revokeTokenPackPurchase(db, purchase, fraction = 1) {
  if (!purchase.packType || !purchase.heroId) return { tokensDeducted: 0 };
  const { TOKEN_PACKS } = await import('../data/tokenPacks.js');
  const packConfig = TOKEN_PACKS[purchase.packType];
  if (!packConfig) return { tokensDeducted: 0 };
  const deduct = Math.floor(packConfig.tokens * fraction);
  const heroRef = db.collection('heroes').doc(purchase.heroId);
  const heroDoc = await heroRef.get();
  if (!heroDoc.exists) return { tokensDeducted: 0 };
  const hero = heroDoc.data();
  const next = (hero.tokens || 0) - deduct;
  await heroRef.update({
    tokens: next,
    tokenBalanceBlocked: next < 0,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  return { tokensDeducted: deduct, newTokens: next };
}

export { FOUNDER_HERO_FIELDS };
