import admin from 'firebase-admin';
import { KILL_DROP_CHANCES } from '../data/lootConfig.js';
import { rollLootForKill } from './lootRollService.js';

const BLOCKED_CLIENT_KINDS = new Set(['raidBoss', 'dungeonBoss', 'worldboss', 'boss']);

/** ~6 idle kills/min × 8% drop ≈ 0.48 drops/min → cap 1 normal drop per hero per minute. */
const DROP_WINDOW_MS = 60_000;
const MAX_NORMAL_DROPS_PER_HERO_PER_MIN = 1;
const MAX_ELITE_DROPS_PER_HERO_PER_MIN = 2;
const PLAUSIBLE_KILLS_PER_MIN = 12;

const heroDropWindows = new Map();

function windowKey(heroId) {
  return String(heroId);
}

function canGrantDrop(heroId, kind) {
  const now = Date.now();
  const key = windowKey(heroId);
  let entry = heroDropWindows.get(key);
  if (!entry || now - entry.windowStart > DROP_WINDOW_MS) {
    entry = { windowStart: now, normal: 0, elite: 0, kills: 0 };
    heroDropWindows.set(key, entry);
  }
  entry.kills += 1;
  if (entry.kills > PLAUSIBLE_KILLS_PER_MIN) {
    return { allowed: false, reason: 'kill_rate' };
  }
  const isElite = kind === 'elite';
  if (isElite) {
    if (entry.elite >= MAX_ELITE_DROPS_PER_HERO_PER_MIN) {
      return { allowed: false, reason: 'elite_drop_cap' };
    }
    entry.elite += 1;
    return { allowed: true };
  }
  if (entry.normal >= MAX_NORMAL_DROPS_PER_HERO_PER_MIN) {
    return { allowed: false, reason: 'normal_drop_cap' };
  }
  entry.normal += 1;
  return { allowed: true };
}

/**
 * Normalize kill payload from overlay / FE.
 */
export function normalizeIdleKill(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const heroId = raw.heroId || raw.hero_id;
  if (!heroId) return null;
  const enemyLevel = raw.enemyLevel ?? raw.enemy_level ?? raw.level ?? 1;
  const kind = raw.kind || raw.enemyKind || 'normal';
  const contentType = raw.contentType || raw.content_type;
  return {
    heroId: String(heroId),
    enemyLevel: Number(enemyLevel) || 1,
    kind: String(kind),
    contentType: contentType ? String(contentType) : undefined,
    difficulty: raw.difficulty,
    contentId: raw.contentId
  };
}

export function isClientBossLootKill(kill) {
  if (!kill) return true;
  if (BLOCKED_CLIENT_KINDS.has(kill.kind)) return true;
  if (kill.contentType === 'raid' || kill.contentType === 'dungeon') return true;
  return false;
}

/**
 * Roll idle/world loot for one kill (server authoritative).
 */
export async function rollIdleKillLoot(db, battlefieldId, kill) {
  const normalized = normalizeIdleKill(kill);
  if (!normalized) {
    return { ok: false, status: 400, error: 'Invalid kill (heroId, enemyLevel, kind required)' };
  }
  if (isClientBossLootKill(normalized)) {
    return {
      ok: false,
      status: 403,
      error: 'Boss and raid loot must come from instance completion',
      code: 'BOSS_LOOT_SERVER_ONLY'
    };
  }

  const cap = canGrantDrop(normalized.heroId, normalized.kind);
  if (!cap.allowed) {
    return { ok: true, dropped: false, throttled: true, reason: cap.reason };
  }

  const heroRef = db.collection('heroes').doc(normalized.heroId);
  const heroDoc = await heroRef.get();
  if (!heroDoc.exists) {
    return { ok: false, status: 404, error: 'Hero not found' };
  }
  const hero = { id: heroDoc.id, ...heroDoc.data() };
  if (hero.currentBattlefieldId !== battlefieldId) {
    return { ok: false, status: 403, error: 'Hero not on this battlefield' };
  }

  const rollChance =
    normalized.kind === 'elite' ? KILL_DROP_CHANCES.elite : KILL_DROP_CHANCES.normal;
  if (Math.random() > rollChance) {
    return { ok: true, dropped: false };
  }

  const roll = rollLootForKill(hero, normalized, {
    lootPity: hero.lootPity || {},
    setCollection: hero.setCollection || {}
  });
  if (!roll.dropped || !roll.item) {
    return { ok: true, dropped: false };
  }

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
