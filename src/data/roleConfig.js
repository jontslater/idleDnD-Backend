// Class configuration matching the Electron app's ROLE_CONFIG
export const ROLE_CONFIG = {
  // TANKS
  guardian: { baseHp: 220, baseAttack: 8, baseDefense: 18, hpPerLevel: 35, attackPerLevel: 2, defensePerLevel: 6, displayName: 'Shield Guardian', category: 'tank' },
  paladin: { baseHp: 200, baseAttack: 10, baseDefense: 16, hpPerLevel: 32, attackPerLevel: 3, defensePerLevel: 5, displayName: 'Holy Defender', category: 'tank' },
  warden: { baseHp: 210, baseAttack: 9, baseDefense: 15, hpPerLevel: 34, attackPerLevel: 2, defensePerLevel: 5, displayName: 'Wild Warden', category: 'tank' },
  bloodknight: { baseHp: 205, baseAttack: 11, baseDefense: 14, hpPerLevel: 33, attackPerLevel: 3, defensePerLevel: 4, displayName: 'Blood Knight', category: 'tank' },
  vanguard: { baseHp: 190, baseAttack: 12, baseDefense: 15, hpPerLevel: 30, attackPerLevel: 3, defensePerLevel: 5, displayName: 'Agile Vanguard', category: 'tank' },
  brewmaster: { baseHp: 215, baseAttack: 8, baseDefense: 17, hpPerLevel: 35, attackPerLevel: 2, defensePerLevel: 6, displayName: 'Brewed Monk', category: 'tank' },

  // HEALERS
  cleric: { baseHp: 105, baseAttack: 6, baseDefense: 8, hpPerLevel: 16, attackPerLevel: 1, defensePerLevel: 2, displayName: 'Cleric', category: 'healer' },
  atoner: { baseHp: 100, baseAttack: 8, baseDefense: 7, hpPerLevel: 15, attackPerLevel: 2, defensePerLevel: 2, displayName: 'Atoner', category: 'healer' },
  druid: { baseHp: 95, baseAttack: 5, baseDefense: 6, hpPerLevel: 14, attackPerLevel: 1, defensePerLevel: 1, displayName: 'Restoration Druid', category: 'healer' },
  lightbringer: { baseHp: 110, baseAttack: 7, baseDefense: 9, hpPerLevel: 17, attackPerLevel: 1, defensePerLevel: 3, displayName: 'Lightbringer', category: 'healer' },
  shaman: { baseHp: 100, baseAttack: 6, baseDefense: 7, hpPerLevel: 15, attackPerLevel: 1, defensePerLevel: 2, displayName: 'Spirit Healer', category: 'healer' },
  mistweaver: { baseHp: 98, baseAttack: 7, baseDefense: 6, hpPerLevel: 14, attackPerLevel: 2, defensePerLevel: 1, displayName: 'Mistweaver', category: 'healer' },
  chronomancer: { baseHp: 92, baseAttack: 5, baseDefense: 5, hpPerLevel: 13, attackPerLevel: 1, defensePerLevel: 1, displayName: 'Chronomender', category: 'healer' },
  bard: { baseHp: 107, baseAttack: 7, baseDefense: 8, hpPerLevel: 16, attackPerLevel: 1, defensePerLevel: 2, displayName: 'Bard', category: 'healer' },

  // DPS
  berserker: { baseHp: 130, baseAttack: 16, baseDefense: 5, hpPerLevel: 20, attackPerLevel: 5, defensePerLevel: 1, displayName: 'Berserker', category: 'dps' },
  crusader: { baseHp: 140, baseAttack: 15, baseDefense: 6, hpPerLevel: 22, attackPerLevel: 5, defensePerLevel: 2, displayName: 'Crusader', category: 'dps' },
  assassin: { baseHp: 120, baseAttack: 18, baseDefense: 4, hpPerLevel: 18, attackPerLevel: 6, defensePerLevel: 1, displayName: 'Assassin', category: 'dps' },
  reaper: { baseHp: 125, baseAttack: 16, baseDefense: 5, hpPerLevel: 19, attackPerLevel: 6, defensePerLevel: 1, displayName: 'Reaper', category: 'dps' },
  bladedancer: { baseHp: 122, baseAttack: 17, baseDefense: 4, hpPerLevel: 19, attackPerLevel: 6, defensePerLevel: 1, displayName: 'Blade Dancer', category: 'dps' },
  monk: { baseHp: 128, baseAttack: 15, baseDefense: 5, hpPerLevel: 20, attackPerLevel: 5, defensePerLevel: 1, displayName: 'Chi Fighter', category: 'dps' },
  stormwarrior: { baseHp: 135, baseAttack: 14, baseDefense: 6, hpPerLevel: 21, attackPerLevel: 5, defensePerLevel: 1, displayName: 'Storm Warrior', category: 'dps' },
  hunter: { baseHp: 125, baseAttack: 16, baseDefense: 5, hpPerLevel: 19, attackPerLevel: 6, defensePerLevel: 1, displayName: 'Beast Stalker', category: 'dps' },
  mage: { baseHp: 115, baseAttack: 19, baseDefense: 3, hpPerLevel: 17, attackPerLevel: 6, defensePerLevel: 1, displayName: 'Elementalist', category: 'dps' },
  warlock: { baseHp: 118, baseAttack: 18, baseDefense: 4, hpPerLevel: 18, attackPerLevel: 6, defensePerLevel: 1, displayName: 'Warlock', category: 'dps' },
  ranger: { baseHp: 122, baseAttack: 17, baseDefense: 5, hpPerLevel: 19, attackPerLevel: 6, defensePerLevel: 1, displayName: 'Marksman', category: 'dps' },
  shadowpriest: { baseHp: 120, baseAttack: 16, baseDefense: 4, hpPerLevel: 18, attackPerLevel: 6, defensePerLevel: 1, displayName: 'Dark Oracle', category: 'dps' },
  mooncaller: { baseHp: 117, baseAttack: 17, baseDefense: 4, hpPerLevel: 18, attackPerLevel: 6, defensePerLevel: 1, displayName: 'Mooncaller', category: 'dps' },
  stormcaller: { baseHp: 120, baseAttack: 18, baseDefense: 4, hpPerLevel: 18, attackPerLevel: 6, defensePerLevel: 1, displayName: 'Stormcaller', category: 'dps' },
  dragonsorcerer: { baseHp: 112, baseAttack: 20, baseDefense: 3, hpPerLevel: 17, attackPerLevel: 6, defensePerLevel: 1, displayName: 'Draconic Sorcerer', category: 'dps' }
};
