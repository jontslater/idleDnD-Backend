// Quest Templates - Pools for Daily/Weekly/Monthly Quests

export const DAILY_QUEST_POOL = [
  // Combat Quests
  {
    id: 'kill_enemies_50',
    name: 'Slayer',
    description: 'Kill 50 enemies',
    category: 'combat',
    objective: {
      type: 'kill',
      target: 50,
      specific: null
    },
    rewards: {
      gold: 1000,
      xp: 2000,
      tokens: 10
    }
  },
  {
    id: 'defeat_bosses_5',
    name: 'Boss Hunter',
    description: 'Defeat 5 bosses',
    category: 'combat',
    objective: {
      type: 'defeatBosses',
      target: 5,
      specific: 'boss'
    },
    rewards: {
      gold: 1500,
      xp: 3000,
      tokens: 20
    }
  },
  {
    id: 'complete_waves_10',
    name: 'Wave Rider',
    description: 'Complete 10 waves',
    category: 'combat',
    objective: {
      type: 'completeWaves',
      target: 10,
      specific: null
    },
    rewards: {
      gold: 800,
      xp: 1500,
      tokens: 15
    }
  },
  {
    id: 'survive_bosses_3',
    name: 'Survivor',
    description: 'Survive 3 boss encounters without dying',
    category: 'combat',
    objective: {
      type: 'surviveBosses',
      target: 3,
      specific: 'boss'
    },
    rewards: {
      gold: 2000,
      xp: 5000,
      tokens: 50
    }
  },
  {
    id: 'deal_damage_100k',
    name: 'Damage Dealer',
    description: 'Deal 100,000 damage',
    category: 'combat',
    objective: {
      type: 'dealDamage',
      target: 100000,
      specific: null
    },
    rewards: {
      gold: 1200,
      xp: 2500,
      tokens: 20
    }
  },
  
  // Profession Quests
  {
    id: 'gather_materials_20',
    name: 'Gatherer',
    description: 'Gather 20 materials',
    category: 'profession',
    objective: {
      type: 'gather',
      target: 20,
      specific: null
    },
    rewards: {
      gold: 500,
      xp: 1000,
      tokens: 5,
      materials: [
        { type: 'herbs', rarity: 'common', amount: 5 }
      ]
    }
  },
  {
    id: 'craft_items_5',
    name: 'Craftsman',
    description: 'Craft 5 items',
    category: 'profession',
    objective: {
      type: 'craft',
      target: 5,
      specific: null
    },
    rewards: {
      gold: 1000,
      xp: 2000,
      tokens: 25
    }
  },
  {
    id: 'use_consumables_3',
    name: 'Consumer',
    description: 'Use 3 consumables',
    category: 'profession',
    objective: {
      type: 'use',
      target: 3,
      specific: 'consumable'
    },
    rewards: {
      gold: 500,
      xp: 1000,
      tokens: 10
    }
  },
  
  // Additional Combat Quests
  {
    id: 'heal_amount_50k',
    name: 'Healer',
    description: 'Heal 50,000 HP',
    category: 'combat',
    objective: {
      type: 'healAmount',
      target: 50000,
      specific: null
    },
    rewards: {
      gold: 1000,
      xp: 2000,
      tokens: 20
    }
  },
  {
    id: 'block_damage_25k',
    name: 'Defender',
    description: 'Block 25,000 damage',
    category: 'combat',
    objective: {
      type: 'blockDamage',
      target: 25000,
      specific: null
    },
    rewards: {
      gold: 1000,
      xp: 2000,
      tokens: 15
    }
  }
];

export const DAILY_COMPLETION_BONUS = {
  gold: 5000,
  xp: 10000,
  tokens: 100,
  materials: [
    { type: 'essence', rarity: 'rare', amount: 1 }
  ]
};

