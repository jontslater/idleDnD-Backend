import admin from 'firebase-admin';
import { KILL_DROP_CHANCES } from '../data/lootConfig.js';
import { rollLootForKill } from './lootRollService.js';
import { combatKillBaseXp } from '../data/balance.js';
import { capAccumulatedXpForMinute } from '../utils/combatXpLimiter.js';
import { resolveInstanceLootContext } from './instanceKillContext.js';

const BOSS_KINDS = new Set(['raidBoss', 'dungeonBoss', 'worldboss', 'boss']);

/** Honest idle: 30 kills/min × 8% ≈ 2.4/min uncapped; plan ≈29 drops/hour per hero. */
export const TARGET_DROPS_PER_HOUR = 29;
const DROP_WINDOW_MS = 60 * 60 * 1000;
const ELITE_WINDOW_MS = 10 * 60 * 1000;
/** Elite spawn share + margin (honest play). */
const ELITE_MAX_FRACTION = 0.18;
const SWING_MS = 2000;
const MAX_KILLS_PER_MINUTE = Math.floor(60_000 / SWING_MS);

const heroDropWindows = new Map();
const heroEliteWindows = new Map();

function windowKey(heroId) {
  return String(heroId);
}

function getDropWindow(heroId) {
  const now = Date.now();
  const key = windowKey(heroId);
  let entry = heroDropWindows.get(key);
  if (!entry || now - entry.windowStart > DROP_WINDOW_MS) {
    entry = { windowStart: now, drops: 0, killsThisMinute: 0, minuteStart: now };
    heroDropWindows.set(key, entry);
  }
  if (now - entry.minuteStart > 60_000) {
    entry.killsThisMinute = 0;
    entry.minuteStart = now;
  }
  return entry;
}

function getEliteWindow(heroId) {
  const now = Date.now();
  const key = windowKey(heroId);
  let entry = heroEliteWindows.get(key);
  if (!entry || now - entry.windowStart > ELITE_WINDOW_MS) {
    entry = { windowStart: now, kills: 0, elites: 0 };
    heroEliteWindows.set(key, entry);
  }
  return entry;
}

function canGrantDrop(heroId) {
  const entry = getDropWindow(heroId);
  entry.killsThisMinute += 1;
  if (entry.killsThisMinute > MAX_KILLS_PER_MINUTE) {
    return { allowed: false, reason: 'kill_rate' };
  }
  if (entry.drops >= TARGET_DROPS_PER_HOUR) {
    return { allowed: false, reason: 'drop_cap' };
  }
  return { allowed: true };
}

function recordDrop(heroId) {
  const entry = getDropWindow(heroId);
  entry.drops += 1;
}

export function createBatchLootContext() {
  return {};
}

export function resolveKillKindForHero(kill) {
  let kind = kill.kind || kill.enemyKind || 'normal';
  if (kind !== 'elite') return kind;
  const heroId = kill.heroId || kill.hero_id;
  if (!heroId) return 'normal';
  const win = getEliteWindow(heroId);
  win.kills += 1;
  const maxElites = Math.max(1, Math.floor(win.kills * ELITE_MAX_FRACTION));
  if (win.elites < maxElites) {
    win.elites += 1;
    return 'elite';
  }
  return 'normal';
}

export function normalizeIdleKill(raw, _batchCtx = null) {
  if (!raw || typeof raw !== 'object') return null;
  const heroId = raw.heroId || raw.hero_id;
  if (!heroId) return null;
  const enemyLevel = raw.enemyLevel ?? raw.enemy_level ?? raw.level ?? 1;
  const kind = resolveKillKindForHero({ ...raw, heroId });
  const contentType = raw.contentType || raw.content_type;
  return {
    heroId: String(heroId),
    enemyLevel: Number(enemyLevel) || 1,
    kind: String(kind),
    contentType: contentType ? String(contentType) : undefined,
    difficulty: raw.difficulty,
    contentId: raw.contentId,
    instanceId: raw.instanceId || raw.instance_id,
    source: 'combat'
  };
}

export function isClientBossLootKill(kill) {
  if (!kill) return true;
  return BOSS_KINDS.has(kill.kind);
}

async function grantKillXp(db, heroRef, hero, kill, battlefieldId) {
  const level = hero.level || 1;
  const xp = combatKillBaseXp(level, kill.kind === 'elite' ? 'elite' : 'normal');
  const { allowedXp } = capAccumulatedXpForMinute(battlefieldId, level, xp);
  if (allowedXp <= 0) return 0;
  const newXp = (hero.xp || 0) + allowedXp;
  await heroRef.update({
    xp: newXp,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  return allowedXp;
}

/**
 * Roll idle/world loot for one kill (server authoritative). One 8% roll here only.
 */
export async function rollIdleKillLoot(db, battlefieldId, kill, batchCtx = null) {
  const normalized = normalizeIdleKill(kill, batchCtx);
  if (!normalized) {
    return { ok: false, status: 400, error: 'Invalid kill (heroId, enemyLevel, kind required)' };
  }
  if (isClientBossLootKill(normalized)) {
    return {
      ok: false,
      status: 403,
      error: 'Boss loot must come from instance completion',
      code: 'BOSS_LOOT_SERVER_ONLY'
    };
  }

  const heroRef = db.collection('heroes').doc(normalized.heroId);
  const heroDoc = await heroRef.get();
  if (!heroDoc.exists) {
    return { ok: false, status: 404, error: 'Hero not found' };
  }
  const hero = { id: heroDoc.id, ...heroDoc.data() };
  if (hero.currentBattlefieldId !== battlefieldId) {
    return { ok: false, status: 403, error: 'Hero not on this battlefield', code: 'BATTLEFIELD_MISMATCH' };
  }

  const lootKill = await resolveInstanceLootContext(db, normalized, hero);

  await grantKillXp(db, heroRef, hero, lootKill, battlefieldId);

  const cap = canGrantDrop(normalized.heroId);
  if (!cap.allowed) {
    return { ok: true, dropped: false, throttled: true, reason: cap.reason };
  }

  const rollChance = lootKill.kind === 'elite' ? KILL_DROP_CHANCES.elite : KILL_DROP_CHANCES.normal;
  if (Math.random() > rollChance) {
    return { ok: true, dropped: false };
  }

  const roll = rollLootForKill(hero, lootKill, {
    lootPity: hero.lootPity || {},
    setCollection: hero.setCollection || {}
  }, { guaranteedDrop: true });

  if (!roll.dropped || !roll.item) {
    return { ok: true, dropped: false };
  }

  recordDrop(normalized.heroId);

  const inventory = Array.isArray(hero.inventory) ? [...hero.inventory] : [];
  inventory.push(roll.item);
  await heroRef.update({
    inventory,
    lootPity: roll.pity,
    setCollection: roll.setCollection,
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });

  return { ok: true, dropped: true, heroId: normalized.heroId, item: roll.item };
}

/** Test helper */
export function resetIdleLootWindows() {
  heroDropWindows.clear();
  heroEliteWindows.clear();
}
