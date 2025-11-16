import admin from 'firebase-admin';

// Quest objective templates with level scaling
const QUEST_TEMPLATES = {
  combat: {
    kill_enemies: {
      name: ['Slayer', 'Hunter', 'Exterminator', 'Reaper', 'Vanquisher'],
      description: (count) => `Kill ${count} enemies`,
      type: 'kill',
      scaling: {
        daily: { newbie: 20, intermediate: 50, veteran: 100, elite: 200 },
        weekly: { newbie: 100, intermediate: 250, veteran: 500, elite: 1000 },
        monthly: { newbie: 400, intermediate: 1000, veteran: 2000, elite: 4000 }
      }
    },
    defeat_bosses: {
      name: ['Boss Hunter', 'Elite Slayer', 'Champion Killer', 'Titan Destroyer'],
      description: (count) => `Defeat ${count} bosses`,
      type: 'defeatBosses',
      scaling: {
        daily: { newbie: 3, intermediate: 5, veteran: 8, elite: 15 },
        weekly: { newbie: 15, intermediate: 25, veteran: 40, elite: 75 },
        monthly: { newbie: 60, intermediate: 100, veteran: 160, elite: 300 }
      }
    },
    complete_waves: {
      name: ['Wave Rider', 'Survivor', 'Endurance Runner', 'Marathon Master'],
      description: (count) => `Complete ${count} waves`,
      type: 'completeWaves',
      scaling: {
        daily: { newbie: 5, intermediate: 10, veteran: 20, elite: 35 },
        weekly: { newbie: 25, intermediate: 50, veteran: 100, elite: 175 },
        monthly: { newbie: 100, intermediate: 200, veteran: 400, elite: 700 }
      }
    },
    deal_damage: {
      name: ['Damage Dealer', 'Devastator', 'Annihilator', 'Obliterator'],
      description: (count) => `Deal ${formatNumber(count)} damage`,
      type: 'dealDamage',
      scaling: {
        daily: { newbie: 50000, intermediate: 100000, veteran: 500000, elite: 2000000 },
        weekly: { newbie: 250000, intermediate: 500000, veteran: 2500000, elite: 10000000 },
        monthly: { newbie: 1000000, intermediate: 2000000, veteran: 10000000, elite: 40000000 }
      }
    },
    heal_amount: {
      name: ['Healer', 'Life Giver', 'Restoration Master', 'Divine Medic'],
      description: (count) => `Heal ${formatNumber(count)} HP`,
      type: 'healAmount',
      scaling: {
        daily: { newbie: 25000, intermediate: 50000, veteran: 250000, elite: 1000000 },
        weekly: { newbie: 125000, intermediate: 250000, veteran: 1250000, elite: 5000000 },
        monthly: { newbie: 500000, intermediate: 1000000, veteran: 5000000, elite: 20000000 }
      }
    },
    block_damage: {
      name: ['Defender', 'Shield Master', 'Iron Wall', 'Unbreakable'],
      description: (count) => `Block ${formatNumber(count)} damage`,
      type: 'blockDamage',
      scaling: {
        daily: { newbie: 15000, intermediate: 25000, veteran: 100000, elite: 400000 },
        weekly: { newbie: 75000, intermediate: 125000, veteran: 500000, elite: 2000000 },
        monthly: { newbie: 300000, intermediate: 500000, veteran: 2000000, elite: 8000000 }
      }
    },
    survive_bosses: {
      name: ['Survivor', 'Untouchable', 'Death Defier', 'Immortal'],
      description: (count) => `Survive ${count} boss encounters without dying`,
      type: 'surviveBosses',
      scaling: {
        daily: { newbie: 2, intermediate: 3, veteran: 5, elite: 10 },
        weekly: { newbie: 10, intermediate: 15, veteran: 25, elite: 50 },
        monthly: { newbie: 40, intermediate: 60, veteran: 100, elite: 200 }
      }
    }
  },
  profession: {
    gather_materials: {
      name: ['Gatherer', 'Collector', 'Resource Master', 'Harvest King'],
      description: (count) => `Gather ${count} materials`,
      type: 'gather',
      scaling: {
        daily: { newbie: 10, intermediate: 20, veteran: 40, elite: 80 },
        weekly: { newbie: 50, intermediate: 100, veteran: 200, elite: 400 },
        monthly: { newbie: 200, intermediate: 400, veteran: 800, elite: 1600 }
      }
    },
    craft_items: {
      name: ['Craftsman', 'Artisan', 'Master Crafter', 'Legendary Smith'],
      description: (count) => `Craft ${count} items`,
      type: 'craft',
      scaling: {
        daily: { newbie: 3, intermediate: 5, veteran: 10, elite: 20 },
        weekly: { newbie: 15, intermediate: 25, veteran: 50, elite: 100 },
        monthly: { newbie: 60, intermediate: 100, veteran: 200, elite: 400 }
      }
    },
    use_consumables: {
      name: ['Consumer', 'Elixir Expert', 'Potion Master', 'Alchemist Supreme'],
      description: (count) => `Use ${count} consumables`,
      type: 'use',
      scaling: {
        daily: { newbie: 2, intermediate: 3, veteran: 5, elite: 10 },
        weekly: { newbie: 10, intermediate: 15, veteran: 25, elite: 50 },
        monthly: { newbie: 40, intermediate: 60, veteran: 100, elite: 200 }
      }
    }
  },
  social: {
    raid_participation: {
      name: ['Raid Novice', 'Raid Veteran', 'Raid Master', 'Raid Legend'],
      description: (count) => `Participate in ${count} raids`,
      type: 'raid',
      scaling: {
        weekly: { newbie: 2, intermediate: 3, veteran: 5, elite: 10 },
        monthly: { newbie: 8, intermediate: 12, veteran: 20, elite: 40 }
      }
    },
    world_boss: {
      name: ['Boss Challenger', 'Boss Slayer', 'Boss Destroyer', 'Boss Annihilator'],
      description: (count) => `Join ${count} world boss event${count > 1 ? 's' : ''}`,
      type: 'worldBoss',
      scaling: {
        weekly: { newbie: 1, intermediate: 1, veteran: 2, elite: 3 },
        monthly: { newbie: 2, intermediate: 3, veteran: 5, elite: 8 }
      }
    }
  }
};

