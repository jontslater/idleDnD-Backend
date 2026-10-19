/**
 * Single source of truth for combat, progression, and economy formulas (backend).
 * Mirror for FE: import data/balance.json or GET /api/balance
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DROP_RATES, PITY_CONFIG, KILL_DROP_CHANCES } from './lootConfig.js';
import { ROLE_CONFIG } from './roleConfig.js';
import {
  ROLE_ACTIVE_ABILITIES,
  CLASS_ACTIVE_OVERRIDES,
  buildResolvedActiveAbilitiesByClass,
  SKILL_BALANCE_CAPS
} from './skillDefinitions.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const BALANCE_VERSION = 1;

/** Jonathan-approved pace: ~175 idle hours to L100 */
export const XP_LEVEL_COEFFICIENT = 60;

export const SWING_TIMER_MS = 2000;

export const G_PER_LEVEL = 0.1;

export function g(L) {
  const level = Math.max(1, Math.floor(L || 1));
  return 1 + G_PER_LEVEL * (level - 1);
}

export function xpToNextLevel(level) {
  const L = Math.max(1, Math.floor(level || 1));
  if (L >= 100) return 0;
  return Math.floor(XP_LEVEL_COEFFICIENT * g(L) * Math.pow(L, 1.13));
}

export const ROLE_BASE_STATS = {
  tank: { hp: 400, atk: 20, spellPower: 0, armor: 300, crit: 0.05 },
  healer: { hp: 250, atk: 14, spellPower: 20, armor: 120, crit: 0.05 },
  dps: { hp: 260, atk: 32, spellPower: 0, armor: 100, crit: 0.1 }
};

export const GEAR_RARITY_R = {
  common: 1.0,
  uncommon: 1.15,
  rare: 1.35,
  epic: 1.6,
  legendary: 1.9,
  mythic: 2.25
};

export const GEAR_SET_CRIT_PERCENT = {
  common: 0,
  uncommon: 2,
  rare: 5,
  epic: 8,
  legendary: 12,
  mythic: 15
};

export const GEAR_BUDGET_FRACTION = 0.4;

export const COMBAT_CAPS = {
  damageReduction: 0.75,
  critChance: 0.35,
  critMultiplier: 1.5,
  cooldownReductionPercent: SKILL_BALANCE_CAPS.cooldownReductionPercent,
  chatDamageHealBonusCap: 0.2,
  chatLootRarityBonusCap: 0.05,
  winStreakDifficultyCap: 1.25,
  waveTierBonusCap: 0.25
};

export const ARMOR_DR_K = 400;

export function damageReductionFromArmor(armor, attackerLevel) {
  const ar = Math.max(0, armor || 0);
  const dr = ar / (ar + ARMOR_DR_K * g(attackerLevel || 1));
  return Math.min(COMBAT_CAPS.damageReduction, dr);
}

export function rollDamageVariance() {
  return 0.9 + Math.random() * 0.2;
}

/**
 * @param {object} opts
 */
export function calculateDamage({
  attack,
  abilityMult = 1,
  chatMult = 1,
  targetArmor = 0,
  attackerLevel = 1,
  critChance = 0,
  forceCrit = false
}) {
  const cappedCrit = Math.min(COMBAT_CAPS.critChance, critChance);
  const isCrit = forceCrit || Math.random() < cappedCrit;
  const dr = damageReductionFromArmor(targetArmor, attackerLevel);
  let dmg = attack * abilityMult * chatMult * (1 - dr) * rollDamageVariance();
  if (isCrit) dmg *= COMBAT_CAPS.critMultiplier;
  return Math.max(1, Math.floor(dmg));
}

export function calculateHeal({ spellPower, chatMult = 1, crit = false }) {
  let heal = spellPower * 3.0 * chatMult;
  if (crit) heal *= COMBAT_CAPS.critMultiplier;
  return Math.floor(heal);
}

export const ENEMY_BASE = { hp: 900, atk: 40, armor: 150 };

