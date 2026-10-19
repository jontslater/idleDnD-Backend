import { ARMOR_TYPES, materialForIlvl } from './materials.js';

export const GEAR_SLOTS = ['weapon', 'armor', 'accessory', 'shield', 'helm', 'cloak', 'gloves', 'ring1', 'ring2', 'boots'];

const SLOT_LABELS = {
  weapon: 'Greatblade',
  armor: 'Chestguard',
  accessory: 'Talisman',
  shield: 'Bulwark',
  helm: 'Greathelm',
  cloak: 'Mantle',
  gloves: 'Gauntlets',
  ring1: 'Band',
  ring2: 'Loop',
  boots: 'Treads'
};

const ROLE_SLOT_VARIANT = {
  tank: { weapon: 'Warhammer', armor: 'Plate', accessory: 'Sigil' },
  healer: { weapon: 'Focus', armor: 'Vestments', accessory: 'Relic' },
  melee: { weapon: 'Blade', armor: 'Harness', accessory: 'Charm' },
  caster: { weapon: 'Staff', armor: 'Robes', accessory: 'Orb' }
};

function buildBases() {
  const bases = [];
  for (const roleGroup of ['tank', 'healer', 'melee', 'caster']) {
    const slots = roleGroup === 'tank' ? GEAR_SLOTS : GEAR_SLOTS.filter((s) => s !== 'shield');
    for (const slot of slots) {
      for (let tier = 1; tier <= 5; tier++) {
        const ilvlMid = tier * 20;
        const material = materialForIlvl(roleGroup, ilvlMid);
        const variant = ROLE_SLOT_VARIANT[roleGroup][slot] || SLOT_LABELS[slot];
        const id = `${roleGroup}_${slot}_t${tier}`;
        bases.push({
          id,
          roleGroup,
          slot,
          armorType: ARMOR_TYPES[roleGroup],
          tier,
          nameStem: variant,
          ilvlBand: { min: (tier - 1) * 20 + 1, max: Math.min(115, tier * 23) }
        });
      }
    }
  }
  return bases;
}

export const GEAR_BASES = buildBases();

export function pickBaseForRoll(roleGroup, slot, ilvl) {
  const candidates = GEAR_BASES.filter(
    (b) => b.roleGroup === roleGroup && b.slot === slot && ilvl >= b.ilvlBand.min && ilvl <= b.ilvlBand.max
  );
  if (candidates.length) return candidates[Math.floor(Math.random() * candidates.length)];
  const fallback = GEAR_BASES.filter((b) => b.roleGroup === roleGroup && b.slot === slot);
  return fallback[fallback.length - 1] || GEAR_BASES[0];
}
