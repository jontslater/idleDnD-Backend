// Achievement definitions
export const ACHIEVEMENTS = [
  // Combat Achievements
  { id: 'kill_100', name: 'Slayer', description: 'Kill 100 enemies', category: 'combat', rarity: 'common', requirements: { type: 'killCount', target: 100 }, rewards: { title: 'Slayer', tokens: 50 } },
  { id: 'kill_1000', name: 'Massacre', description: 'Kill 1,000 enemies', category: 'combat', rarity: 'rare', requirements: { type: 'killCount', target: 1000 }, rewards: { title: 'Massacre', tokens: 200 } },
  { id: 'kill_10000', name: 'Genocide', description: 'Kill 10,000 enemies', category: 'combat', rarity: 'epic', requirements: { type: 'killCount', target: 10000 }, rewards: { title: 'Genocide', tokens: 1000 } },
  { id: 'boss_kill_10', name: 'Boss Slayer', description: 'Defeat 10 bosses', category: 'combat', rarity: 'rare', requirements: { type: 'bossKills', target: 10 }, rewards: { title: 'Boss Slayer', tokens: 150 } },
  { id: 'boss_kill_100', name: 'Boss Master', description: 'Defeat 100 bosses', category: 'combat', rarity: 'epic', requirements: { type: 'bossKills', target: 100 }, rewards: { title: 'Boss Master', tokens: 500 } },
  { id: 'deal_1m_damage', name: 'Damage Dealer', description: 'Deal 1,000,000 total damage', category: 'combat', rarity: 'rare', requirements: { type: 'totalDamage', target: 1000000 }, rewards: { title: 'Damage Dealer', tokens: 200 } },
  { id: 'heal_1m', name: 'Master Healer', description: 'Heal 1,000,000 total HP', category: 'combat', rarity: 'rare', requirements: { type: 'totalHealing', target: 1000000 }, rewards: { title: 'Master Healer', tokens: 200 } },
  
  // Progression Achievements
  { id: 'level_10', name: 'Rising Star', description: 'Reach level 10', category: 'progression', rarity: 'common', requirements: { type: 'level', target: 10 }, rewards: { title: 'Rising Star', tokens: 25 } },
  { id: 'level_20', name: 'Veteran', description: 'Reach level 20', category: 'progression', rarity: 'rare', requirements: { type: 'level', target: 20 }, rewards: { title: 'Veteran', tokens: 100 } },
  { id: 'level_30', name: 'Elite', description: 'Reach level 30', category: 'progression', rarity: 'epic', requirements: { type: 'level', target: 30 }, rewards: { title: 'Elite', tokens: 300 } },
  { id: 'level_50', name: 'Legend', description: 'Reach level 50', category: 'progression', rarity: 'legendary', requirements: { type: 'level', target: 50 }, rewards: { title: 'Legend', tokens: 1000 } },
  
  // Profession Achievements
  { id: 'gather_1000', name: 'Gatherer', description: 'Gather 1,000 materials', category: 'profession', rarity: 'common', requirements: { type: 'gatherCount', target: 1000 }, rewards: { title: 'Gatherer', tokens: 50 } },
  { id: 'craft_100', name: 'Crafter', description: 'Craft 100 items', category: 'profession', rarity: 'rare', requirements: { type: 'craftCount', target: 100 }, rewards: { title: 'Crafter', tokens: 150 } },
  
  // Social Achievements
  { id: 'join_guild', name: 'Guild Member', description: 'Join a guild', category: 'social', rarity: 'common', requirements: { type: 'guildJoin', target: 1 }, rewards: { title: 'Guild Member', tokens: 25 } },
  { id: 'guild_level_10', name: 'Guild Master', description: 'Reach guild level 10', category: 'social', rarity: 'epic', requirements: { type: 'guildLevel', target: 10 }, rewards: { title: 'Guild Master', tokens: 500 } },
  
  // Meta Achievements
  { id: 'complete_100_quests', name: 'Quest Master', description: 'Complete 100 quests', category: 'meta', rarity: 'epic', requirements: { type: 'questsCompleted', target: 100 }, rewards: { title: 'Quest Master', tokens: 300 } },
  { id: 'unlock_all_skills', name: 'Skill Master', description: 'Unlock all skills for your class', category: 'meta', rarity: 'legendary', requirements: { type: 'skillsUnlocked', target: 10 }, rewards: { title: 'Skill Master', tokens: 1000 } }
];

export function getAchievementById(id) {
  return ACHIEVEMENTS.find(a => a.id === id);
}

export function getAchievementsByCategory(category) {
  return ACHIEVEMENTS.filter(a => a.category === category);
}
