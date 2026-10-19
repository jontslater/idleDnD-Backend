import { GEAR_RARITY_R, g } from '../balance.js';
import { itemBudget } from './budget.js';
import { GEAR_SLOTS } from './bases.js';

/** BALANCE_PLAN full-set legacy totals at ilvl 50, common rarity. */
export const PLAN_L50_COMMON = {
  tank: { attack: 47, defense: 708, hp: 944 },
  healer: { attack: 47, defense: 283, hp: 590 },
  melee: { attack: 76, defense: 236, hp: 614 },
  caster: { attack: 76, defense: 236, hp: 614 },
  ranged: { attack: 76, defense: 236, hp: 614 }
};

export function normalizeRoleGroup(roleGroup) {
  if (roleGroup === 'ranged') return 'melee';
  return roleGroup;
}

export function slotsForRoleGroup(roleGroup) {
  const role = normalizeRoleGroup(roleGroup);
  return role === 'tank' ? GEAR_SLOTS : GEAR_SLOTS.filter((s) => s !== 'shield');
}

function fullSetItemBudgetSum(roleGroup, ilvl, rarity) {
  const role = normalizeRoleGroup(roleGroup);
  const slots = slotsForRoleGroup(role);
  return slots.reduce(
    (sum, slot) => sum + itemBudget({ roleGroup: role, slot, ilvl, rarity, isSetPiece: false }),
    0
  );
}

export function planFullSetLegacyTotals(roleGroup, ilvl, rarity) {
  const role = normalizeRoleGroup(roleGroup);
  const base = PLAN_L50_COMMON[role] || PLAN_L50_COMMON.melee;
  const R = GEAR_RARITY_R[rarity] || 1;
  const levelScale = g(ilvl) / g(50);
  const commonR = GEAR_RARITY_R.common;
  const scale = (R / commonR) * levelScale;
  return {
    attack: Math.floor(base.attack * scale),
    defense: Math.floor(base.defense * scale),
    hp: Math.floor(base.hp * scale)
  };
}

function allocateExact(total, weights) {
  const sumW = weights.reduce((a, b) => a + b, 0) || 1;
  const raw = weights.map((w) => (total * w) / sumW);
  const out = raw.map((v) => Math.floor(v));
  let rem = total - out.reduce((a, b) => a + b, 0);
  for (let i = 0; rem > 0; i += 1) {
    out[i % out.length] += 1;
    rem -= 1;
  }
  return out;
}

const setLegacyCache = new Map();

export function buildSetLegacyMap(roleGroup, ilvl, rarity) {
  const role = normalizeRoleGroup(roleGroup);
  const key = `${role}:${ilvl}:${rarity}`;
  if (setLegacyCache.has(key)) return setLegacyCache.get(key);
  const slots = slotsForRoleGroup(role);
  const budgets = slots.map((slot) => itemBudget({ roleGroup: role, slot, ilvl, rarity, isSetPiece: false }));
  const totals = planFullSetLegacyTotals(role, ilvl, rarity);
  const atk = allocateExact(totals.attack, budgets);
  const def = allocateExact(totals.defense, budgets);
  const hp = allocateExact(totals.hp, budgets);
  const map = {};
  slots.forEach((slot, i) => {
    map[slot] = { attack: atk[i], defense: def[i], hp: hp[i] };
  });
  setLegacyCache.set(key, map);
  return map;
}

/** Deterministic legacy combat targets for one item (exact full-set totals). */
export function legacyTargetsForItem(roleGroup, slot, ilvl, rarity) {
  const role = normalizeRoleGroup(roleGroup);
  const map = buildSetLegacyMap(role, ilvl, rarity);
  return map[slot] || { attack: 0, defense: 0, hp: 0 };
}

export function clearSetLegacyCacheForTests() {
  setLegacyCache.clear();
}

export function primaryStatFromItem(item, roleGroup) {
  const role = normalizeRoleGroup(roleGroup);
  if (role === 'healer') {
    return item.stats?.spellPower || item.attack || 0;
  }
  return item.attack || item.stats?.power || 0;
}

export function armorStatFromItem(item) {
  return item.defense || item.stats?.armor || 0;
}
