import { maxPlausibleDamageReport } from './worldBossFactory.js';

const REPORT_WINDOW_MS = 3_000;
const MIN_FIGHT_MS_PER_MILLION_HP = 45_000;

const reportWindows = new Map();

function windowKey(instanceId, heroKey) {
  return `${instanceId}:${heroKey}`;
}

function getWindow(instanceId, heroKey) {
  const now = Date.now();
  const key = windowKey(instanceId, heroKey);
  let entry = reportWindows.get(key);
  if (!entry || now - entry.windowStart > REPORT_WINDOW_MS) {
    entry = { windowStart: now, damage: 0 };
    reportWindows.set(key, entry);
  }
  return entry;
}

/**
 * Cap raid boss damage per progress report (per hero + global fight pace).
 */
export function capRaidBossDamageReport({
  instance,
  heroLevel,
  classKey,
  heroKey,
  requestedDamage,
  now = Date.now()
}) {
  const bossMaxHp = instance.bossMaxHp || instance.boss?.maxHp || 1000;
  const maxPerReport = Math.max(1, Math.floor(bossMaxHp * 0.05));
  const plausible = maxPlausibleDamageReport(heroLevel, classKey);
  const win = getWindow(instance.id || instance.instanceId || 'raid', heroKey);
  const remainingInWindow = Math.max(0, plausible - win.damage);
  let applied = Math.min(Math.max(0, Math.floor(requestedDamage)), maxPerReport, remainingInWindow);

  const startedMs =
    instance.bossFightStartedAt ||
    (instance.startedAt?.toMillis ? instance.startedAt.toMillis() : instance.startedAt) ||
    now;
  const elapsed = Math.max(0, now - startedMs);
  const minFightMs = Math.max(60_000, Math.floor((bossMaxHp / 1_000_000) * MIN_FIGHT_MS_PER_MILLION_HP));
  const paceCap = Math.floor(bossMaxHp * Math.min(1, elapsed / minFightMs));
  const totalApplied = instance.totalBossDamageApplied || 0;
  const paceRemaining = Math.max(0, paceCap - totalApplied);
  applied = Math.min(applied, paceRemaining);

  win.damage += applied;
  return { applied, maxPerReport, plausible };
}

export function resetRaidBossDamageLimiterForTests() {
  reportWindows.clear();
}
