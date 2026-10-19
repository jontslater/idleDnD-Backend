/** Set piece slots (5-piece armor sets). */
export const SET_SLOTS = ['helm', 'armor', 'gloves', 'boots', 'cloak'];

const LEGACY_T1 = [
  { id: 'guardians_bulwark', name: "Guardian's Bulwark", roleGroup: 'tank' },
  { id: 'wardens_fortress', name: "Warden's Fortress", roleGroup: 'tank' },
  { id: 'lifebinders_grace', name: "Lifebinder's Grace", roleGroup: 'healer' },
  { id: 'divine_sanctuary', name: 'Divine Sanctuary', roleGroup: 'healer' },
  { id: 'berserkers_wrath', name: "Berserker's Wrath", roleGroup: 'melee' },
  { id: 'assassins_shadow', name: "Assassin's Shadow", roleGroup: 'melee' },
  { id: 'archmages_power', name: "Archmage's Power", roleGroup: 'caster' },
  { id: 'warlocks_corruption', name: "Warlock's Corruption", roleGroup: 'caster' }
];

const ROLE_BONUS_HOOKS = {
  tank: {
    2: { hook: 'shield_wall_cooldown_ms', value: -5000, description: 'Shield Wall cooldown −5s' },
    4: { hook: 'shield_wall_party_dr', value: 0.05, description: 'Shield Wall party DR +5%' }
  },
  healer: {
    2: { hook: 'group_heal_bonus', value: 0.1, description: 'Group Heal +10% healing' },
    4: { hook: 'group_heal_hot', value: 0.1, description: 'Group Heal leaves a 6s HoT for 10%' }
  },
  melee: {
    2: { hook: 'burst_strike_crit', value: 0.1, description: 'Burst Strike +10% crit chance' },
    4: { hook: 'burst_strike_cleave', value: 0.5, description: 'Burst Strike cleaves 50% to one extra target' }
  },
  caster: {
    2: { hook: 'burst_strike_charge_rate', value: 0.15, description: 'Burst Strike charges 15% faster' },
    4: { hook: 'burst_strike_dot', value: 0.6, description: 'Burst Strike applies a 3s DoT worth 60%' }
  }
};

function makeSet(id, name, roleGroup, kind, tier, ilvlBand) {
  return {
    id,
    name,
    roleGroup,
    kind,
    tier,
    ilvlBand,
    slots: SET_SLOTS,
    bonuses: ROLE_BONUS_HOOKS[roleGroup]
  };
}

function buildDungeonSets() {
  const bands = [
    { tier: 1, min: 10, max: 25, prefix: 'Ironbound' },
    { tier: 2, min: 25, max: 45, prefix: 'Deepdelver' },
    { tier: 3, min: 45, max: 65, prefix: 'Shadowmark' },
    { tier: 4, min: 65, max: 85, prefix: 'Dragonscale' },
    { tier: 5, min: 85, max: 100, prefix: 'Voidwalker' }
  ];
  const groups = ['tank', 'healer', 'melee', 'caster'];
  const out = [];
  for (const band of bands) {
    for (const g of groups) {
      const legacy = LEGACY_T1.find((l) => l.roleGroup === g);
      const name = `${band.prefix} ${legacy?.name.split("'")[0] || g}`;
      out.push(makeSet(`dungeon_t${band.tier}_${g}`, name, g, 'dungeon', band.tier, { min: band.min, max: band.max }));
    }
  }
  return out;
}

function buildRaidSets() {
  const tiers = [
    { tier: 1, min: 15, max: 30 },
    { tier: 2, min: 30, max: 45 },
    { tier: 3, min: 45, max: 70 },
    { tier: 4, min: 70, max: 100 }
  ];
  const groups = ['tank', 'healer', 'melee', 'caster'];
  const out = [];
  for (const t of tiers) {
    for (const g of groups) {
      const legacy = LEGACY_T1.filter((l) => l.roleGroup === g);
      const pick = legacy[0];
      const tierSuffix = t.tier === 1 ? '' : ` T${t.tier}`;
      out.push(
        makeSet(
          `raid_t${t.tier}_${g}`,
          `${pick?.name || g}${tierSuffix}`,
          g,
          'raid',
          t.tier,
          { min: t.min, max: t.max }
        )
      );
    }
  }
  return out;
}

/** T1 raid sets are the original 8 legacy names. */
export const LEGACY_SET_MAP = Object.fromEntries(
  LEGACY_T1.map((s) => [s.name.toLowerCase(), `raid_t1_${s.roleGroup}`])
);

export const GEAR_SETS = [...buildDungeonSets(), ...buildRaidSets()];

export function getSetById(setId) {
  return GEAR_SETS.find((s) => s.id === setId) || null;
}

export function pickSetForSource(roleGroup, source) {
  const type = source?.type || 'idle';
  const ilvl = source?.ilvl || 1;
  const kind = type === 'dungeon' ? 'dungeon' : type === 'raid' || type === 'worldboss' ? 'raid' : null;
  if (!kind) return null;
  const candidates = GEAR_SETS.filter(
    (s) => s.roleGroup === roleGroup && s.kind === kind && ilvl >= s.ilvlBand.min && ilvl <= s.ilvlBand.max
  );
  if (!candidates.length) {
    return GEAR_SETS.find((s) => s.roleGroup === roleGroup && s.kind === kind) || null;
  }
  return candidates[Math.floor(Math.random() * candidates.length)];
}
