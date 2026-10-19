import admin from 'firebase-admin';
import {
  getCosmeticById,
  listStoreCatalog,
  FOUNDER_TIER_COSMETIC_IDS,
  EQUIPPED_COSMETIC_SLOTS
} from '../data/cosmetics.js';
import { ROLE_CONFIG } from '../services/gearService.js';

function userRef(db, twitchUserId) {
  return db.collection('users').doc(String(twitchUserId));
}

export async function getOwnedCosmeticIds(db, twitchUserId) {
  const doc = await userRef(db, twitchUserId).get();
  if (!doc.exists) return [];
  const owned = doc.data().ownedCosmetics;
  return Array.isArray(owned) ? owned : [];
}

export function getPublicCatalog() {
  return listStoreCatalog();
}

/**
 * Account-level founder grant + hero projection fields for overlay compatibility.
 */
export async function grantFounderEntitlements(db, twitchUserId, packTier) {
  const tier = String(packTier || '').toLowerCase();
  const ids = FOUNDER_TIER_COSMETIC_IDS[tier] || [];
  const badge = getCosmeticById(`founder_badge_${tier}`);
  const name = getCosmeticById(`founder_name_${tier}`);

  await userRef(db, twitchUserId).set(
    {
      founderPackTier: tier,
      ownedCosmetics: admin.firestore.FieldValue.arrayUnion(...ids),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    },
    { merge: true }
  );

  return {
    founderPackTier: tier,
    founderBadge: badge?.render?.imagePath || null,
    nameColor: name?.render?.color || null,
    nameFrame: tier === 'bronze' ? null : tier === 'silver' || tier === 'gold' || tier === 'platinum' ? 'founder_silver' : null,
    auraEffect: tier === 'gold' || tier === 'platinum' ? 'founder_gold' : null,
    spellEffect: tier === 'gold' || tier === 'platinum' ? 'founder_gold' : null,
    titles: admin.firestore.FieldValue.arrayUnion('Founder'),
    activeTitle: 'Founder',
    equippedCosmetics: {
      badge: `founder_badge_${tier}`,
      nameColor: `founder_name_${tier}`,
      title: 'founder_title',
      ...(tier !== 'bronze' && { frame: 'founder_frame_silver' }),
      ...((tier === 'gold' || tier === 'platinum') && {
        auraEffect: 'founder_aura_gold',
        spellEffect: 'founder_spell_gold'
      })
    }
  };
}