export function enemyStats(level, kind = 'normal', partySize = 5) {
  const L = Math.max(1, Math.floor(level));
  const scale = g(L);
  const base = {
    hp: Math.floor(ENEMY_BASE.hp * scale),
    atk: Math.floor(ENEMY_BASE.atk * scale),
    armor: Math.floor(ENEMY_BASE.armor * scale)
  };
  if (kind === 'elite') {
    base.hp = Math.floor(base.hp * 3);
    base.atk = Math.floor(base.atk * 1.3);
    base.armor = Math.floor(base.armor * 1.2);
  } else if (kind === 'dungeonBoss') {
    base.hp = Math.floor(base.hp * 8);
    base.atk = Math.floor(base.atk * 2.6);
    base.armor = Math.floor(base.armor * 1.3);
  } else if (kind === 'raidBoss') {
    const partyScale = partySize / 5;
    base.hp = Math.floor(base.hp * 24 * partyScale);
    base.atk = Math.floor(base.atk * 3.2);
    base.armor = Math.floor(base.armor * 1.5);
  }
  return base;
}

export const BOSS_MECHANICS = {
  dungeonBoss: { aoeIntervalSec: 12, aoeAttackMult: 0.5 },
  raidBoss: {
    aoeIntervalSec: 10,
    aoeAttackMult: 0.6,
    enrageAfterSec: 360,
    enrageAttackBonusEverySec: 10,
    enrageAttackBonusPercent: 0.1
  }
};

export const CHAT_BOOST = {
  activeWindowMs: 10 * 60 * 1000,
  damageHealPerChatter: 0.02,
  damageHealCap: COMBAT_CAPS.chatDamageHealBonusCap,
  lootRarityPerChatter: 0.005,
  lootRarityCap: COMBAT_CAPS.chatLootRarityBonusCap
};

export function chatDamageHealMultiplier(activeChatters) {
  const n = Math.max(0, activeChatters || 0);
  return 1 + Math.min(CHAT_BOOST.damageHealCap, CHAT_BOOST.damageHealPerChatter * n);
}

export function chatLootRarityBonus(activeChatters) {
  const n = Math.max(0, activeChatters || 0);
  return Math.min(CHAT_BOOST.lootRarityCap, CHAT_BOOST.lootRarityPerChatter * n);
}

export const XP_SOURCES = {
  idleKillNormal: (L) => Math.floor(12 * g(L)),
  eliteMult: 3,
  bossMult: 10,
  dungeonClearMinutes: 15,
  raidClearMinutes: 45,
  dailyQuestMinutes: 20,
  killsPerHourIdle: 240
};

export function idleXpPerHour(level) {
  return XP_SOURCES.killsPerHourIdle * XP_SOURCES.idleKillNormal(level);
}

export function rewardXpFromMinutes(level, minutes) {
  const perMinute = idleXpPerHour(level) / 60;
  return Math.floor(perMinute * minutes);
}

export const LOOT_POLICY = {
  normalKillDropChance: KILL_DROP_CHANCES.normal,
  eliteKillDropChance: KILL_DROP_CHANCES.elite,
  dropTables: DROP_RATES,
  pity: PITY_CONFIG
};

export const HP_REGEN = {
  onlyBetweenFights: true,
  fullHealDurationMs: 3000
};

export const LEVEL_BANDS = {
  idle: { min: 1, max: 100 },
  dungeon: [
    { id: 'goblin_cave', min: 10, max: 20 },
    { id: 'ancient_catacombs', min: 15, max: 30 },
    { id: 'demon_ruins', min: 25, max: 45 },
    { id: 'shadow_depths', min: 40, max: 60 },
    { id: 'dragon_spire', min: 55, max: 80 },
    { id: 'void_citadel', min: 75, max: 100 }
  ],
  raid: [
    { id: 'corrupted_temple', min: 20, max: 40, minItemLevel: 25 },
    { id: 'dragons_lair', min: 35, max: 55, minItemLevel: 40 },
    { id: 'elder_dragon_heroic', min: 50, max: 75, minItemLevel: 55 },
    { id: 'elder_dragon_mythic', min: 70, max: 100, minItemLevel: 70 }
  ]
};