export const WEEKLY_QUEST_POOL = [
  // Combat Quests
  {
    id: 'kill_enemies_250',
    name: 'Mass Slayer',
    description: 'Kill 250 enemies',
    category: 'combat',
    objective: {
      type: 'kill',
      target: 250,
      specific: null
    },
    rewards: {
      gold: 5000,
      xp: 10000,
      tokens: 50
    }
  },
  {
    id: 'deal_damage_500k',
    name: 'Damage Expert',
    description: 'Deal 500,000 damage',
    category: 'combat',
    objective: {
      type: 'dealDamage',
      target: 500000,
      specific: null
    },
    rewards: {
      gold: 6000,
      xp: 30000,
      tokens: 100
    }
  },
  
  // Meta Quests
  {
    id: 'complete_dailies_20',
    name: 'Daily Grinder',
    description: 'Complete 20 daily quests',
    category: 'meta',
    objective: {
      type: 'completeDailies',
      target: 20,
      specific: null
    },
    rewards: {
      gold: 5000,
      xp: 25000,
      tokens: 100
    }
  },
  {
    id: 'complete_combat_dailies_5',
    name: 'Combat Specialist',
    description: 'Complete 5 combat daily quests',
    category: 'meta',
    objective: {
      type: 'completeDailies',
      target: 5,
      specific: 'combat'
    },
    rewards: {
      gold: 3000,
      xp: 15000,
      tokens: 75
    }
  },
  
  // Unique Weekly Objectives
  {
    id: 'raid_participation_3',
    name: 'Raid Veteran',
    description: 'Participate in 3 raids',
    category: 'social',
    objective: {
      type: 'raid',
      target: 3,
      specific: null
    },
    rewards: {
      gold: 8000,
      xp: 40000,
      tokens: 200,
      items: [
        {
          name: 'Epic Battle Trophy',
          rarity: 'epic',
          slot: 'accessory',
          attack: 25,
          defense: 15,
          hp: 150
        }
      ]
    }
  },
  {
    id: 'craft_items_25',
    name: 'Master Craftsman',
    description: 'Craft 25 items',
    category: 'profession',
    objective: {
      type: 'craft',
      target: 25,
      specific: null
    },
    rewards: {
      gold: 4000,
      xp: 20000,
      tokens: 100
    }
  },
  {
    id: 'gather_materials_100',
    name: 'Master Gatherer',
    description: 'Gather 100 materials',
    category: 'profession',
    objective: {
      type: 'gather',
      target: 100,
      specific: null
    },
    rewards: {
      gold: 3000,
      xp: 15000,
      tokens: 50,
      materials: [
        { type: 'herbs', rarity: 'uncommon', amount: 20 },
        { type: 'ore', rarity: 'uncommon', amount: 20 }
      ]
    }
  },
  {
    id: 'deal_damage_1m',
    name: 'Damage King',
    description: 'Deal 1,000,000 damage',
    category: 'combat',
    objective: {
      type: 'dealDamage',
      target: 1000000,
      specific: null
    },
    rewards: {
      gold: 10000,
      xp: 50000,
      tokens: 200
    }
  }
];

export const WEEKLY_COMPLETION_BONUS = {
  gold: 25000,
  xp: 100000,
  tokens: 500,
  items: [
    {
      name: 'Legendary Quest Reward',
      rarity: 'legendary',
      slot: 'weapon',
      attack: 80,
      defense: 0,
      hp: 0,
      procEffects: [
        {
          name: 'Quest Champion',
          effect: 'damageBonus',
          value: 0.15,
          chance: 0.25
        }
      ]
    }
  ]
};