// Level brackets for quest scaling
const LEVEL_BRACKETS = {
  newbie: { min: 1, max: 10, label: 'Novice' },
  intermediate: { min: 11, max: 25, label: 'Adept' },
  veteran: { min: 26, max: 40, label: 'Veteran' },
  elite: { min: 41, max: 100, label: 'Elite' }
};

// Reward scaling based on quest type and tier
function calculateRewards(questType, tier, questPeriod) {
  const baseRewards = {
    daily: { gold: 250, xp: 1000, tokens: 5 }, // Reduced gold by 50%, tokens by 50%
    weekly: { gold: 1500, xp: 15000, tokens: 38 }, // Reduced gold by 50%, tokens by 50% (rounded)
    monthly: { gold: 7500, xp: 75000, tokens: 200 } // Reduced gold by 50%, tokens by 50%
  };
  
  const tierMultiplier = {
    newbie: 1,
    intermediate: 1.5,
    veteran: 2.5,
    elite: 4
  };
  
  const base = baseRewards[questPeriod];
  const multiplier = tierMultiplier[tier];
  
  return {
    gold: Math.floor(base.gold * multiplier),
    xp: Math.floor(base.xp * multiplier),
    tokens: Math.floor(base.tokens * multiplier)
  };
}

// Generate a random quest from a template
function generateQuestFromTemplate(templateKey, template, questPeriod, tier, index) {
  const scaling = template.scaling[questPeriod];
  if (!scaling) return null; // Template not available for this period
  
  const target = scaling[tier];
  const nameSuffix = LEVEL_BRACKETS[tier].label;
  const nameVariations = template.name;
  const questName = `${nameVariations[index % nameVariations.length]} (${nameSuffix})`;
  
  const rewards = calculateRewards(templateKey, tier, questPeriod);
  
  // Add material rewards for profession quests
  if (templateKey.includes('gather') || templateKey.includes('craft')) {
    rewards.materials = [
      { 
        type: Math.random() > 0.5 ? 'herbs' : 'ore', 
        rarity: tier === 'elite' ? 'rare' : tier === 'veteran' ? 'uncommon' : 'common',
        amount: questPeriod === 'monthly' ? 20 : questPeriod === 'weekly' ? 10 : 5
      }
    ];
  }
  
  // Generate unique ID based on template + tier + period + random
  const questId = `${templateKey}_${tier}_${questPeriod}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  
  return {
    id: questId,
    name: questName,
    description: template.description(target),
    category: Object.keys(QUEST_TEMPLATES).find(cat => QUEST_TEMPLATES[cat][templateKey]),
    objective: {
      type: template.type,
      target,
      specific: template.type === 'defeatBosses' || template.type === 'surviveBosses' ? 'boss' : null
    },
    rewards,
    tier,
    levelRange: LEVEL_BRACKETS[tier]
  };
}

// Generate quests for a specific period and mix of tiers
export function generateDynamicQuests(questPeriod, count = 10) {
  const quests = [];
  const allTemplates = [];
  
  // Flatten all templates into array
  Object.keys(QUEST_TEMPLATES).forEach(category => {
    Object.keys(QUEST_TEMPLATES[category]).forEach(templateKey => {
      const template = QUEST_TEMPLATES[category][templateKey];
      if (template.scaling[questPeriod]) {
        allTemplates.push({ key: templateKey, template });
      }
    });
  });
  
  // Shuffle templates
  const shuffled = allTemplates.sort(() => Math.random() - 0.5);
  
  // Tier distribution (more quests for lower tiers, fewer for high tiers)
  const tierDistribution = {
    daily: ['newbie', 'newbie', 'newbie', 'intermediate', 'intermediate', 'intermediate', 'veteran', 'veteran', 'elite', 'elite'],
    weekly: ['newbie', 'intermediate', 'intermediate', 'veteran', 'veteran', 'elite', 'elite'],
    monthly: ['newbie', 'intermediate', 'veteran', 'veteran', 'elite', 'elite', 'elite']
  };
  
  const tiers = tierDistribution[questPeriod] || tierDistribution.daily;
  
  // Generate quests
  for (let i = 0; i < Math.min(count, shuffled.length); i++) {
    const { key, template } = shuffled[i];
    const tier = tiers[i % tiers.length];
    const quest = generateQuestFromTemplate(key, template, questPeriod, tier, i);
    
    if (quest) {
      quests.push(quest);
    }
  }
  
  return quests;
}

// Generate completion bonus based on period
export function generateCompletionBonus(questPeriod) {
  const bonuses = {
    daily: {
      gold: 2500, // Reduced by 50%
      xp: 10000,
      tokens: 50, // Reduced by 50%
      materials: [{ type: 'essence', rarity: 'rare', amount: 1 }]
    },
    weekly: {
      gold: 12500, // Reduced by 50%
      xp: 100000,
      tokens: 250, // Reduced by 50%
      items: [{
        name: 'Weekly Champion Trophy',
        rarity: 'epic',
        slot: 'accessory',
        attack: 35,
        defense: 25,
        hp: 200
      }]
    },
    monthly: {
      gold: 50000, // Reduced by 50%
      xp: 500000,
      tokens: 1000, // Reduced by 50%
      items: [{
        name: 'Monthly Grandmaster Relic',
        rarity: 'legendary',
        slot: 'accessory',
        attack: 75,
        defense: 75,
        hp: 750,
        procEffects: [{
          name: 'Quest Champion',
          effect: 'damageBonus',
          value: 0.2,
          chance: 0.25
        }]
      }]
    }
  };
  
  return bonuses[questPeriod];
}

// Helper to format numbers
function formatNumber(num) {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M';
  } else if (num >= 1000) {
    return (num / 1000).toFixed(0) + 'K';
  }
  return num.toString();
}
