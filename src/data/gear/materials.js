export const ARMOR_TYPES = {
  tank: 'plate',
  healer: 'cloth',
  melee: 'leather',
  caster: 'cloth'
};

export const MATERIAL_TIERS = [
  { id: 'tier1', minIlvl: 1, maxIlvl: 25, plate: 'Iron', leather: 'Hide', cloth: 'Linen' },
  { id: 'tier2', minIlvl: 26, maxIlvl: 45, plate: 'Steel', leather: 'Scale', cloth: 'Wool' },
  { id: 'tier3', minIlvl: 46, maxIlvl: 65, plate: 'Mithril', leather: 'Dragonhide', cloth: 'Silk' },
  { id: 'tier4', minIlvl: 66, maxIlvl: 85, plate: 'Adamant', leather: 'Wyvern', cloth: 'Mageweave' },
  { id: 'tier5', minIlvl: 86, maxIlvl: 115, plate: 'Voidforged', leather: 'Voidleather', cloth: 'Starweave' }
];

export function materialForIlvl(roleGroup, ilvl) {
  const armor = ARMOR_TYPES[roleGroup] || 'cloth';
  const L = Math.max(1, ilvl || 1);
  const tier = MATERIAL_TIERS.find((t) => L >= t.minIlvl && L <= t.maxIlvl) || MATERIAL_TIERS[0];
  if (armor === 'plate') return tier.plate;
  if (armor === 'leather') return tier.leather;
  return tier.cloth;
}
