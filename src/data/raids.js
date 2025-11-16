// Raid Encounters Data
// Each raid has waves leading to a boss with unique mechanics

const RAIDS = {
  // ==================== NORMAL TIER (Level 20+, 1500+ Item Score) ====================
  corrupted_temple: {
    id: 'corrupted_temple',
    name: 'Corrupted Temple',
    difficulty: 'normal',
    minLevel: 20,
    minItemScore: 1500,
    minPlayers: 3,
    maxPlayers: 5,
    waves: 3,
    description: 'A once-holy temple now twisted by dark magic. Cleanse the corruption and face the Corrupted High Priest.',
    boss: {
      name: 'Corrupted High Priest',
      hp: 50000,
      attack: 80,
      defense: 40,
      level: 22,
      mechanics: [
        {
          name: 'Shadow Bolt',
          description: 'Channels dark energy to strike a random player for heavy damage',
          type: 'single-target',
          cooldown: 8000
        },
        {
          name: 'Corrupting Aura',
          description: 'At 50% HP, pulses damage to all players every 5 seconds',
          type: 'aoe',
          triggerAt: 0.5
        },
        {
          name: 'Summon Cultists',
          description: 'At 75% and 25% HP, summons 2 cultist adds',
          type: 'adds',
          triggerAt: [0.75, 0.25]
        }
      ]
    },
    rewards: {
      gold: 500,
      tokens: 10,
      experience: 2000,
      guaranteedLoot: ['weapon', 'armor']
    },
    estimatedDuration: 180000 // 3 minutes
  },

  bandit_stronghold: {
    id: 'bandit_stronghold',
    name: 'Bandit Stronghold',
    difficulty: 'normal',
    minLevel: 20,
    minItemScore: 1500,
    minPlayers: 3,
    maxPlayers: 5,
    waves: 4,
    description: 'Infiltrate the bandit fortress and eliminate their ruthless leader.',
    boss: {
      name: 'Bandit King',
      hp: 45000,
      attack: 90,
      defense: 30,
      level: 23,
      mechanics: [
        {
          name: 'Dual Strike',
          description: 'Attacks twice in rapid succession on the tank',
          type: 'tank-buster',
          cooldown: 12000
        },
        {
          name: 'Smoke Bomb',
          description: 'Becomes evasive, dodging 50% of attacks for 10 seconds',
          type: 'defensive',
          cooldown: 30000
        },
        {
          name: 'Call Reinforcements',
          description: 'Summons 3 bandit archers at 60% HP',
          type: 'adds',
          triggerAt: 0.6
        }
      ]
    },
    rewards: {
      gold: 550,
      tokens: 12,
      experience: 2200,
      guaranteedLoot: ['weapon', 'accessory']
    },
    estimatedDuration: 240000 // 4 minutes
  },

  haunted_crypt: {
    id: 'haunted_crypt',
    name: 'Haunted Crypt',
    difficulty: 'normal',
    minLevel: 20,
    minItemScore: 1500,
    minPlayers: 3,
    maxPlayers: 5,
    waves: 3,
    description: 'Venture into an ancient crypt filled with undead. Destroy the phylactery to stop the endless spawns.',
    boss: {
      name: 'Lich Phylactery',
      hp: 40000,
      attack: 70,
      defense: 60,
      level: 21,
      mechanics: [
        {
          name: 'Life Drain',
          description: 'Drains health from all players, healing the phylactery',
          type: 'heal',
          cooldown: 15000
        },
        {
          name: 'Spectral Guards',
          description: 'Summons 2 ghost adds every 30 seconds',
          type: 'adds',
          cooldown: 30000
        },
        {
          name: 'Death Nova',
          description: 'When destroyed, explodes for massive AoE damage. Players must run away!',
          type: 'mechanic',
          triggerAt: 0.0
        }
      ]
    },
    rewards: {
      gold: 500,
      tokens: 10,
      experience: 2000,
      guaranteedLoot: ['armor', 'shield']
    },
    estimatedDuration: 180000 // 3 minutes
  },

  // ==================== HEROIC TIER (Level 35+, 3500+ Item Score) ====================
  dragons_lair: {
    id: 'dragons_lair',
    name: "Dragon's Lair",
    difficulty: 'heroic',
    minLevel: 35,
    minItemScore: 3500,
    minPlayers: 5,
    maxPlayers: 8,
    waves: 5,
    description: 'Ascend the mountain lair and face a fearsome dragon in its den.',
    boss: {
      name: 'Mature Dragon',
      hp: 150000,
      attack: 150,
      defense: 80,
      level: 40,
      mechanics: [
        {
          name: 'Breath Weapon',
          description: 'Cone of fire dealing massive damage in front of the dragon',
          type: 'frontal-cone',
          cooldown: 20000
        },
        {
          name: 'Wing Buffet',
          description: 'Knocks back all nearby players and deals moderate damage',
          type: 'aoe',
          cooldown: 15000
        },
        {
          name: 'Aerial Phase',
          description: 'At 50% HP, flies up and rains fire on random locations',
          type: 'phase-transition',
          triggerAt: 0.5
        },
        {
          name: 'Tail Swipe',
          description: 'Sweeps tail behind, hitting players not in front',
          type: 'positional',
          cooldown: 10000
        }
      ]
    },
    rewards: {
      gold: 1500,
      tokens: 30,
      experience: 8000,
      guaranteedLoot: ['weapon', 'armor', 'accessory']
    },
    estimatedDuration: 420000 // 7 minutes
  },

  demon_fortress: {
    id: 'demon_fortress',
    name: 'Demon Fortress',
    difficulty: 'heroic',
    minLevel: 35,
    minItemScore: 3500,
    minPlayers: 5,
    maxPlayers: 8,
    waves: 5,
    description: 'Breach the demonic stronghold and banish the Demon Lord back to the abyss.',
    boss: {
      name: 'Demon Lord',
      hp: 160000,
      attack: 160,
      defense: 70,
      level: 41,
      mechanics: [
        {
          name: 'Hellfire',
          description: 'Places pools of fire on the ground that damage players standing in them',
          type: 'ground-effect',
          cooldown: 12000
        },
        {
          name: 'Demonic Pact',
          description: 'Marks a player - they must run away from the group or explode',
          type: 'mechanic',
          cooldown: 25000
        },
        {
          name: 'Summon Imps',
          description: 'Summons 4 imp adds that must be killed quickly',
          type: 'adds',
          cooldown: 30000
        },
        {
          name: 'Enrage',
          description: 'After 8 minutes, gains massive damage increase',
          type: 'enrage',
          timer: 480000
        }
      ]
    },
    rewards: {
      gold: 1600,
      tokens: 32,
      experience: 8500,
      guaranteedLoot: ['weapon', 'armor', 'accessory']
    },
    estimatedDuration: 450000 // 7.5 minutes
  },

  titans_keep: {
    id: 'titans_keep',
    name: "Titan's Keep",
    difficulty: 'heroic',
    minLevel: 35,
    minItemScore: 3500,
    minPlayers: 5,
    maxPlayers: 8,
    waves: 4,
    description: 'Challenge the ancient Stone Titan in its mountain fortress.',
    boss: {
      name: 'Stone Titan',
      hp: 200000,
      attack: 140,
      defense: 120,
      level: 39,
      mechanics: [
        {
          name: 'Boulder Toss',
          description: 'Throws a massive boulder at a random player',
          type: 'single-target',
          cooldown: 15000
        },
        {
          name: 'Earthshatter',
          description: 'Slams the ground, stunning all players for 3 seconds',
          type: 'stun',
          cooldown: 30000
        },
        {
          name: 'Stone Form',
          description: 'Becomes immune to damage, summons rock adds to destroy',
          type: 'immunity-phase',
          cooldown: 60000
        },
        {
          name: 'Avalanche',
          description: 'At 30% HP, rocks continuously fall from ceiling',
          type: 'environmental',
          triggerAt: 0.3
        }
      ]
    },
    rewards: {
      gold: 1500,
      tokens: 30,
      experience: 8000,
      guaranteedLoot: ['armor', 'shield', 'accessory']
    },
    estimatedDuration: 390000 // 6.5 minutes
  },

  shadowlands: {
    id: 'shadowlands',
    name: 'Shadowlands',
    difficulty: 'heroic',
    minLevel: 35,
    minItemScore: 3500,
    minPlayers: 5,
    maxPlayers: 8,
    waves: 5,
    description: 'Enter the realm of shadows and defeat the Shadow Empress.',
    boss: {
      name: 'Shadow Empress',
      hp: 145000,
      attack: 155,
      defense: 75,
      level: 40,
      mechanics: [
        {
          name: 'Shadow Step',
          description: 'Teleports behind a random player and strikes',
          type: 'teleport',
          cooldown: 10000
        },
        {
          name: 'Void Zone',
          description: 'Creates expanding zones of darkness that must be avoided',
          type: 'ground-effect',
          cooldown: 20000
        },
        {
          name: 'Shadow Clone',
          description: 'At 60% and 30% HP, splits into 3 clones. Kill the real one!',
          type: 'mechanic',
          triggerAt: [0.6, 0.3]
        },
        {
          name: 'Nightmare',
          description: 'Fears all players, causing them to run randomly for 5 seconds',
          type: 'crowd-control',
          cooldown: 45000
        }
      ]
    },
    rewards: {
      gold: 1550,
      tokens: 31,
      experience: 8200,
      guaranteedLoot: ['weapon', 'armor', 'accessory']
    },
    estimatedDuration: 420000 // 7 minutes
  },

  // ==================== MYTHIC TIER (Level 50+, 6000+ Item Score) ====================
  elemental_plane: {
    id: 'elemental_plane',
    name: 'Elemental Plane',
    difficulty: 'mythic',
    minLevel: 50,
    minItemScore: 6000,
    minPlayers: 8,
    maxPlayers: 10,
    waves: 6,
    description: 'Cross into the elemental plane and defeat the Elemental Overlord who commands all four elements.',
    boss: {
      name: 'Elemental Overlord',
      hp: 350000,
      attack: 220,
      defense: 120,
      level: 55,
      mechanics: [
        {
          name: 'Elemental Shift',
          description: 'Changes element every 60s: Fire (more damage), Ice (slows), Earth (more defense), Air (faster)',
          type: 'phase',
          cooldown: 60000
        },
        {
          name: 'Inferno',
          description: 'Fire phase: Room-wide fire damage increasing over time',
          type: 'aoe',
          phase: 'fire'
        },
        {
          name: 'Blizzard',
          description: 'Ice phase: Slows all players, freeze random players in ice blocks',
          type: 'crowd-control',
          phase: 'ice'
        },
        {
          name: 'Earthquake',
          description: 'Earth phase: Ground cracks appear, players must navigate carefully',
          type: 'environmental',
          phase: 'earth'
        },
        {
          name: 'Tornado',
          description: 'Air phase: Spawns tornadoes that move around the room',
          type: 'ground-effect',
          phase: 'air'
        },
        {
          name: 'Elemental Convergence',
          description: 'At 20% HP, uses all elements simultaneously',
          type: 'ultimate',
          triggerAt: 0.2
        }
      ]
    },
    rewards: {
      gold: 3000,
      tokens: 75,
      experience: 20000,
      guaranteedLoot: ['weapon', 'armor', 'accessory', 'shield']
    },
    estimatedDuration: 720000 // 12 minutes
  },

  void_citadel: {
    id: 'void_citadel',
    name: 'Void Citadel',
    difficulty: 'mythic',
    minLevel: 50,
    minItemScore: 6000,
    minPlayers: 8,
    maxPlayers: 10,
    waves: 7,
    description: 'Storm the citadel at the edge of reality and face the Void Incarnate.',
    boss: {
      name: 'Void Incarnate',
      hp: 400000,
      attack: 240,
      defense: 100,
      level: 57,
      mechanics: [
        {
          name: 'Void Beam',
          description: 'Channels a beam at a player, they must kite it away from the group',
          type: 'mechanic',
          cooldown: 18000
        },
        {
          name: 'Reality Tear',
          description: 'Opens portals that spawn void adds continuously',
          type: 'adds',
          cooldown: 40000
        },
        {
          name: 'Consuming Darkness',
          description: 'Pulls all players toward the boss, dealing damage',
          type: 'pull',
          cooldown: 25000
        },
        {
          name: 'Void Form',
          description: 'At 40% HP, becomes partially phased - only magic damage works',
          type: 'mechanic',
          triggerAt: 0.4
        },
        {
          name: 'Entropy',
          description: 'Reduces max HP of all players by 1% every 10 seconds',
          type: 'debuff',
          permanent: true
        },
        {
          name: 'Oblivion',
          description: 'After 10 minutes, casts instant-wipe spell',
          type: 'enrage',
          timer: 600000
        }
      ]
    },
    rewards: {
      gold: 3500,
      tokens: 85,
      experience: 25000,
      guaranteedLoot: ['weapon', 'armor', 'accessory', 'shield']
    },
    estimatedDuration: 780000 // 13 minutes
  },

  celestial_sanctum: {
    id: 'celestial_sanctum',
    name: 'Celestial Sanctum',
    difficulty: 'mythic',
    minLevel: 50,
    minItemScore: 6000,
    minPlayers: 8,
    maxPlayers: 10,
    waves: 6,
    description: 'Ascend to the heavens and battle a Fallen Archangel corrupted by power.',
    boss: {
      name: 'Fallen Archangel',
      hp: 380000,
      attack: 230,
      defense: 110,
      level: 56,
      mechanics: [
        {
          name: 'Divine Judgment',
          description: 'Marks 3 players - they must spread out or chain damage occurs',
          type: 'spread',
          cooldown: 20000
        },
        {
          name: 'Heavenly Smite',
          description: 'Massive single-target attack on the tank, requires defensive cooldown',
          type: 'tank-buster',
          cooldown: 30000
        },
        {
          name: 'Corrupted Wings',
          description: 'Flies up and fires feathers at all players',
          type: 'projectile',
          cooldown: 35000
        },
        {
          name: 'Redemption',
          description: 'At 75%, 50%, 25% HP, heals for 10% and summons angelic adds',
          type: 'heal-phase',
          triggerAt: [0.75, 0.5, 0.25]
        },
        {
          name: 'Holy Fire',
          description: 'Places holy fire on the ground that heals the boss if touched',
          type: 'ground-effect',
          cooldown: 15000
        },
        {
          name: 'Final Ascension',
          description: 'At 10% HP, gains massive attack speed and damage',
          type: 'enrage',
          triggerAt: 0.1
        }
      ]
    },
    rewards: {
      gold: 3200,
      tokens: 80,
      experience: 22000,
      guaranteedLoot: ['weapon', 'armor', 'accessory', 'shield']
    },
    estimatedDuration: 750000 // 12.5 minutes
  }
};

// Helper function to get raids by difficulty
function getRaidsByDifficulty(difficulty) {
  return Object.values(RAIDS).filter(raid => raid.difficulty === difficulty);
}

// Helper function to get raids player qualifies for
function getAvailableRaids(playerLevel, playerItemScore) {
  return Object.values(RAIDS).filter(raid => 
    raid.minLevel <= playerLevel && raid.minItemScore <= playerItemScore
  );
}

// Helper function to get raid by ID
function getRaidById(raidId) {
  return RAIDS[raidId] || null;
}

export {
  RAIDS,
  getRaidsByDifficulty,
  getAvailableRaids,
  getRaidById
};