export function clampLevelToBand(avgPartyLevel, band) {
  const L = Math.floor(avgPartyLevel || 1);
  return Math.min(band.max, Math.max(band.min, L));
}

/** Class flavor ratios ±10% vs role average (from legacy ROLE_CONFIG). */
export function getClassStatRatios(classKey) {
  const cfg = ROLE_CONFIG[classKey];
  if (!cfg) return { hp: 1, atk: 1, armor: 1 };
  const cat = cfg.category || 'dps';
  const roleAvg = {
    tank: { hp: 205, atk: 9.5, def: 15 },
    healer: { hp: 100, atk: 6.5, def: 7 },
    dps: { hp: 125, atk: 16.5, def: 4.5 }
  }[cat];
  const clamp = (ratio) => Math.min(1.1, Math.max(0.9, ratio));
  return {
    hp: clamp(cfg.baseHp / roleAvg.hp),
    atk: clamp(cfg.baseAttack / roleAvg.atk),
    armor: clamp(cfg.baseDefense / roleAvg.def)
  };
}

export function deriveHeroCombatStats({ role, classKey, level, gearRarity = 'common', itemLevel }) {
  const cat = ROLE_CONFIG[classKey]?.category || role || 'dps';
  const base = ROLE_BASE_STATS[cat] || ROLE_BASE_STATS.dps;
  const ratios = getClassStatRatios(classKey || 'berserker');
  const L = Math.max(1, level || 1);
  const ilvl = itemLevel || L;
  const R = GEAR_RARITY_R[gearRarity] || 1;
  const f = GEAR_BUDGET_FRACTION;
  const scale = (v) => v * g(L) + f * R * v * g(ilvl);
  const critGear = (GEAR_SET_CRIT_PERCENT[gearRarity] || 0) / 100;
  return {
    maxHp: Math.floor(scale(base.hp) * ratios.hp),
    attack: Math.floor(scale(base.atk) * ratios.atk),
    armor: Math.floor(scale(base.armor) * ratios.armor),
    spellPower: base.spellPower ? Math.floor(scale(base.spellPower)) : 0,
    critChance: Math.min(COMBAT_CAPS.critChance, base.crit + critGear),
    swingMs: SWING_TIMER_MS
  };
}

export function buildBalancePayload() {
  return {
    version: BALANCE_VERSION,
    xpLevelCoefficient: XP_LEVEL_COEFFICIENT,
    formulas: {
      g: `1 + ${G_PER_LEVEL} * (L - 1)`,
      xpToNext: `floor(${XP_LEVEL_COEFFICIENT} * g(L) * L^1.13)`,
      damageReduction: `min(${COMBAT_CAPS.damageReduction}, armor / (armor + ${ARMOR_DR_K} * g(L_attacker)))`,
      damage: 'ATK * abilityMult * chatMult * (1 - DR) * U(0.9,1.1) * (crit ? 1.5 : 1)',
      heal: 'spellPower * 3.0 * chatMult * (crit ? 1.5 : 1)',
      chatMult: `1 + min(${CHAT_BOOST.damageHealCap}, ${CHAT_BOOST.damageHealPerChatter} * activeChatters)`
    },
    g,
    xpToNextLevel,
    roleBaseStats: ROLE_BASE_STATS,
    gear: { rarityR: GEAR_RARITY_R, budgetFraction: GEAR_BUDGET_FRACTION, setCritPercent: GEAR_SET_CRIT_PERCENT },
    combatCaps: COMBAT_CAPS,
    armor: { K: ARMOR_DR_K, damageReductionFromArmor },
    enemyBase: ENEMY_BASE,
    enemyKinds: ['normal', 'elite', 'dungeonBoss', 'raidBoss'],
    bossMechanics: BOSS_MECHANICS,
    chatBoost: CHAT_BOOST,
    xpSources: XP_SOURCES,
    loot: LOOT_POLICY,
    hpRegen: HP_REGEN,
    swingTimerMs: SWING_TIMER_MS,
    levelBands: LEVEL_BANDS,
    skillCaps: SKILL_BALANCE_CAPS,
    activeAbilities: {
      byRole: ROLE_ACTIVE_ABILITIES,
      classOverrides: CLASS_ACTIVE_OVERRIDES,
      resolvedByClass: buildResolvedActiveAbilitiesByClass()
    },
    dropRates: DROP_RATES
  };
}

