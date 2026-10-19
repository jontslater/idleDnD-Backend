import admin from 'firebase-admin';
import { ROLE_CONFIG } from '../data/roleConfig.js';
import { getInitialMaxXp } from './levelUpHelper.js';
import { HERO_PLAYER_EDITABLE_FIELDS } from './heroUpdateAllowList.js';

/** Client fields allowed when creating a hero (plus identity verified separately). */
export const HERO_CREATE_INPUT_FIELDS = new Set([
  ...HERO_PLAYER_EDITABLE_FIELDS,
  'role',
  'class'
]);

/**
 * @param {Record<string, unknown>} body
 */
export function pickHeroCreateInput(body) {
  if (!body || typeof body !== 'object') {
    return { picked: {}, rejected: [] };
  }
  const picked = {};
  const rejected = [];
  for (const [key, value] of Object.entries(body)) {
    if (HERO_CREATE_INPUT_FIELDS.has(key)) {
      picked[key] = value;
    } else if (key !== 'twitchUserId' && key !== 'tiktokUserId') {
      rejected.push(key);
    }
  }
  return { picked, rejected };
}

/**
 * Server-authoritative new hero document (progression/economy/gear defaults only).
 */
export function buildNewHeroDocument({
  classKey,
  name,
  twitchUserId = null,
  tiktokUserId = null,
  twitchUsername = null,
  cosmetic = {},
  founderPackTier = null,
  founderPackTierLevel = null,
  battlefieldId = null
}) {
  const config = ROLE_CONFIG[classKey];
  if (!config) {
    throw new Error('Invalid class');
  }

  const category = config.category || 'dps';
  const defaultSlots =
    category === 'tank'
      ? ['weapon', 'armor', 'accessory', 'shield', 'helm', 'cloak', 'gloves', 'ring1', 'ring2', 'boots']
      : ['weapon', 'armor', 'accessory', 'helm', 'cloak', 'gloves', 'ring1', 'ring2', 'boots'];

  const equipment = {};
  defaultSlots.forEach((slot) => {
    equipment[slot] = null;
  });

  const displayName =
    name || cosmetic.name || cosmetic.heroName || `User${twitchUserId || tiktokUserId || 'Hero'}`;

  return {
    name: displayName,
    ...(twitchUserId && { twitchUserId }),
    ...(tiktokUserId && { tiktokUserId }),
    ...(twitchUsername && { twitchUsername }),
    ...cosmetic,
    role: classKey,
    level: 1,
    hp: config.baseHp,
    maxHp: config.baseHp,
    xp: 0,
    maxXp: getInitialMaxXp(1),
    attack: config.baseAttack,
    defense: config.baseDefense,
    gold: 0,
    tokens: 0,
    totalIdleTokens: 0,
    lastTokenClaim: Date.now(),
    lastCommandTime: Date.now(),
    equipment,
    stats: {
      totalDamage: 0,
      totalHealing: 0,
      damageBlocked: 0
    },
    isDead: false,
    deathTime: null,
    potions: { health: 0 },
    activeBuffs: {},
    profession: null,
    skills: {},
    skillPoints: 0,
    skillPointsEarned: 0,
    joinedAt: Date.now(),
    prestigeLevel: 0,
    prestigeTokens: 0,
    prestigeBoosts: {
      xpGain: 1.0,
      goldGain: 1.0,
      idleTicketGain: 1.0,
      statBoost: { attack: 0, defense: 0, hp: 0 }
    },
    prestigeSlotCores: {},
    ...(founderPackTier && { founderPackTier }),
    ...(founderPackTierLevel !== null && founderPackTierLevel !== undefined && { founderPackTierLevel }),
    ...(battlefieldId && {
      currentBattlefieldId: battlefieldId,
      currentBattlefieldType: battlefieldId.startsWith('twitch:') ? 'streamer' : 'world'
    }),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  };
}
