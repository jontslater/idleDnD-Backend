/**
 * Canonical skill tree + active ability definitions (single source of truth).
 * IDs: {class}_skill_1 .. {class}_skill_10
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const SKILL_BALANCE_CAPS = {
  cooldownReductionPercent: 40,
  critChancePercent: 75,
  damageReductionPercent: 75
};

export const SKILL_EFFECT_TYPES = {
  STAT_BOOST: 'stat_boost',
  HP_PERCENT_MAX: 'hp_percent_max',
  DAMAGE_MULTIPLIER: 'damage_mult',
  HEALING_MULTIPLIER: 'healing_mult',
  DEFENSE_MULTIPLIER: 'defense_mult',
  CRIT_CHANCE: 'crit_chance',
  CRIT_DAMAGE: 'crit_damage',
  COOLDOWN_REDUCTION: 'cooldown_red',
  LIFESTEAL: 'lifesteal',
  SPEED_BOOST: 'speed_boost',
  DOUBLE_HEAL_PROC: 'double_heal_proc'
};

const UNLOCK_LEVELS = [5, 7, 9, 11, 13, 15, 17, 19, 21, 23];
export const MAX_SKILL_RANK = 5;

const tankTemplates = [
  { name: 'Fortitude', effect: SKILL_EFFECT_TYPES.HP_PERCENT_MAX, baseValue: 2, description: '+2% max HP per rank' },
  { name: 'Iron Will', effect: SKILL_EFFECT_TYPES.DEFENSE_MULTIPLIER, baseValue: 3, description: 'Reduces damage taken (+3% DR per rank)' },
  { name: 'Shield Mastery', effect: SKILL_EFFECT_TYPES.STAT_BOOST, stat: 'defense', baseValue: 4, description: '+4% defense per rank' },
  { name: 'Threat Generation', effect: SKILL_EFFECT_TYPES.STAT_BOOST, stat: 'attack', baseValue: 2, description: '+2% attack per rank (threat)' },
  { name: 'Last Stand', effect: SKILL_EFFECT_TYPES.DEFENSE_MULTIPLIER, baseValue: 5, description: 'Bonus damage reduction (+5% DR per rank)' },
  { name: 'Taunt Mastery', effect: SKILL_EFFECT_TYPES.COOLDOWN_REDUCTION, baseValue: 8, description: '−8% active cooldown per rank (capped)' },
  { name: 'Armor Expertise', effect: SKILL_EFFECT_TYPES.STAT_BOOST, stat: 'defense', baseValue: 6, description: '+6% defense per rank' },
  { name: 'Guardian Stance', effect: SKILL_EFFECT_TYPES.DEFENSE_MULTIPLIER, baseValue: 4, description: '+4% DR per rank' },
  { name: 'Unbreakable', effect: SKILL_EFFECT_TYPES.HP_PERCENT_MAX, baseValue: 3, description: '+3% max HP per rank' },
  { name: 'Protector', effect: SKILL_EFFECT_TYPES.DEFENSE_MULTIPLIER, baseValue: 6, description: 'Ultimate: +6% DR per rank' }
];

const healerTemplates = [
  { name: 'Healing Touch', effect: SKILL_EFFECT_TYPES.HEALING_MULTIPLIER, baseValue: 5, description: '+5% healing per rank' },
  { name: 'Mana Efficiency', effect: SKILL_EFFECT_TYPES.COOLDOWN_REDUCTION, baseValue: 8, description: '−8% cooldown per rank (capped)' },
  { name: 'Divine Grace', effect: SKILL_EFFECT_TYPES.DOUBLE_HEAL_PROC, baseValue: 6, description: '6% chance per rank to double a heal (requires this skill)' },
  { name: 'Rapid Recovery', effect: SKILL_EFFECT_TYPES.SPEED_BOOST, baseValue: 10, description: '+10% cast speed per rank' },
  { name: 'Group Heal', effect: SKILL_EFFECT_TYPES.HEALING_MULTIPLIER, baseValue: 6, description: '+6% AoE healing per rank' },
  { name: 'Cleanse', effect: SKILL_EFFECT_TYPES.COOLDOWN_REDUCTION, baseValue: 10, description: '−10% cleanse cooldown per rank (capped)' },
  { name: 'Overheal', effect: SKILL_EFFECT_TYPES.HEALING_MULTIPLIER, baseValue: 5, description: '+5% healing per rank (overheal → shield when wired on client)' },
  { name: 'Resurrection Mastery', effect: SKILL_EFFECT_TYPES.COOLDOWN_REDUCTION, baseValue: 12, description: '−12% res cooldown per rank (capped)' },
  { name: 'Divine Shield', effect: SKILL_EFFECT_TYPES.STAT_BOOST, stat: 'defense', baseValue: 3, description: '+3% defense per rank' },
  { name: 'Master Healer', effect: SKILL_EFFECT_TYPES.HEALING_MULTIPLIER, baseValue: 8, description: 'Ultimate: +8% healing per rank' }
];

const dpsTemplates = [
  { name: 'Power Strike', effect: SKILL_EFFECT_TYPES.DAMAGE_MULTIPLIER, baseValue: 5, description: '+5% damage per rank' },
  { name: 'Critical Hit', effect: SKILL_EFFECT_TYPES.CRIT_CHANCE, baseValue: 3, description: '+3% crit chance per rank (capped)' },
  { name: 'Lethal Blow', effect: SKILL_EFFECT_TYPES.CRIT_DAMAGE, baseValue: 10, description: '+10% crit damage bonus per rank (over ×2 base)' },
  { name: 'Combat Mastery', effect: SKILL_EFFECT_TYPES.STAT_BOOST, stat: 'attack', baseValue: 4, description: '+4% attack per rank' },
  { name: 'Fury', effect: SKILL_EFFECT_TYPES.SPEED_BOOST, baseValue: 8, description: '+8% attack speed per rank' },
  { name: 'Execution', effect: SKILL_EFFECT_TYPES.DAMAGE_MULTIPLIER, baseValue: 6, description: '+6% damage per rank' },
  { name: 'Precision', effect: SKILL_EFFECT_TYPES.CRIT_CHANCE, baseValue: 5, description: '+5% crit chance per rank (capped)' },
  { name: 'Berserker Rage', effect: SKILL_EFFECT_TYPES.DAMAGE_MULTIPLIER, baseValue: 7, description: '+7% damage per rank' },
  { name: 'Bloodlust', effect: SKILL_EFFECT_TYPES.LIFESTEAL, baseValue: 5, description: '+5% lifesteal per rank' },
  { name: 'Master Assassin', effect: SKILL_EFFECT_TYPES.DAMAGE_MULTIPLIER, baseValue: 10, description: 'Ultimate: +10% damage per rank' }
];

export const GAME_CLASSES = [
  { key: 'guardian', name: 'Shield Guardian', cat: 'tank' },
  { key: 'paladin', name: 'Holy Defender', cat: 'tank' },
  { key: 'warden', name: 'Wild Warden', cat: 'tank' },
  { key: 'bloodknight', name: 'Blood Knight', cat: 'tank' },
  { key: 'vanguard', name: 'Agile Vanguard', cat: 'tank' },
  { key: 'brewmaster', name: 'Brewed Monk', cat: 'tank' },
  { key: 'cleric', name: 'Cleric', cat: 'healer' },
  { key: 'atoner', name: 'Atoner', cat: 'healer' },
  { key: 'druid', name: 'Restoration Druid', cat: 'healer' },
  { key: 'lightbringer', name: 'Lightbringer', cat: 'healer' },
  { key: 'shaman', name: 'Spirit Healer', cat: 'healer' },
  { key: 'mistweaver', name: 'Mistweaver', cat: 'healer' },
  { key: 'chronomancer', name: 'Chronomender', cat: 'healer' },
  { key: 'bard', name: 'Bard', cat: 'healer' },
  { key: 'berserker', name: 'Berserker', cat: 'dps' },
  { key: 'crusader', name: 'Crusader', cat: 'dps' },
  { key: 'assassin', name: 'Assassin', cat: 'dps' },
  { key: 'reaper', name: 'Reaper', cat: 'dps' },
  { key: 'bladedancer', name: 'Blade Dancer', cat: 'dps' },
  { key: 'monk', name: 'Chi Fighter', cat: 'dps' },
  { key: 'stormwarrior', name: 'Storm Warrior', cat: 'dps' },
  { key: 'hunter', name: 'Beast Stalker', cat: 'dps' },
  { key: 'mage', name: 'Elementalist', cat: 'dps' },
  { key: 'warlock', name: 'Warlock', cat: 'dps' },
  { key: 'ranger', name: 'Marksman', cat: 'dps' },
  { key: 'shadowpriest', name: 'Dark Oracle', cat: 'dps' },
  { key: 'mooncaller', name: 'Mooncaller', cat: 'dps' },
  { key: 'stormcaller', name: 'Stormcaller', cat: 'dps' },
  { key: 'dragonsorcerer', name: 'Draconic Sorcerer', cat: 'dps' }
];

/**
 * Role-wide active abilities (every hero uses their role default unless overridden).
 * Cooldown reduction from skills applies to cooldownMs (see applyActiveCooldownMs).
 */