/** JSON-safe export (no functions). */
export function buildBalanceJsonObject() {
  const p = buildBalancePayload();
  const { g: _g, armor, ...rest } = p;
  return {
    ...rest,
    armor: { K: ARMOR_DR_K },
    sampleXpToNext: { 10: xpToNextLevel(10), 25: xpToNextLevel(25), 50: xpToNextLevel(50), 99: xpToNextLevel(99) },
    sampleDr: {
      tankRare: damageReductionFromArmor(deriveHeroCombatStats({ role: 'tank', classKey: 'guardian', level: 25, gearRarity: 'rare', itemLevel: 25 }).armor, 25),
      enemy150: damageReductionFromArmor(150 * g(25), 25)
    }
  };
}

const JSON_PATH = path.resolve(__dirname, '../../data/balance.json');

export function writeBalanceJson(targetPath = JSON_PATH) {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${JSON.stringify(buildBalanceJsonObject(), null, 2)}\n`, 'utf8');
  return targetPath;
}

export function getBalanceJsonPath() {
  return JSON_PATH;
}

export function maxXpGainPerMinute(level) {
  const perHour = idleXpPerHour(level);
  return Math.ceil((perHour / 60) * 3);
}

export function maxGoldGainPerMinute(_level = 1) {
  return Math.ceil(5000 / 60) * 3;
}

/** Authoritative per-kill XP (idle overlay should match). */
export function combatKillBaseXp(enemyLevel, kind = 'normal') {
  let xp = XP_SOURCES.idleKillNormal(enemyLevel);
  if (kind === 'elite') xp *= XP_SOURCES.eliteMult;
  else if (kind === 'boss') xp *= XP_SOURCES.bossMult;
  return Math.floor(xp);
}

export function dungeonClearXp(heroLevel, minutes = XP_SOURCES.dungeonClearMinutes) {
  return rewardXpFromMinutes(heroLevel, minutes);
}

export function raidClearXp(heroLevel, minutes = XP_SOURCES.raidClearMinutes) {
  return rewardXpFromMinutes(heroLevel, minutes);
}

export function questXpForMinutes(heroLevel, minutes) {
  return rewardXpFromMinutes(heroLevel, minutes);
}

export function scaleRaidBoss(boss, partyLevel, partySize = 5) {
  if (!boss) return boss;
  const L = Math.max(1, Math.floor(partyLevel || boss.level || 1));
  const stats = enemyStats(L, 'raidBoss', partySize);
  return {
    ...boss,
    level: L,
    hp: stats.hp,
    attack: stats.atk,
    defense: stats.armor,
    balanceScaled: true,
    enrage: BOSS_MECHANICS.raidBoss
  };
}

export function getMinItemLevelForRaid(raidId) {
  const band = LEVEL_BANDS.raid.find((b) => b.id === raidId);
  return band?.minItemLevel ?? null;
}

export function cumulativeIdleHoursToLevel(targetLevel) {
  let totalXp = 0;
  let hours = 0;
  for (let L = 1; L < targetLevel; L++) {
    const need = xpToNextLevel(L);
    const rate = idleXpPerHour(L);
    hours += need / rate;
    totalXp += need;
  }
  return { hours, totalXp };
}