export function buildFounderHeroUpdate(hero, packTier, tierLevel) {
  const tier = String(packTier || '').toLowerCase();
  const badge = getCosmeticById(`founder_badge_${tier}`);
  const name = getCosmeticById(`founder_name_${tier}`);
  const update = {
    founderPackTier: tier,
    founderPackTierLevel: tierLevel,
    founderBadge: badge?.render?.imagePath || null,
    nameColor: name?.render?.color || null,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
  if (tier !== 'bronze') {
    update.nameFrame = 'founder_silver';
  }
  if (tier === 'gold' || tier === 'platinum') {
    update.auraEffect = 'founder_gold';
    update.spellEffect = 'founder_gold';
  }
  update.titles = admin.firestore.FieldValue.arrayUnion('Founder');
  if (!hero.activeTitle && !hero.selectedTitle) {
    update.activeTitle = 'Founder';
  }
  update.equippedCosmetics = {
    ...(hero.equippedCosmetics || {}),
    badge: `founder_badge_${tier}`,
    nameColor: `founder_name_${tier}`,
    title: 'founder_title',
    ...(tier !== 'bronze' && { frame: 'founder_frame_silver' }),
    ...((tier === 'gold' || tier === 'platinum') && {
      auraEffect: 'founder_aura_gold',
      spellEffect: 'founder_spell_gold'
    })
  };
  return update;
}

function heroRoleCategory(hero) {
  const role = hero.role || hero.class || 'berserker';
  const cfg = ROLE_CONFIG[role];
  return cfg?.category || 'dps';
}

function roleMatchesFilter(hero, cosmetic) {
  if (!cosmetic.roleFilter) return true;
  const cat = heroRoleCategory(hero);
  if (cosmetic.roleFilter === 'tank') return cat === 'tank';
  if (cosmetic.roleFilter === 'healer') return cat === 'healer';
  if (cosmetic.roleFilter === 'dps') return cat === 'dps';
  return cosmetic.roleFilter === cat;
}

export async function purchaseCosmetic(db, { twitchUserId, heroDocId, cosmeticId }) {
  const cosmetic = getCosmeticById(cosmeticId);
  if (!cosmetic || !cosmetic.purchasable) {
    throw Object.assign(new Error('Cosmetic not available for purchase'), { status: 400 });
  }

  const heroRef = db.collection('heroes').doc(heroDocId);
  const userId = String(twitchUserId);

  return db.runTransaction(async (tx) => {
    const heroDoc = await tx.get(heroRef);
    if (!heroDoc.exists) {
      throw Object.assign(new Error('Hero not found'), { status: 404 });
    }
    const hero = heroDoc.data();
    if (hero.twitchUserId !== userId) {
      throw Object.assign(new Error('Forbidden'), { status: 403 });
    }

    const userDoc = await tx.get(userRef(db, userId));
    const owned = userDoc.exists && Array.isArray(userDoc.data().ownedCosmetics) ? userDoc.data().ownedCosmetics : [];
    if (owned.includes(cosmeticId)) {
      return { alreadyOwned: true, cosmeticId, tokens: hero.tokens || 0 };
    }

    const price = cosmetic.priceTokens || 0;
    const tokens = hero.tokens || 0;
    if (tokens < 0 || hero.tokenBalanceBlocked) {
      throw Object.assign(new Error('Token balance is negative. Purchases are blocked until balance is positive.'), {
        status: 403,
        code: 'TOKEN_BALANCE_NEGATIVE'
      });
    }
    if (tokens < price) {
      throw Object.assign(new Error(`Need ${price} tokens, have ${tokens}`), { status: 400 });
    }

    tx.update(heroRef, {
      tokens: tokens - price,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    tx.set(
      userRef(db, userId),
      {
        ownedCosmetics: admin.firestore.FieldValue.arrayUnion(cosmeticId),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      },
      { merge: true }
    );
    const purchaseRef = db.collection('cosmeticPurchases').doc(`${userId}_${cosmeticId}`);
    tx.set(purchaseRef, {
      twitchUserId: userId,
      heroDocId,
      cosmeticId,
      priceTokens: price,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    return { alreadyOwned: false, cosmeticId, newTokens: tokens - price };
  });
}

export async function equipCosmetic(db, { heroDocId, twitchUserId, slot, cosmeticId }) {
  if (!EQUIPPED_COSMETIC_SLOTS.has(slot)) {
    throw Object.assign(new Error('Invalid cosmetic slot'), { status: 400 });
  }

  const heroRef = db.collection('heroes').doc(heroDocId);
  const heroDoc = await heroRef.get();
  if (!heroDoc.exists) {
    throw Object.assign(new Error('Hero not found'), { status: 404 });
  }
  const hero = heroDoc.data();
  if (hero.twitchUserId !== twitchUserId) {
    throw Object.assign(new Error('Forbidden'), { status: 403 });
  }

  const equipped = { ...(hero.equippedCosmetics || {}) };
  if (cosmeticId === null || cosmeticId === undefined || cosmeticId === '') {
    delete equipped[slot];
  } else {
    const cosmetic = getCosmeticById(cosmeticId);
    if (!cosmetic) {
      throw Object.assign(new Error('Unknown cosmetic'), { status: 400 });
    }
    if (cosmetic.category !== slot && !(slot === 'badge' && cosmetic.category === 'badge')) {
      throw Object.assign(new Error('Cosmetic does not fit this slot'), { status: 400 });
    }
    const owned = await getOwnedCosmeticIds(db, twitchUserId);
    if (!owned.includes(cosmeticId)) {
      throw Object.assign(new Error('Cosmetic not owned'), { status: 403 });
    }
    if (!roleMatchesFilter(hero, cosmetic)) {
      throw Object.assign(new Error('Cosmetic not valid for this hero role'), { status: 400 });
    }
    equipped[slot] = cosmeticId;

    const projection = {};
    if (slot === 'badge' && cosmetic.render?.imagePath) projection.founderBadge = cosmetic.render.imagePath;
    if (slot === 'nameColor' && cosmetic.render?.color) projection.nameColor = cosmetic.render.color;
    if (slot === 'frame' && cosmetic.render?.frameId) projection.nameFrame = cosmetic.render.frameId;
    if (slot === 'auraEffect' && cosmetic.render?.auraId) projection.auraEffect = cosmetic.render.auraId;
    if (slot === 'spellEffect' && cosmetic.render?.spellId) projection.spellEffect = cosmetic.render.spellId;
    if (slot === 'title' && cosmetic.render?.title) {
      projection.activeTitle = cosmetic.render.title;
    }

    await heroRef.update({
      equippedCosmetics: equipped,
      ...projection,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return { equippedCosmetics: equipped };
  }

  await heroRef.update({
    equippedCosmetics: equipped,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  return { equippedCosmetics: equipped };
}

/** Apply account founder tier to a newly created hero if user already purchased. */
export async function applyAccountFounderToHero(db, twitchUserId, heroRef, existingHero = {}) {
  const userDoc = await userRef(db, twitchUserId).get();
  if (!userDoc.exists || !userDoc.data().founderPackTier) return false;
  const tier = userDoc.data().founderPackTier;
  const { TIER_LEVELS } = await import('../data/founderPacks.js');
  const update = buildFounderHeroUpdate(existingHero, tier, TIER_LEVELS[tier] || 1);
  await heroRef.set(update, { merge: true });
  return true;
}
