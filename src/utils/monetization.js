/**
 * Monetization policy: paid founder packs and extension perks are cosmetic-only.
 * Gameplay rewards (gold, XP, loot rates, idle tokens, stat multipliers) must not
 * scale with founderPackTier or similar purchase flags.
 */

import admin from 'firebase-admin';

export const IDLE_TOKENS_PER_HOUR = 2.5;
export const MAX_IDLE_CLAIM_HOURS = 24;

/** @typedef {'gold' | 'xp' | 'loot' | 'tokens'} GameplayRewardKind */

/**
 * Multiplier applied to earned gold/XP/loot. Always 1.0 — founder tier ignored.
 * @param {object} _hero
 * @param {GameplayRewardKind} _kind
 */
export function getPaidGameplayRewardMultiplier(_hero, _kind) {
  return 1.0;
}

export function getIdleTokensPerHour(_hero) {
  return IDLE_TOKENS_PER_HOUR;
}

/**
 * Idle !claim tokens (no founder or other paid rate bonuses).
 * @param {number} hoursSinceClaim
 * @param {object} _hero
 */
export function computeIdleClaimTokens(hoursSinceClaim, _hero) {
  const rate = getIdleTokensPerHour(_hero);
  const raw = Math.floor(Math.max(0, hoursSinceClaim) * rate);
  const maxTokens = Math.floor(rate * MAX_IDLE_CLAIM_HOURS);
  return Math.min(raw, maxTokens);
}

export const FOUNDER_TIER_COSMETICS = {
  bronze: { founderBadge: 'bronze', chatNameColor: '#CD7F32' },
  silver: { founderBadge: 'silver', chatNameColor: '#C0C0C0' },
  gold: { founderBadge: 'gold', chatNameColor: '#FFD700' },
  platinum: { founderBadge: 'platinum', chatNameColor: '#E5E4E2' }
};

/**
 * Firestore fields to set when a founder pack is purchased or granted (no currency/stats).
 * @param {object} hero - existing hero doc
 * @param {string} packTier
 * @param {number} tierLevel
 */
export function buildFounderPackCosmeticUpdate(hero, packTier, tierLevel) {
  const tier = (packTier || '').toLowerCase().trim();
  const cosmetic = FOUNDER_TIER_COSMETICS[tier] || {};

  const update = {
    founderPackTier: tier,
    founderPackTierLevel: tierLevel,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };

  if (cosmetic.founderBadge) {
    update.founderBadge = cosmetic.founderBadge;
    update.cosmetics = {
      ...(hero.cosmetics || {}),
      founderBadge: cosmetic.founderBadge,
      ...(cosmetic.chatNameColor && { nameColor: cosmetic.chatNameColor })
    };
  }

  if (!hero.unlockedTitles || !hero.unlockedTitles.includes('Founder')) {
    update.unlockedTitles = admin.firestore.FieldValue.arrayUnion('Founder');
    if (!hero.activeTitle) {
      update.activeTitle = 'Founder';
    }
  }

  return update;
}
