import { combatKillBaseXp, maxXpGainPerMinute } from '../data/balance.js';

const battlefieldWindows = new Map();

const WINDOW_MS = 60_000;
const MAX_IMMEDIATE_CALLS_PER_WINDOW = 30;

/** Max total XP that can be granted in one immediate combat/xp call for a hero level. */
export function maxImmediateCombatXpForLevel(heroLevel, enemyKind = 'normal') {
  const perKill = combatKillBaseXp(heroLevel, enemyKind);
  const perMinuteCap = maxXpGainPerMinute(heroLevel);
  return Math.max(perKill * 12, perMinuteCap * 2);
}

export function clampEnemyLevel(level) {
  const L = Math.floor(Number(level) || 1);
  return Math.min(100, Math.max(1, L));
}

export function normalizeKillXp(enemyLevel, enemyKind = 'normal') {
  return combatKillBaseXp(clampEnemyLevel(enemyLevel), enemyKind);
}

/**
 * Rate-limit immediate XP awards per battlefield (overlay abuse).
 * @returns {{ allowed: boolean, retryAfterMs?: number }}
 */
export function checkCombatXpRateLimit(battlefieldId) {
  const now = Date.now();
  let entry = battlefieldWindows.get(battlefieldId);
  if (!entry || now - entry.windowStart > WINDOW_MS) {
    entry = { windowStart: now, count: 0 };
    battlefieldWindows.set(battlefieldId, entry);
  }
  entry.count += 1;
  if (entry.count > MAX_IMMEDIATE_CALLS_PER_WINDOW) {
    return { allowed: false, retryAfterMs: WINDOW_MS - (now - entry.windowStart) };
  }
  return { allowed: true };
}

export function parseBattlefieldStreamerId(battlefieldId) {
  const m = String(battlefieldId || '').match(/^twitch:(.+)$/);
  return m ? m[1] : null;
}