export const MONTHLY_QUEST_POOL = [
  // Combat Quests
  {
    id: 'kill_enemies_1000',
    name: 'Legendary Slayer',
    description: 'Kill 1000 enemies',
    category: 'combat',
    objective: {
      type: 'kill',
      target: 1000,
      specific: null
    },
    rewards: {
      gold: 20000,
      xp: 80000,
      tokens: 400
    }
  },
  
  // Social Quests
  {
    id: 'world_boss_1',
    name: 'Boss Challenger',
    description: 'Join 1 world boss event',
    category: 'social',
    objective: {
      type: 'worldBoss',
      target: 1,
      specific: null
    },
    rewards: {
      gold: 15000,
      xp: 60000,
      tokens: 300
    }
  },
  
  // Meta Quests
  {
    id: 'complete_weeklies_15',
    name: 'Weekly Champion',
    description: 'Complete 15 weekly quests',
    category: 'meta',
    objective: {
      type: 'completeWeeklies',
      target: 15,
      specific: null
    },
    rewards: {
      gold: 25000,
      xp: 100000,
      tokens: 500
    }
  },
  {
    id: 'complete_dailies_50',
    name: 'Daily Devotee',
    description: 'Complete 50 daily quests',
    category: 'meta',
    objective: {
      type: 'completeDailies',
      target: 50,
      specific: null
    },
    rewards: {
      gold: 20000,
      xp: 80000,
      tokens: 400
    }
  },
  
  // Unique Monthly Objectives
  {
    id: 'raid_participation_10',
    name: 'Raid Legend',
    description: 'Participate in 10 raids',
    category: 'social',
    objective: {
      type: 'raid',
      target: 10,
      specific: null
    },
    rewards: {
      gold: 30000,
      xp: 150000,
      tokens: 1000,
      items: [
        {
          name: 'Legendary Raid Trophy',
          rarity: 'legendary',
          slot: 'accessory',
          attack: 50,
          defense: 50,
          hp: 500
        }
      ]
    }
  },
  {
    id: 'world_boss_4',
    name: 'World Boss Slayer',
    description: 'Join 4 world boss events',
    category: 'social',
    objective: {
      type: 'worldBoss',
      target: 4,
      specific: null
    },
    rewards: {
      gold: 40000,
      xp: 200000,
      tokens: 800
    }
  },
  {
    id: 'reach_level_40',
    name: 'Ascendant',
    description: 'Reach level 40',
    category: 'meta',
    objective: {
      type: 'reachLevel',
      target: 40,
      specific: null
    },
    rewards: {
      gold: 50000,
      xp: 250000,
      tokens: 1000,
      items: [
        {
          name: 'Mythic Ascension Ring',
          rarity: 'mythic',
          slot: 'accessory',
          attack: 75,
          defense: 75,
          hp: 750
        }
      ]
    }
  },
  {
    id: 'craft_items_100',
    name: 'Legendary Craftsman',
    description: 'Craft 100 items',
    category: 'profession',
    objective: {
      type: 'craft',
      target: 100,
      specific: null
    },
    rewards: {
      gold: 35000,
      xp: 175000,
      tokens: 750
    }
  },
  {
    id: 'item_score_5000',
    name: 'Power Seeker',
    description: 'Achieve 5000 item score',
    category: 'meta',
    objective: {
      type: 'itemScore',
      target: 5000,
      specific: null
    },
    rewards: {
      gold: 45000,
      xp: 225000,
      tokens: 900
    }
  }
];

export const MONTHLY_COMPLETION_BONUS = {
  gold: 100000,
  xp: 500000,
  tokens: 2000,
  items: [
    {
      name: 'Mythic Quest Master Blade',
      rarity: 'mythic',
      slot: 'weapon',
      attack: 150,
      defense: 0,
      hp: 0,
      procEffects: [
        {
          name: 'Quest Mastery',
          effect: 'damageBonus',
          value: 0.25,
          chance: 0.3
        },
        {
          name: 'Devoted Power',
          effect: 'criticalStrike',
          value: 0.5,
          chance: 0.15
        }
      ]
    }
  ]
};

// Helper to select random quests from pool
export function selectDailyQuests(count = 10) {
  const shuffled = [...DAILY_QUEST_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function selectWeeklyQuests(count = 7) {
  const shuffled = [...WEEKLY_QUEST_POOL].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

export function selectMonthlyQuests(count = 5) {
  // For monthly, we want all quests to ensure variety
  return MONTHLY_QUEST_POOL;
}