export const ROLE_ACTIVE_ABILITIES = {
  tank: {
    id: 'shieldWall',
    name: 'Shield Wall',
    role: 'tank',
    cooldownMs: 45000,
    effect: {
      type: 'self_damage_reduction_taunt',
      damageReductionPercent: 50,
      durationMs: 6000,
      taunt: true
    }
  },
  healer: {
    id: 'groupHeal',
    name: 'Group Heal',
    role: 'healer',
    cooldownMs: 30000,
    effect: {
      type: 'aoe_heal_percent_caster_max_hp',
      healPercentOfCasterMaxHp: 25,
      scalesWithHealingMultiplier: true
    }
  },
  dps: {
    id: 'burstStrike',
    name: 'Burst Strike',
    role: 'dps',
    cooldownMs: 20000,
    effect: {
      type: 'single_target_attack_multiplier',
      attackDamagePercent: 300,
      canCrit: true
    }
  }
};

/**
 * Optional per-class active override. Omit a class or set null to use ROLE_ACTIVE_ABILITIES[category].
 * Legacy overlay actives that differ from the role default remain here until class-specific trees ship.
 */
export const CLASS_ACTIVE_OVERRIDES = {
  shaman: {
    id: 'chainLightning',
    name: 'Chain Lightning',
    role: 'healer',
    cooldownMs: 15000,
    effect: {
      type: 'chain_damage',
      description: 'Legacy overlay active; hits multiple enemies (client resolves targets).'
    }
  },
  berserker: {
    id: 'whirlwind',
    name: 'Whirlwind',
    role: 'dps',
    cooldownMs: 20000,
    effect: {
      type: 'aoe_damage',
      description: 'Legacy overlay active; AoE around self (client resolves radius).'
    }
  }
};

