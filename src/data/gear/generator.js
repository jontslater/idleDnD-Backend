import { GEAR_RARITY_R } from '../balance.js';
import { itemBudget, STAT_COST, GEAR_SECONDARY_CAPS, budgetFromStats } from './budget.js';
import { pickBaseForRoll } from './bases.js';
import { PREFIXES, suffixesForRole } from './affixes.js';
import { ilvlFromSource } from './ilvl.js';
import { pickLegendary } from './legendaries.js';
import { getSetById } from './sets.js';
import { materialForIlvl } from './materials.js';
import { seededRandom, jitter } from './rng.js';
import { bindingForGeneratedGear } from '../../utils/itemBinding.js';

const RARITY_COLORS = {
  common: '#9d9d9d',
  uncommon: '#1eff00',
  rare: '#0070dd',
  epic: '#a335ee',
  legendary: '#ff8000',
  mythic: '#e60000'
};

const ARMOR_SLOTS = new Set(['armor', 'shield', 'helm', 'cloak', 'gloves', 'boots']);

function primarySecondaryPlan(roleGroup, slot = 'armor') {
  if (roleGroup === 'tank') {
    if (ARMOR_SLOTS.has(slot)) {
      return { primary: ['armor', 'stamina'], secondary: ['power', 'haste', 'recovery', 'crit'] };
    }
    return { primary: ['stamina', 'armor'], secondary: ['power', 'haste', 'recovery', 'crit'] };
  }
  if (roleGroup === 'healer') {
    return { primary: ['spellPower'], secondary: ['stamina', 'haste', 'recovery', 'crit'] };
  }
  if (roleGroup === 'caster') {
    return { primary: ['power'], secondary: ['crit', 'haste', 'recovery'] };
  }
  return { primary: ['power'], secondary: ['crit', 'haste', 'stamina'] };
}

/** Maps stat budget to legacy defense/attack fields the FE sums (BALANCE_PLAN scale). */
const LEGACY_BUDGET_TO_DEFENSE = 13.1 / STAT_COST.armor;

function allocateStats(budget, roleGroup, rnd, slot = 'armor') {
  const plan = primarySecondaryPlan(roleGroup, slot);
  const stats = { power: 0, spellPower: 0, armor: 0, stamina: 0, crit: 0, haste: 0, recovery: 0 };
  let remaining = budget;
  const primShare = 0.6;
  let primBudget = budget * primShare;
  for (const key of plan.primary) {
    const cost = STAT_COST[key] || 1;
    const val = (primBudget / plan.primary.length / cost) * jitter(0.03, rnd);
    stats[key] += val;
    remaining -= val * cost;
  }
  const secKeys = plan.secondary;
  for (const key of secKeys) {
    const cost = STAT_COST[key] || 1;
    const val = (remaining / secKeys.length / cost) * jitter(0.03, rnd);
    if (key === 'crit' || key === 'haste' || key === 'recovery') {
      stats[key] = Math.min(GEAR_SECONDARY_CAPS[key], val / 100);
    } else {
      stats[key] += val;
    }
    remaining -= val * cost;
  }
  const spent = budgetFromStats(stats);
  if (spent > 0) {
    const scale = budget / spent;
    for (const key of Object.keys(stats)) {
      stats[key] *= scale;
      if (key === 'crit' || key === 'haste' || key === 'recovery') {
        stats[key] = Math.min(GEAR_SECONDARY_CAPS[key], stats[key]);
      }
    }
  }
  return stats;
}

