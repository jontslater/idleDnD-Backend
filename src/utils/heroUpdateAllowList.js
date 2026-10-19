/**
 * Fields clients may set via PUT /api/heroes/:userId (cosmetic / settings only).
 * All progression, economy, gear, and combat state must use dedicated server routes.
 */

export const HERO_PLAYER_EDITABLE_FIELDS = new Set([
  'name',
  'heroName',
  'twitchUsername',
  'tiktokUsername',
  'preferences',
  'settings',
  'uiPreferences',
  'cosmetics',
  'selectedTitle',
  'title',
  'avatarUrl',
  'portraitId',
  'autoQuest',
  'autoJoin',
  'chatNotificationsEnabled'
]);

/** Known sensitive fields stripped from hero writes (for audits / logging). */
export const HERO_FORBIDDEN_CLIENT_FIELDS = [
  'skills',
  'skillPoints',
  'skillPointsEarned',
  'level',
  'xp',
  'maxXp',
  'gold',
  'tokens',
  'prestigeLevel',
  'prestigePoints',
  'prestigeTier',
  'attack',
  'defense',
  'hp',
  'maxHp',
  'equipment',
  'inventory',
  'gear',
  'bank',
  'bankSize',
  'cooldowns',
  'activeBuffs',
  'activeInstance',
  'currentBattlefieldId',
  'questProgress',
  'profession',
  'mail',
  'guildId',
  'isAdmin',
  'role',
  'class',
  'itemScore',
  'founder',
  'stripeCustomerId',
  'purchases',
  'idleRewards',
  'lastLoginReward',
  'waveStats',
  'totalDamage',
  'totalHealing'
];

/**
 * @param {Record<string, unknown>} body
 * @returns {{ allowed: Record<string, unknown>, rejected: string[] }}
 */
export function pickPlayerEditableHeroFields(body) {
  if (!body || typeof body !== 'object') {
    return { allowed: {}, rejected: [] };
  }
  const allowed = {};
  const rejected = [];
  for (const [key, value] of Object.entries(body)) {
    if (HERO_PLAYER_EDITABLE_FIELDS.has(key)) {
      allowed[key] = value;
    } else if (key !== 'twitchUserId' && key !== 'tiktokUserId') {
      rejected.push(key);
    }
  }
  return { allowed, rejected };
}
