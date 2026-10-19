export const PREFIXES = [
  { id: 'stalwart', label: 'Stalwart', stat: 'stamina', shift: 0.1 },
  { id: 'vicious', label: 'Vicious', stat: 'power', shift: 0.1 },
  { id: 'radiant', label: 'Radiant', stat: 'spellPower', shift: 0.1 },
  { id: 'swift', label: 'Swift', stat: 'haste', shift: 0.1 },
  { id: 'keen', label: 'Keen', stat: 'crit', shift: 0.1 },
  { id: 'warded', label: 'Warded', stat: 'armor', shift: 0.1 },
  { id: 'tranquil', label: 'Tranquil', stat: 'recovery', shift: 0.1 },
  { id: 'brutal', label: 'Brutal', stat: 'power', shift: 0.1 }
];

/** suffix id -> { label, stats: [{stat, weight}], roleGroups allowed } */
export const SUFFIXES = [
  { id: 'bear', label: 'the Bear', stats: ['stamina', 'power'], roleGroups: ['tank', 'melee'] },
  { id: 'tiger', label: 'the Tiger', stats: ['power', 'crit'], roleGroups: ['melee', 'caster'] },
  { id: 'monkey', label: 'the Monkey', stats: ['power', 'haste'], roleGroups: ['melee', 'caster'] },
  { id: 'falcon', label: 'the Falcon', stats: ['crit', 'haste'], roleGroups: ['melee', 'caster'] },
  { id: 'owl', label: 'the Owl', stats: ['spellPower', 'recovery'], roleGroups: ['healer', 'caster'] },
  { id: 'eagle', label: 'the Eagle', stats: ['stamina', 'spellPower'], roleGroups: ['healer'] },
  { id: 'whale', label: 'the Whale', stats: ['stamina', 'armor'], roleGroups: ['tank', 'healer'] },
  { id: 'boar', label: 'the Boar', stats: ['armor', 'power'], roleGroups: ['tank', 'melee'] },
  { id: 'wolf', label: 'the Wolf', stats: ['power', 'recovery'], roleGroups: ['melee', 'caster'] },
  { id: 'serpent', label: 'the Serpent', stats: ['spellPower', 'crit'], roleGroups: ['caster', 'healer'] },
  { id: 'sparrow', label: 'the Sparrow', stats: ['haste', 'recovery'], roleGroups: ['healer', 'caster', 'melee'] },
  { id: 'turtle', label: 'the Turtle', stats: ['armor', 'recovery'], roleGroups: ['tank'] },
  { id: 'healing', label: 'Healing', stats: ['spellPower', 'stamina'], roleGroups: ['healer'] },
  { id: 'champion', label: 'the Champion', stats: ['power', 'stamina', 'armor'], roleGroups: ['tank', 'melee'] },
  { id: 'sorcerer', label: 'the Sorcerer', stats: ['spellPower', 'haste', 'crit'], roleGroups: ['caster'] },
  { id: 'sentinel', label: 'the Sentinel', stats: ['armor', 'haste'], roleGroups: ['tank'] }
];

export function suffixesForRole(roleGroup) {
  return SUFFIXES.filter((s) => s.roleGroups.includes(roleGroup));
}
