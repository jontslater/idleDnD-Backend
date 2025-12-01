// Raid Encounters Data
// Each raid has waves leading to a boss with unique mechanics

const RAIDS = {
  // ==================== NORMAL TIER (Level 15+, 500+ Item Score) ====================
  corrupted_temple: {
    id: 'corrupted_temple',
    name: 'Corrupted Temple',
    difficulty: 'normal',
    minLevel: 15,
    minItemScore: 500,
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
          type: 'cast',
          castTime: 3000,
          interruptible: true,
          target: 'random',
          damage: 150,
          damageMultiplier: 1.875, // 150 / 80 base attack
          cooldown: 8000,
          phases: [1, 2, 3, 4]
        },
        {
          name: 'Corrupting Aura',
          description: 'At 50% HP, pulses damage to all players every 5 seconds',
          type: 'aoe',
          target: 'all',
          damage: 80,
          damageMultiplier: 1.0,
          cooldown: 5000,
          triggerAt: 0.5,
          phases: [3, 4]
        },
        {
          name: 'Summon Cultists',
          description: 'At 75% and 25% HP, summons 2 cultist adds',
          type: 'adds',
          target: 'all',
          cooldown: 0, // Trigger-based, no cooldown
          triggerAt: [0.75, 0.25],
          phases: [2, 4],
          adds: {
            type: 'Cultist',
            count: 2,
            level: 18, // Boss level - 4
            hp: 5000,
            attack: 40,
            defense: 20
          }
        }
      ],
      phases: [
        {
          hpThreshold: 1.0,
          mechanics: ['Shadow Bolt'],
          adds: null
        },
        {
          hpThreshold: 0.75,
          mechanics: ['Shadow Bolt', 'Summon Cultists'],
          adds: { type: 'Cultist', count: 2, spawnAt: 0.75 }
        },
        {
          hpThreshold: 0.5,
          mechanics: ['Shadow Bolt', 'Corrupting Aura'],
          adds: null
        },
        {
          hpThreshold: 0.25,
          mechanics: ['Shadow Bolt', 'Corrupting Aura', 'Summon Cultists'],
          adds: { type: 'Cultist', count: 2, spawnAt: 0.25 }
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
    minLevel: 15,
    minItemScore: 500,
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
          castTime: 2000,
          interruptible: false,
          target: 'tank',
          damage: 180,
          damageMultiplier: 2.0, // 180 / 90 base attack
          cooldown: 12000,
          phases: [1, 2, 3, 4]
        },
        {
          name: 'Smoke Bomb',
          description: 'Becomes evasive, dodging 50% of attacks for 10 seconds',
          type: 'defensive',
          castTime: 1500,
          interruptible: true,
          target: 'all',
          cooldown: 30000,
          phases: [1, 2, 3, 4],
          buff: {
            type: 'evasion',
            duration: 10000,
            damageReduction: 0.5
          }
        },
        {
          name: 'Call Reinforcements',
          description: 'Summons 3 bandit archers at 60% HP',
          type: 'adds',
          target: 'all',
          cooldown: 0,
          triggerAt: 0.6,
          phases: [2, 3, 4],
          adds: {
            type: 'Bandit Archer',
            count: 3,
            level: 18,
            hp: 4000,
            attack: 50,
            defense: 15
          }
        }
      ],
      phases: [
        {
          hpThreshold: 1.0,
          mechanics: ['Dual Strike', 'Smoke Bomb'],
          adds: null
        },
        {
          hpThreshold: 0.6,
          mechanics: ['Dual Strike', 'Smoke Bomb', 'Call Reinforcements'],
          adds: { type: 'Bandit Archer', count: 3, spawnAt: 0.6 }
        },
        {
          hpThreshold: 0.3,
          mechanics: ['Dual Strike', 'Smoke Bomb'],
          adds: null
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
    minLevel: 15,
    minItemScore: 500,
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
          description: 'When destroyed, explodes for massive AoE damage to all players',
          type: 'aoe',
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

  // ==================== HEROIC TIER (Level 30+, 1500+ Item Score) ====================
  dragons_lair: {
    id: 'dragons_lair',
    name: "Dragon's Lair",
    difficulty: 'heroic',
    minLevel: 30,
    minItemScore: 1500,
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
          description: 'Deals massive fire damage to all players',
          type: 'aoe',
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
    minLevel: 30,
    minItemScore: 1500,
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
          description: 'Deals fire damage to all players over time',
          type: 'aoe',
          cooldown: 12000
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
    minLevel: 30,
    minItemScore: 1500,
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
    minLevel: 30,
    minItemScore: 1500,
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
          description: 'Creates expanding zones of darkness that deal damage to all players',
          type: 'aoe',
          cooldown: 20000
        },
        {
          name: 'Shadow Clone',
          description: 'At 60% and 30% HP, splits into 3 clones that must all be defeated',
          type: 'adds',
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

  // ==================== MYTHIC TIER (Level 45+, 3000+ Item Score) ====================
  elemental_plane: {
    id: 'elemental_plane',
    name: 'Elemental Plane',
    difficulty: 'mythic',
    minLevel: 45,
    minItemScore: 3000,
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
          description: 'Earth phase: Ground tremors deal damage to all players',
          type: 'aoe',
          phase: 'earth'
        },
        {
          name: 'Tornado',
          description: 'Air phase: Spawns tornadoes that deal damage to all players',
          type: 'aoe',
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
    minLevel: 45,
    minItemScore: 3000,
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
          description: 'Channels a beam at a random player dealing heavy damage',
          type: 'single-target',
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
    minLevel: 45,
    minItemScore: 3000,
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
          description: 'Marks 3 players, dealing chain damage if they are close together',
          type: 'aoe',
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
          description: 'Places holy fire that heals the boss periodically',
          type: 'heal',
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
  },

  // ==================== ELDER DRAGON RAIDS ====================
  elder_dragon_normal: {
    id: 'elder_dragon_normal',
    name: 'Elder Dragon\'s Lair',
    difficulty: 'normal',
    minLevel: 20,
    minItemScore: 800,
    minPlayers: 4,
    maxPlayers: 6,
    waves: 4,
    description: 'Face the Elder Dragon in its ancient lair. A formidable foe even for experienced adventurers.',
    boss: {
      name: 'Elder Dragon',
      hp: 80000,
      attack: 120,
      defense: 60,
      level: 28,
      mechanics: [
        {
          name: 'Dragon Breath',
          description: 'Breathes fire in a cone, dealing heavy damage to all players in front',
          type: 'cast',
          castTime: 4000,
          interruptible: true,
          target: 'all',
          damage: 200,
          damageMultiplier: 1.67, // 200 / 120 base attack
          cooldown: 12000,
          phases: [1, 2, 3, 4],
          aoeRadius: 300,
          aoeShape: 'cone'
        },
        {
          name: 'Tail Swipe',
          description: 'Sweeps tail, knocking back and damaging players behind',
          type: 'instant',
          target: 'all',
          damage: 150,
          damageMultiplier: 1.25,
          cooldown: 15000,
          phases: [1, 2, 3, 4],
          aoeRadius: 200,
          aoeShape: 'rectangle'
        },
        {
          name: 'Summon Whelps',
          description: 'At 60% HP, summons 2 dragon whelps',
          type: 'adds',
          target: 'all',
          cooldown: 0,
          triggerAt: 0.6,
          phases: [2, 3, 4],
          adds: {
            type: 'Dragon Whelp',
            count: 2,
            level: 24,
            hp: 6000,
            attack: 60,
            defense: 30
          }
        },
        {
          name: 'Enrage',
          description: 'At 30% HP, attack speed increases by 40%',
          type: 'enrage',
          target: 'all',
          cooldown: 0,
          triggerAt: 0.3,
          phases: [4],
          enrageDamageIncrease: 0.4
        }
      ],
      phases: [
        {
          hpThreshold: 1.0,
          mechanics: ['Dragon Breath', 'Tail Swipe'],
          adds: null
        },
        {
          hpThreshold: 0.6,
          mechanics: ['Dragon Breath', 'Tail Swipe', 'Summon Whelps'],
          adds: { type: 'Dragon Whelp', count: 2, spawnAt: 0.6 }
        },
        {
          hpThreshold: 0.3,
          mechanics: ['Dragon Breath', 'Tail Swipe', 'Enrage'],
          adds: null
        }
      ]
    },
    rewards: {
      gold: 800,
      tokens: 15,
      experience: 3000,
      guaranteedLoot: ['weapon', 'armor']
    },
    estimatedDuration: 300000 // 5 minutes
  },

  elder_dragon_heroic: {
    id: 'elder_dragon_heroic',
    name: 'Elder Dragon\'s Lair',
    difficulty: 'heroic',
    minLevel: 35,
    minItemScore: 2000,
    minPlayers: 5,
    maxPlayers: 8,
    waves: 5,
    description: 'Face the Elder Dragon at its full power. Only the strongest heroes dare challenge this ancient beast.',
    boss: {
      name: 'Elder Dragon',
      hp: 200000,
      attack: 200,
      defense: 100,
      level: 45,
      mechanics: [
        {
          name: 'Inferno Breath',
          description: 'Breathes devastating fire in a wide cone, dealing massive damage',
          type: 'aoe',
          cooldown: 10000
        },
        {
          name: 'Crushing Tail',
          description: 'Sweeps tail with immense force, dealing heavy damage and stunning players',
          type: 'aoe',
          cooldown: 12000
        },
        {
          name: 'Dragon Flight',
          description: 'Takes to the air, becoming immune to melee attacks for 8 seconds',
          type: 'defensive',
          cooldown: 25000
        },
        {
          name: 'Summon Whelp Pack',
          description: 'At 70% and 40% HP, summons 3 dragon whelps',
          type: 'adds',
          triggerAt: [0.7, 0.4]
        },
        {
          name: 'Fury of the Ancients',
          description: 'At 25% HP, attack speed increases by 60% and all attacks deal 25% more damage',
          type: 'mechanic',
          triggerAt: 0.25
        }
      ]
    },
    rewards: {
      gold: 2000,
      tokens: 40,
      experience: 8000,
      guaranteedLoot: ['weapon', 'armor', 'accessory']
    },
    estimatedDuration: 600000 // 10 minutes
  },

  elder_dragon_mythic: {
    id: 'elder_dragon_mythic',
    name: 'Elder Dragon\'s Lair',
    difficulty: 'mythic',
    minLevel: 50,
    minItemScore: 3500,
    minPlayers: 6,
    maxPlayers: 10,
    waves: 6,
    description: 'Face the Elder Dragon at its absolute peak. The ultimate test of strength and coordination.',
    boss: {
      name: 'Elder Dragon',
      hp: 500000,
      attack: 350,
      defense: 180,
      level: 60,
      mechanics: [
        {
          name: 'Apocalypse Breath',
          description: 'Channels devastating fire that covers the entire battlefield, dealing massive damage',
          type: 'aoe',
          cooldown: 8000
        },
        {
          name: 'Worldbreaker Tail',
          description: 'Sweeps tail with cataclysmic force, dealing extreme damage and applying a debuff',
          type: 'aoe',
          cooldown: 10000
        },
        {
          name: 'Ancient Flight',
          description: 'Takes to the air, becoming immune to all attacks and raining fire for 10 seconds',
          type: 'defensive',
          cooldown: 20000
        },
        {
          name: 'Dragon Horde',
          description: 'At 80%, 60%, and 30% HP, summons 4 dragon whelps',
          type: 'adds',
          triggerAt: [0.8, 0.6, 0.3]
        },
        {
          name: 'Primordial Rage',
          description: 'At 20% HP, attack speed doubles, all attacks deal 50% more damage, and gains damage reduction',
          type: 'mechanic',
          triggerAt: 0.2
        },
        {
          name: 'Dragon\'s Wrath',
          description: 'Every 15 seconds, marks a random player for a devastating single-target attack',
          type: 'single-target',
          cooldown: 15000
        }
      ]
    },
    rewards: {
      gold: 5000,
      tokens: 100,
      experience: 20000,
      guaranteedLoot: ['weapon', 'armor', 'accessory', 'ring']
    },
    estimatedDuration: 900000 // 15 minutes
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