export function getClassCategory(classKey) {
  const cls = GAME_CLASSES.find((c) => c.key === classKey);
  return cls?.cat ?? null;
}

/** Resolved active for a hero class (override or role default). */
export function getActiveAbilityForClass(classKey) {
  const override = CLASS_ACTIVE_OVERRIDES[classKey];
  if (override) return override;
  const category = getClassCategory(classKey);
  if (!category) return null;
  return ROLE_ACTIVE_ABILITIES[category] ?? null;
}

/** Map every backend class to its effective active (for front-end import). */
export function buildResolvedActiveAbilitiesByClass() {
  const byClass = {};
  for (const cls of GAME_CLASSES) {
    byClass[cls.key] = getActiveAbilityForClass(cls.key);
  }
  return byClass;
}

/**
 * Effective cooldown after skill CDR (percent sum capped at SKILL_BALANCE_CAPS.cooldownReductionPercent).
 * @param {number} baseCooldownMs
 * @param {number} cooldownReductionPercent - total from skills (0–40 after cap)
 */
export function applyActiveCooldownMs(baseCooldownMs, cooldownReductionPercent = 0) {
  const cap = SKILL_BALANCE_CAPS.cooldownReductionPercent;
  const cdr = Math.min(Math.max(0, cooldownReductionPercent), cap);
  return Math.max(0, Math.floor(baseCooldownMs * (1 - cdr / 100)));
}

function templatesForCategory(cat) {
  if (cat === 'tank') return tankTemplates;
  if (cat === 'healer') return healerTemplates;
  return dpsTemplates;
}

export function valueAtRank(baseValue, rank) {
  return rank * baseValue;
}

function buildClassSkills(className, displayName, category) {
  const templates = templatesForCategory(category);
  return UNLOCK_LEVELS.map((unlockLevel, index) => {
    const template = templates[index];
    return {
      id: `${className}_skill_${index + 1}`,
      name: template.name,
      class: className,
      className: displayName,
      category,
      unlockLevel,
      effect: template.effect,
      stat: template.stat || null,
      baseValuePerRank: template.baseValue,
      maxPoints: MAX_SKILL_RANK,
      description: template.description
    };
  });
}

let cachedSkills = null;

export function getCanonicalSkillList() {
  if (cachedSkills) return cachedSkills;
  const all = [];
  for (const cls of GAME_CLASSES) {
    all.push(...buildClassSkills(cls.key, cls.name, cls.cat));
  }
  cachedSkills = all;
  return all;
}

export function getCanonicalSkillById(skillId) {
  return getCanonicalSkillList().find((s) => s.id === skillId);
}

export function getCanonicalSkillsForClass(className) {
  return getCanonicalSkillList().filter((s) => s.class === className);
}

export function buildPublicSkillDefinitionsPayload() {
  return {
    version: 1,
    skillPointFormula: {
      description: '1 skill point every 2 levels from 6 through 100 (48 max)',
      firstPointLevel: 6,
      interval: 2,
      maxLevel: 100
    },
    caps: SKILL_BALANCE_CAPS,
    effectTypes: SKILL_EFFECT_TYPES,
    critDamageNote: 'Crit damage skill values are a percent bonus over the base ×2 crit multiplier',
    skills: getCanonicalSkillList(),
    activeAbilities: {
      byRole: ROLE_ACTIVE_ABILITIES,
      classOverrides: CLASS_ACTIVE_OVERRIDES,
      resolvedByClass: buildResolvedActiveAbilitiesByClass()
    },
    cooldownReduction: {
      appliesTo: 'activeAbilities.cooldownMs',
      capPercent: SKILL_BALANCE_CAPS.cooldownReductionPercent,
      formula: 'effectiveCooldownMs = floor(baseCooldownMs * (1 - min(totalCdrPercent, cap) / 100))'
    }
  };
}

const JSON_EXPORT_PATH = path.resolve(__dirname, '../../data/skillDefinitions.json');

export function writeSkillDefinitionsJson(targetPath = JSON_EXPORT_PATH) {
  const payload = buildPublicSkillDefinitionsPayload();
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  return targetPath;
}

export function getSkillDefinitionsJsonPath() {
  return JSON_EXPORT_PATH;
}
