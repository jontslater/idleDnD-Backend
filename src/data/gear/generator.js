import { GEAR_RARITY_R } from '../balance.js';
import { itemBudget, STAT_COST, GEAR_SECONDARY_CAPS, budgetFromStats } from './budget.js';
import { pickBaseForRoll } from './bases.js';
import { PREFIXES, suffixesForRole } from './affixes.js';
import { ilvlFromSource } from './ilvl.js';
import { pickLegendary } from './legendaries.js';
import { getSetById } from './sets.js';
import { materialForIlvl } from './materials.js';
import { seededRandom } from './rng.js';
import { bindingForGeneratedGear } from '../../utils/itemBinding.js';
import { legacyTargetsForItem, normalizeRoleGroup } from './planLegacy.js';

const RARITY_COLORS = {
  common: '#9d9d9d',
  uncommon: '#1eff00',
  rare: '#0070dd',
  epic: '#a335ee',
  legendary: '#ff8000',
  mythic: '#e60000'
};

function applyAffixes(stats, budget, roleGroup, rarity, prefix, suffix) {
  const affixes = [];
  if (prefix) {
    affixes.push({ id: prefix.id, kind: 'prefix', stats: { [prefix.stat]: budget * (prefix.shift || 0.1) } });
  }
  if (suffix) {
    affixes.push({ id: suffix.id, kind: 'suffix', label: suffix.label, stats: suffix.stats });
  }
  return affixes;
}

function statsFromLegacy(legacy, roleGroup, budget) {
  const role = normalizeRoleGroup(roleGroup);
  const stats = { power: 0, spellPower: 0, armor: 0, stamina: 0, crit: 0, haste: 0, recovery: 0 };
  stats.armor = legacy.defense;
  stats.stamina = Math.max(1, Math.floor(legacy.hp / 10));
  if (role === 'healer') {
    stats.spellPower = Math.max(1, legacy.attack * 2);
  } else {
    stats.power = Math.max(1, legacy.attack);
  }
  const spent = budgetFromStats(stats);
  if (spent > 0 && spent < budget * 0.9) {
    const scale = budget / spent;
    stats.power *= scale;
    stats.spellPower *= scale;
    stats.armor *= scale;
    stats.stamina *= scale;
  }
  return stats;
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

  const role = normalizeRoleGroup(roleGroup);
  let budget = itemBudget({ roleGroup: role, slot, ilvl, rarity, isSetPiece });

  const legacy = legacyTargetsForItem(role, slot, ilvl, rarity);
  let stats = statsFromLegacy(legacy, role, budget);
  const affixes = applyAffixes(stats, budget, role, rarity, prefix, suffix);

  let legendary = null;
  if (legendaryId) {
    legendary = pickLegendary(roleGroup, slot);
  } else if (rarity === 'legendary' || rarity === 'mythic') {
    if (rnd() < 0.35) legendary = pickLegendary(roleGroup, slot, rnd());
  }

  const set = setId ? getSetById(setId) : null;
  const legendaryResolved = legendary?.id || legendaryId || null;
  const name = buildName(base, prefix, suffix, material);
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
