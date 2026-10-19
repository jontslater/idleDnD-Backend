import {
  enemyStats,
  BOSS_MECHANICS,
  rewardXpFromMinutes,
  XP_SOURCES,
  deriveHeroCombatStats,
  COMBAT_CAPS
} from '../data/balance.js';

const DEFAULT_LEVEL = 60;
const DEFAULT_DURATION_MS = 3_600_000;

/**
 * Server-defined world boss template (client cannot set combat stats or rewards).
 */
export function buildWorldBossDocument(options = {}) {
  const level = Math.min(100, Math.max(1, Math.floor(options.level || DEFAULT_LEVEL)));
  const stats = enemyStats(level, 'raidBoss', 10);
  const hp = Math.floor(stats.hp * 3);

  return {
    name: options.name || 'World Boss',
    hp,
    maxHp: hp,
    attack: stats.atk,
    defense: stats.armor,
    level,
    mechanics: ['AoE pulse', 'Enrage timer'],
    enrage: BOSS_MECHANICS.raidBoss,
    scheduledTime: options.scheduledTime || null,
    duration: options.duration || DEFAULT_DURATION_MS,
    rewards: {
      gold: Math.floor(500 + level * 25),
      xpRewardMinutes: XP_SOURCES.raidClearMinutes,
      sampleClearXp: rewardXpFromMinutes(level, XP_SOURCES.raidClearMinutes),
      guaranteedLoot: 'legendary'
    },
    participants: [],
    status: 'active',
    startedAt: Date.now(),
    balanceVersion: 1
  };
}

/** Plausible damage per damage-report tick (~3s of combat at 2s swing). */
export function maxPlausibleDamageReport(heroLevel, classKey = 'berserker') {
  const L = Math.min(100, Math.max(1, Math.floor(heroLevel || 1)));
  const combat = deriveHeroCombatStats({
    role: 'dps',
    classKey,
    level: L,
    gearRarity: 'epic',
    itemLevel: L
  });
  const hit = combat.attack * COMBAT_CAPS.critMultiplier;
  const swingsInWindow = 2;
  return Math.floor(hit * swingsInWindow * 1.15 + 50);
}
