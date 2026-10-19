import { GEAR_BUDGET_FRACTION, GEAR_RARITY_R, g } from '../balance.js';

export const ILVL_CAP = 115;

/** Role groups for gear (melee vs caster DPS split). */
export const ROLE_GROUPS = ['tank', 'healer', 'melee', 'caster'];

export const SLOT_WEIGHTS = {
  weapon: 0.25,
  armor: 0.15,
  shield: 0.1,
  accessory: 0.1,
  helm: 0.08,
  cloak: 0.07,
  gloves: 0.07,
  boots: 0.08,
  ring1: 0.05,
  ring2: 0.05
};

/** Anchor used in BALANCE_PLAN §4.3 (tuned to role base stats). */
export const ROLE_BUDGET_ANCHOR = {
  tank: 100,
  healer: 80,
  melee: 90,
  caster: 90
};

export const STAT_COST = {
  power: 1,
  spellPower: 1,
  armor: 3,
  stamina: 0.8,
  crit: 12,
  haste: 10,
  recovery: 14
};

export const GEAR_SECONDARY_CAPS = {
  crit: 0.35,
  haste: 0.2,
  recovery: 0.15
};

export const SET_PIECE_BUDGET_MULT = 0.92;
export const SET_BONUS_TOTAL_BUDGET_FRACTION = 0.08;

/**
 * Item stat budget B(slot, ilvl, R) per balance plan.
 */
export function itemBudget({ roleGroup, slot, ilvl, rarity, isSetPiece = false }) {
  const L = Math.min(ILVL_CAP, Math.max(1, Math.floor(ilvl || 1)));
  const R = GEAR_RARITY_R[rarity] || 1;
  const anchor = ROLE_BUDGET_ANCHOR[roleGroup] || 90;
  const w = SLOT_WEIGHTS[slot] || 0.05;
  let budget = GEAR_BUDGET_FRACTION * R * anchor * g(L) * w;
  if (isSetPiece) budget *= SET_PIECE_BUDGET_MULT;
  return budget;
}

/** Expected full-set budget at ilvl (for set bonus cap tests). */
export function fullSetBudget(roleGroup, ilvl, rarity) {
  const slots = Object.keys(SLOT_WEIGHTS);
  return slots.reduce(
    (sum, slot) => sum + itemBudget({ roleGroup, slot, ilvl, rarity, isSetPiece: false }),
    0
  );
}

export function setBonusBudgetCap(roleGroup, ilvl, rarity) {
  return fullSetBudget(roleGroup, ilvl, rarity) * SET_BONUS_TOTAL_BUDGET_FRACTION;
}

/** Rough budget from rolled stats object (matches generator accounting). */
export function budgetFromStats(stats) {
  return (
    (stats.power || 0) * STAT_COST.power +
    (stats.spellPower || 0) * STAT_COST.spellPower +
    (stats.armor || 0) * STAT_COST.armor +
    (stats.stamina || 0) * STAT_COST.stamina +
    (stats.crit || 0) * 100 * STAT_COST.crit +
    (stats.haste || 0) * 100 * STAT_COST.haste +
    (stats.recovery || 0) * 100 * STAT_COST.recovery
  );
}
