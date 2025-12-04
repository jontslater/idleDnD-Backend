// Achievement definitions - Pop culture references with trackable game stats
export const ACHIEVEMENTS = [
  // 🎵 MUSIC REFERENCE ACHIEVEMENTS
  {
    id: 'another-one-bites-the-dust',
    name: 'Another One Bites the Dust',
    description: 'Defeat 10,000 enemies',
    category: 'combat',
    rarity: 'epic',
    requirements: { type: 'killCount', target: 10000 },
    rewards: { title: 'The Relentless', tokens: 500, gold: 5000 }
  },
  {
    id: 'stayin-alive',
    name: "Stayin' Alive",
    description: 'Survive 100 battles with less than 10% HP',
    category: 'combat',
    rarity: 'rare',
    requirements: { type: 'killCount', target: 1000 }, // Placeholder - would need low HP survival tracking
    rewards: { title: 'The Survivor', tokens: 200, gold: 2000 }
  },
  {
    id: 'eye-of-the-tiger',
    name: 'Eye of the Tiger',
    description: 'Defeat 500 bosses',
    category: 'combat',
    rarity: 'epic',
    requirements: { type: 'bossKills', target: 500 },
    rewards: { title: 'The Champion', tokens: 300, gold: 3000 }
  },
  {
    id: 'livin-on-a-prayer',
    name: "Livin' on a Prayer",
    description: 'Heal 10,000,000 total HP',
    category: 'combat',
    rarity: 'epic',
    requirements: { type: 'totalHealing', target: 10000000 },
    rewards: { title: 'The Faithful', tokens: 300, gold: 3000 }
  },
  {
    id: 'thunderstruck',
    name: 'Thunderstruck',
    description: 'Deal 5,000,000 total damage',
    category: 'combat',
    rarity: 'epic',
    requirements: { type: 'totalDamage', target: 5000000 },
    rewards: { title: 'The Electrocuter', tokens: 300, gold: 3000 }
  },
  
  // 🎬 MOVIE & TV REFERENCES
  {
    id: 'you-shall-not-pass',
    name: 'You Shall Not Pass!',
    description: 'Defeat 100 bosses as a tank',
    category: 'combat',
    rarity: 'epic',
    requirements: { type: 'bossKills', target: 100 },
    rewards: { title: 'The Guardian', tokens: 250, gold: 2500 }
  },
  {
    id: 'may-the-force',
    name: 'May the Force Be With You',
    description: 'Reach level 50',
    category: 'progression',
    rarity: 'legendary',
    requirements: { type: 'level', target: 50 },
    rewards: { title: 'The Jedi', tokens: 500, gold: 5000 }
  },
  {
    id: 'i-am-inevitable',
    name: 'I Am Inevitable',
    description: 'Defeat 1,000 bosses',
    category: 'combat',
    rarity: 'legendary',
    requirements: { type: 'bossKills', target: 1000 },
    rewards: { title: 'The Titan', tokens: 1000, gold: 10000 }
  },
  {
    id: 'its-over-9000',
    name: "It's Over 9000!",
    description: 'Deal 9,001 damage in a single hit',
    category: 'combat',
    rarity: 'epic',
    requirements: { type: 'totalDamage', target: 1000000 }, // Approximation since we don't track single hits
    rewards: { title: 'The Super Saiyan', tokens: 400, gold: 4000 }
  },
  {
    id: 'clever-girl',
    name: 'Clever Girl...',
    description: 'Defeat 100 dragon enemies',
    category: 'combat',
    rarity: 'epic',
    requirements: { type: 'bossKills', target: 50 }, // Dragons are usually bosses
    rewards: { title: 'The Raptor Hunter', tokens: 500, gold: 5000 }
  },
  {
    id: 'this-is-sparta',
    name: 'This Is Sparta!',
    description: 'Defeat 300 enemies',
    category: 'combat',
    rarity: 'rare',
    requirements: { type: 'killCount', target: 300 },
    rewards: { title: 'The Spartan', tokens: 150, gold: 3000 }
  },
  
  // 🎮 GAMING CULTURE
  {
    id: 'git-gud',
    name: 'Git Gud',
    description: 'Complete 100 quests',
    category: 'meta',
    rarity: 'legendary',
    requirements: { type: 'questsCompleted', target: 100 },
    rewards: { title: 'The Tryhard', tokens: 500, gold: 5000 }
  },
  {
    id: 'praise-the-sun',
    name: 'Praise the Sun!',
    description: 'Reach level 30',
    category: 'progression',
    rarity: 'rare',
    requirements: { type: 'level', target: 30 },
    rewards: { title: 'The Jolly', tokens: 150, gold: 1500 }
  },
  {
    id: 'leeroy-jenkins',
    name: 'Leeeroy Jenkins!',
    description: 'Defeat 1,000 enemies',
    category: 'combat',
    rarity: 'uncommon',
    requirements: { type: 'killCount', target: 1000 },
    rewards: { title: 'The Rash', tokens: 100, gold: 1000 }
  },
  
  // 🏅 PROGRESSION ACHIEVEMENTS
  {
    id: 'first-blood',
    name: 'First Blood',
    description: 'Defeat your first enemy',
    category: 'progression',
    rarity: 'common',
    requirements: { type: 'killCount', target: 1 },
    rewards: { title: 'The Initiate', tokens: 10, gold: 100 }
  },
  {
    id: 'rising-star',
    name: 'Rising Star',
    description: 'Reach level 10',
    category: 'progression',
    rarity: 'common',
    requirements: { type: 'level', target: 10 },
    rewards: { title: 'Rising Star', tokens: 25, gold: 500 }
  },
  {
    id: 'veteran',
    name: 'Veteran',
    description: 'Reach level 20',
    category: 'progression',
    rarity: 'rare',
    requirements: { type: 'level', target: 20 },
    rewards: { title: 'Veteran', tokens: 100, gold: 1000 }
  },
  {
    id: 'elite',
    name: 'Elite',
    description: 'Reach level 40',
    category: 'progression',
    rarity: 'epic',
    requirements: { type: 'level', target: 40 },
    rewards: { title: 'Elite', tokens: 300, gold: 3000 }
  },
  {
    id: 'legend',
    name: 'Legend',
    description: 'Reach level 60',
    category: 'progression',
    rarity: 'legendary',
    requirements: { type: 'level', target: 60 },
    rewards: { title: 'Legend', tokens: 1000, gold: 10000 }
  },
  {
    id: 'millionaire',
    name: 'Millionaire',
    description: 'Accumulate 1,000,000 gold',
    category: 'progression',
    rarity: 'epic',
    requirements: { type: 'level', target: 50 }, // Placeholder - would need gold tracking
    rewards: { title: 'The Rich', tokens: 500, gold: 0 }
  },
  
  // 💼 CLASS-SPECIFIC
  {
    id: 'the-unyielding',
    name: 'The Immovable Object',
    description: 'Defeat 5,000 enemies as a tank',
    category: 'class',
    rarity: 'legendary',
    requirements: { type: 'killCount', target: 5000 },
    rewards: { title: 'The Unyielding', tokens: 500, gold: 5000 }
  },
  {
    id: 'dr-feel-good',
    name: 'Dr. Feel Good',
    description: 'Heal 10,000,000 HP total',
    category: 'class',
    rarity: 'legendary',
    requirements: { type: 'totalHealing', target: 10000000 },
    rewards: { title: 'The Physician', tokens: 500, gold: 5000 }
  },
  {
    id: 'glass-cannon',
    name: 'Glass Cannon',
    description: 'Deal 10,000,000 total damage',
    category: 'class',
    rarity: 'epic',
    requirements: { type: 'totalDamage', target: 10000000 },
    rewards: { title: 'The Fragile Fury', tokens: 300, gold: 3000 }
  },
  {
    id: 'top-dps',
    name: 'Top DPS',
    description: 'Deal 25,000,000 total damage',
    category: 'class',
    rarity: 'legendary',
    requirements: { type: 'totalDamage', target: 25000000 },
    rewards: { title: 'The Carry', tokens: 1000, gold: 5000 }
  },
  
  // 🌟 PROFESSION
  {
    id: 'gatherer',
    name: 'Gatherer',
    description: 'Gather 1,000 materials',
    category: 'profession',
    rarity: 'common',
    requirements: { type: 'gatherCount', target: 1000 },
    rewards: { title: 'Gatherer', tokens: 50, gold: 500 }
  },
  {
    id: 'master-gatherer',
    name: 'Master Gatherer',
    description: 'Gather 10,000 materials',
    category: 'profession',
    rarity: 'epic',
    requirements: { type: 'gatherCount', target: 10000 },
    rewards: { title: 'Master Gatherer', tokens: 300, gold: 3000 }
  },
  {
    id: 'crafter',
    name: 'Crafter',
    description: 'Craft 100 items',
    category: 'profession',
    rarity: 'rare',
    requirements: { type: 'craftCount', target: 100 },
    rewards: { title: 'Crafter', tokens: 150, gold: 1500 }
  },
  {
    id: 'master-crafter',
    name: 'Master Crafter',
    description: 'Craft 1,000 items',
    category: 'profession',
    rarity: 'epic',
    requirements: { type: 'craftCount', target: 1000 },
    rewards: { title: 'Master Crafter', tokens: 400, gold: 4000 }
  },
  
  // 👥 SOCIAL
  {
    id: 'guild-member',
    name: 'Guild Member',
    description: 'Join a guild',
    category: 'social',
    rarity: 'common',
    requirements: { type: 'guildJoin', target: 1 },
    rewards: { title: 'Guild Member', tokens: 25, gold: 500 }
  },
  {
    id: 'guild-veteran',
    name: 'Guild Veteran',
    description: 'Reach guild level 5',
    category: 'social',
    rarity: 'rare',
    requirements: { type: 'guildLevel', target: 5 },
    rewards: { title: 'Guild Veteran', tokens: 200, gold: 2000 }
  },
  {
    id: 'guild-master',
    name: 'Guild Master',
    description: 'Reach guild level 10',
    category: 'social',
    rarity: 'epic',
    requirements: { type: 'guildLevel', target: 10 },
    rewards: { title: 'Guild Master', tokens: 500, gold: 5000 }
  },
  
  // 📜 QUESTS
  {
    id: 'quest-beginner',
    name: 'Quest Beginner',
    description: 'Complete 10 quests',
    category: 'meta',
    rarity: 'common',
    requirements: { type: 'questsCompleted', target: 10 },
    rewards: { title: 'Quest Beginner', tokens: 25, gold: 250 }
  },
  {
    id: 'quest-master',
    name: 'Quest Master',
    description: 'Complete 100 quests',
    category: 'meta',
    rarity: 'epic',
    requirements: { type: 'questsCompleted', target: 100 },
    rewards: { title: 'Quest Master', tokens: 300, gold: 3000 }
  },
  {
    id: 'quest-legend',
    name: 'Quest Legend',
    description: 'Complete 500 quests',
    category: 'meta',
    rarity: 'legendary',
    requirements: { type: 'questsCompleted', target: 500 },
    rewards: { title: 'Quest Legend', tokens: 1000, gold: 10000 }
  },
  
  // 💀 BOSS SLAYER (Renamed from offensive ones)
  {
    id: 'boss-slayer',
    name: 'Boss Slayer',
    description: 'Defeat 10 bosses',
    category: 'combat',
    rarity: 'rare',
    requirements: { type: 'bossKills', target: 10 },
    rewards: { title: 'Boss Slayer', tokens: 150, gold: 1500 }
  },
  {
    id: 'boss-master',
    name: 'Boss Master',
    description: 'Defeat 100 bosses',
    category: 'combat',
    rarity: 'epic',
    requirements: { type: 'bossKills', target: 100 },
    rewards: { title: 'Boss Master', tokens: 500, gold: 5000 }
  },
  {
    id: 'boss-legend',
    name: 'Boss Legend',
    description: 'Defeat 1,000 bosses',
    category: 'combat',
    rarity: 'legendary',
    requirements: { type: 'bossKills', target: 1000 },
    rewards: { title: 'Boss Legend', tokens: 2000, gold: 20000 }
  },
  
  // ⚔️ COMBAT MILESTONES
  {
    id: 'slayer',
    name: 'Slayer',
    description: 'Kill 100 enemies',
    category: 'combat',
    rarity: 'common',
    requirements: { type: 'killCount', target: 100 },
    rewards: { title: 'Slayer', tokens: 50, gold: 500 }
  },
  {
    id: 'executioner',
    name: 'Executioner',
    description: 'Kill 1,000 enemies',
    category: 'combat',
    rarity: 'rare',
    requirements: { type: 'killCount', target: 1000 },
    rewards: { title: 'Executioner', tokens: 200, gold: 2000 }
  },
  {
    id: 'hunter',
    name: 'Hunter',
    description: 'Kill 10,000 enemies',
    category: 'combat',
    rarity: 'epic',
    requirements: { type: 'killCount', target: 10000 },
    rewards: { title: 'Hunter', tokens: 1000, gold: 10000 }
  },
  {
    id: 'destroyer',
    name: 'Destroyer',
    description: 'Kill 50,000 enemies',
    category: 'combat',
    rarity: 'legendary',
    requirements: { type: 'killCount', target: 50000 },
    rewards: { title: 'Destroyer', tokens: 3000, gold: 30000 }
  },
  
  // 🎓 SKILLS
  {
    id: 'skill-learner',
    name: 'Skill Learner',
    description: 'Unlock 5 skills',
    category: 'meta',
    rarity: 'common',
    requirements: { type: 'skillsUnlocked', target: 5 },
    rewards: { title: 'Skill Learner', tokens: 50, gold: 500 }
  },
  {
    id: 'skill-master',
    name: 'Skill Master',
    description: 'Unlock all skills for your class',
    category: 'meta',
    rarity: 'legendary',
    requirements: { type: 'skillsUnlocked', target: 10 },
    rewards: { title: 'Skill Master', tokens: 1000, gold: 10000 }
  }
];

export function getAchievementById(id) {
  return ACHIEVEMENTS.find(a => a.id === id);
}

export function getAchievementsByCategory(category) {
  return ACHIEVEMENTS.filter(a => a.category === category);
}