function applyAffixes(stats, budget, roleGroup, rarity, prefix, suffix, rnd) {
  const affixes = [];
  if (prefix) {
    const shift = budget * (prefix.shift || 0.1);
    stats[prefix.stat] = (stats[prefix.stat] || 0) + shift / (STAT_COST[prefix.stat] || 1);
    affixes.push({ id: prefix.id, kind: 'prefix', stats: { [prefix.stat]: shift } });
  }
  if (suffix) {
    const per = suffix.stats.length;
    for (const st of suffix.stats) {
      const portion = (budget * 0.15) / per;
      if (st === 'crit' || st === 'haste' || st === 'recovery') {
        stats[st] = Math.min(GEAR_SECONDARY_CAPS[st], (stats[st] || 0) + portion / 100 / (STAT_COST[st] || 1));
      } else {
        stats[st] = (stats[st] || 0) + portion / (STAT_COST[st] || 1);
      }
    }
    affixes.push({ id: suffix.id, kind: 'suffix', label: suffix.label, stats: suffix.stats });
  }
  return affixes;
}

function slotWeights(slot) {
  const armorSlot = ARMOR_SLOTS.has(slot);
  return {
    def: armorSlot ? 1 : slot === 'weapon' ? 0.2 : 0.12,
    atk: slot === 'weapon' ? 1 : ['ring1', 'ring2', 'accessory'].includes(slot) ? 0.22 : 0.1,
    hp: armorSlot ? 0.4 : 0.14
  };
}

function toLegacyCombatFields(stats, roleGroup, budget, slot) {
  const w = slotWeights(slot);
  let defense = Math.max(Math.floor(stats.armor || 0), Math.floor(budget * LEGACY_BUDGET_TO_DEFENSE * w.def));
  let attack = Math.floor(roleGroup === 'healer' ? stats.spellPower * 0.5 : stats.power);
  attack = Math.max(attack, Math.floor(budget * 0.38 * w.atk));
  let hp = Math.max(Math.floor(stats.stamina * 10), Math.floor(budget * 0.52 * w.hp));
  if (roleGroup === 'healer') {
    attack = Math.max(attack, Math.floor(budget * 0.32 * w.atk));
    hp = Math.max(hp, Math.floor(budget * 0.48 * w.hp));
  }
  if (roleGroup === 'tank' && ARMOR_SLOTS.has(slot)) {
    defense = Math.max(defense, Math.floor(budget * LEGACY_BUDGET_TO_DEFENSE));
    hp = Math.max(hp, Math.floor(budget * 0.55 * w.hp));
  }
  const floorSum = budget * 0.32;
  const sum = attack + defense + hp;
  if (sum < floorSum && sum > 0) {
    const scale = floorSum / sum;
    attack = Math.floor(attack * scale);
    defense = Math.floor(defense * scale);
    hp = Math.floor(hp * scale);
  }
  return { attack, defense, hp };
}

function enforceBudgetFloor(stats, budget) {
  const spent = budgetFromStats(stats);
  if (spent <= 0 || spent >= budget * 0.92) return stats;
  const scale = (budget * 0.95) / spent;
  const out = { ...stats };
  for (const key of Object.keys(out)) {
    out[key] *= scale;
    if (key === 'crit' || key === 'haste' || key === 'recovery') {
      out[key] = Math.min(GEAR_SECONDARY_CAPS[key], out[key]);
    }
  }
  return out;
}

function buildName(base, prefix, suffix, material) {
  const parts = [];
  if (prefix) parts.push(prefix.label);
  const stem = `${material} ${base.nameStem}`.trim();
  const words = new Set();
  for (const token of stem.split(/\s+/)) {
    const lower = token.toLowerCase();
    if (!words.has(lower)) {
      words.add(lower);
      parts.push(token);
    }
  }
  if (suffix) parts.push(`of ${suffix.label}`);
  return parts.join(' ');
}

/**
 * @param {object} opts
 */
export function generateGearItem(opts) {
  const {
    roleGroup,
    slot,
    rarity,
    source = {},
    seed = `${Date.now()}-${Math.random()}`,
    setId = null,
    legendaryId = null,
    isSetPiece = false
  } = opts;

  const rnd = seededRandom(seed);
  const ilvl = opts.ilvl ?? ilvlFromSource(source);
  const reqLevel = Math.max(1, ilvl - 5);
  const base = pickBaseForRoll(roleGroup, slot, ilvl);
  const material = materialForIlvl(roleGroup, ilvl);

  let prefix = null;
  let suffix = null;
  if (rarity === 'uncommon' || rarity === 'rare' || rarity === 'epic' || rarity === 'legendary' || rarity === 'mythic') {
    const pool = suffixesForRole(roleGroup);
    suffix = pool[Math.floor(rnd() * pool.length)];
  }
  if (['rare', 'epic', 'legendary', 'mythic'].includes(rarity)) {
    prefix = PREFIXES[Math.floor(rnd() * PREFIXES.length)];
  }

  let budget = itemBudget({ roleGroup, slot, ilvl, rarity, isSetPiece });
  if (legendaryId || rarity === 'legendary' || rarity === 'mythic') {
    budget *= 0.94;
  }

  let stats = allocateStats(budget, roleGroup, rnd, slot);
  const affixes = applyAffixes(stats, budget, roleGroup, rarity, prefix, suffix, rnd);
  stats = enforceBudgetFloor(stats, budget);
  const spent = budgetFromStats(stats);
  if (spent > 0 && spent > budget * 1.05) {
    const scale = budget / spent;
    for (const key of Object.keys(stats)) {
      if (key === 'crit' || key === 'haste' || key === 'recovery') {
        stats[key] *= scale;
      } else {
        stats[key] *= scale;
      }
    }
  }

  let legendary = null;
  if (legendaryId) {
    legendary = pickLegendary(roleGroup, slot);
  } else if (rarity === 'legendary' || rarity === 'mythic') {
    if (rnd() < 0.35) legendary = pickLegendary(roleGroup, slot, rnd());
  }

  const set = setId ? getSetById(setId) : null;
  const legendaryResolved = legendary?.id || legendaryId || null;
  const name = buildName(base, prefix, suffix, material);
  const legacy = toLegacyCombatFields(stats, roleGroup, budget, slot);
  const id = `gear_${seed.replace(/[^a-zA-Z0-9]/g, '').slice(0, 24)}`;
  const binding = bindingForGeneratedGear({
    source,
    setId: set?.id || setId,
    isSetPiece,
    legendaryId: legendaryResolved,
    rarity
  });

  return {
    id,
    baseId: base.id,
    name,
    slot,
    armorType: base.armorType,
    ilvl,
    level: ilvl,
    reqLevel,
    rarity,
    color: RARITY_COLORS[rarity] || RARITY_COLORS.common,
    stats: {
      power: Math.floor(stats.power || 0),
      spellPower: Math.floor(stats.spellPower || 0),
      armor: Math.floor(stats.armor || 0),
      stamina: Math.floor(stats.stamina || 0),
      crit: Math.round((stats.crit || 0) * 1000) / 1000,
      haste: Math.round((stats.haste || 0) * 1000) / 1000,
      recovery: Math.round((stats.recovery || 0) * 1000) / 1000
    },
    affixes,
    setId: set?.id || setId || null,
    setName: set?.name || null,
    legendaryId: legendaryResolved,
    legendaryEffect: legendary?.description || null,
    uniqueEquipped: legendary ? true : undefined,
    binding,
    source,
    isSetPiece,
    attack: legacy.attack,
    defense: legacy.defense,
    hp: legacy.hp,
    forRole: roleGroup,
    seed
  };
}

export function totalStatBudgetFromItem(item) {
  const s = item.stats || {};
  return (
    (s.power || 0) * STAT_COST.power +
    (s.spellPower || 0) * STAT_COST.spellPower +
    (s.armor || 0) * STAT_COST.armor +
    (s.stamina || 0) * STAT_COST.stamina +
    (s.crit || 0) * 100 * STAT_COST.crit +
    (s.haste || 0) * 100 * STAT_COST.haste +
    (s.recovery || 0) * 100 * STAT_COST.recovery
  );
}
