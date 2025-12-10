// Achievement definitions - Pop Culture, Gaming & Internet Culture References
export const ACHIEVEMENTS = [
  // Combat Achievements - Kills
  { id: 'kill_100', name: 'First Blood', description: 'Kill 100 enemies', category: 'combat', rarity: 'common', requirements: { type: 'killCount', target: 100 }, rewards: { title: 'First Blood', tokens: 50 } },
  { id: 'kill_500', name: 'Killing Spree', description: 'Kill 500 enemies', category: 'combat', rarity: 'common', requirements: { type: 'killCount', target: 500 }, rewards: { title: 'Killing Spree', tokens: 100 } },
  { id: 'kill_1000', name: 'Rampage', description: 'Kill 1,000 enemies', category: 'combat', rarity: 'rare', requirements: { type: 'killCount', target: 1000 }, rewards: { title: 'Rampage', tokens: 200 } },
  { id: 'kill_5000', name: 'Dominating', description: 'Kill 5,000 enemies', category: 'combat', rarity: 'rare', requirements: { type: 'killCount', target: 5000 }, rewards: { title: 'Dominating', tokens: 300 } },
  { id: 'kill_10000', name: 'Godlike', description: 'Kill 10,000 enemies', category: 'combat', rarity: 'epic', requirements: { type: 'killCount', target: 10000 }, rewards: { title: 'Godlike', tokens: 500 } },
  
  // Combat Achievements - Bosses
  { id: 'boss_kill_5', name: 'Boss Music Started Playing', description: 'Defeat 5 bosses', category: 'combat', rarity: 'common', requirements: { type: 'bossKills', target: 5 }, rewards: { title: 'Boss Hunter', tokens: 75 } },
  { id: 'boss_kill_10', name: 'GG EZ', description: 'Defeat 10 bosses', category: 'combat', rarity: 'rare', requirements: { type: 'bossKills', target: 10 }, rewards: { title: 'GG EZ', tokens: 150 } },
  { id: 'boss_kill_50', name: 'OP Please Nerf', description: 'Defeat 50 bosses', category: 'combat', rarity: 'epic', requirements: { type: 'bossKills', target: 50 }, rewards: { title: 'OP Please Nerf', tokens: 400 } },
  { id: 'boss_kill_100', name: 'Final Boss', description: 'Defeat 100 bosses', category: 'combat', rarity: 'epic', requirements: { type: 'bossKills', target: 100 }, rewards: { title: 'Final Boss', tokens: 500 } },
  
  // Combat Achievements - Damage
  { id: 'deal_100k_damage', name: 'Critical Hit!', description: 'Deal 100,000 total damage', category: 'combat', rarity: 'common', requirements: { type: 'totalDamage', target: 100000 }, rewards: { title: 'Crit Master', tokens: 50 } },
  { id: 'deal_500k_damage', name: 'That\'s A Lot of Damage', description: 'Deal 500,000 total damage', category: 'combat', rarity: 'rare', requirements: { type: 'totalDamage', target: 500000 }, rewards: { title: 'Flex Tape', tokens: 150 } },
  { id: 'deal_1m_damage', name: 'One Punch Man', description: 'Deal 1,000,000 total damage', category: 'combat', rarity: 'rare', requirements: { type: 'totalDamage', target: 1000000 }, rewards: { title: 'One Punch', tokens: 200 } },
  { id: 'deal_10m_damage', name: 'Omae Wa Mou Shindeiru', description: 'Deal 10,000,000 total damage', category: 'combat', rarity: 'epic', requirements: { type: 'totalDamage', target: 10000000 }, rewards: { title: 'NANI?!', tokens: 500 } },
  
  // Combat Achievements - Healing
  { id: 'heal_100k', name: 'White Mage', description: 'Heal 100,000 total HP', category: 'combat', rarity: 'common', requirements: { type: 'totalHealing', target: 100000 }, rewards: { title: 'White Mage', tokens: 50 } },
  { id: 'heal_500k', name: 'Jesus Mode Activated', description: 'Heal 500,000 total HP', category: 'combat', rarity: 'rare', requirements: { type: 'totalHealing', target: 500000 }, rewards: { title: 'Jesus Mode', tokens: 150 } },
  { id: 'heal_1m', name: 'Plot Armor', description: 'Heal 1,000,000 total HP', category: 'combat', rarity: 'rare', requirements: { type: 'totalHealing', target: 1000000 }, rewards: { title: 'Plot Armor', tokens: 200 } },
  { id: 'heal_10m', name: 'It\'s Just A Flesh Wound', description: 'Heal 10,000,000 total HP', category: 'combat', rarity: 'epic', requirements: { type: 'totalHealing', target: 10000000 }, rewards: { title: 'Flesh Wound', tokens: 500 } },
  
  // Combat Achievements - Tanking/Taunts
  { id: 'taunt_100', name: 'Hit Me Baby One More Time', description: 'Taunt 100 enemies', category: 'combat', rarity: 'common', requirements: { type: 'tauntCount', target: 100 }, rewards: { title: 'Britney', tokens: 75 } },
  { id: 'taunt_1000', name: 'Come At Me Bro', description: 'Taunt 1,000 enemies', category: 'combat', rarity: 'rare', requirements: { type: 'tauntCount', target: 1000 }, rewards: { title: 'Come At Me', tokens: 200 } },
  { id: 'taunt_10000', name: 'Git Gud', description: 'Taunt 10,000 enemies', category: 'combat', rarity: 'epic', requirements: { type: 'tauntCount', target: 10000 }, rewards: { title: 'Git Gud', tokens: 500 } },
  
  // Combat Achievements - Blocks/Mitigation
  { id: 'block_100k', name: 'Big Chungus Defense', description: 'Block 100,000 total damage', category: 'combat', rarity: 'common', requirements: { type: 'totalBlocked', target: 100000 }, rewards: { title: 'Chungus', tokens: 75 } },
  { id: 'block_1m', name: 'You Shall Not Pass', description: 'Block 1,000,000 total damage', category: 'combat', rarity: 'rare', requirements: { type: 'totalBlocked', target: 1000000 }, rewards: { title: 'Gandalf', tokens: 200 } },
  
  // Progression Achievements
  { id: 'level_5', name: 'Started from the Bottom', description: 'Reach level 5', category: 'progression', rarity: 'common', requirements: { type: 'level', target: 5 }, rewards: { title: 'Bottom', tokens: 15 } },
  { id: 'level_10', name: 'That\'s What She Said', description: 'Reach level 10', category: 'progression', rarity: 'common', requirements: { type: 'level', target: 10 }, rewards: { title: 'That\'s What', tokens: 25 } },
  { id: 'level_15', name: 'You\'re a Wizard, Harry', description: 'Reach level 15', category: 'progression', rarity: 'common', requirements: { type: 'level', target: 15 }, rewards: { title: 'Wizard', tokens: 50 } },
  { id: 'level_20', name: 'What Level Are You?', description: 'Reach level 20', category: 'progression', rarity: 'rare', requirements: { type: 'level', target: 20 }, rewards: { title: 'Level 20', tokens: 100 } },
  { id: 'level_25', name: 'Halfway There', description: 'Reach level 25', category: 'progression', rarity: 'rare', requirements: { type: 'level', target: 25 }, rewards: { title: 'Halfway', tokens: 150 } },
  { id: 'level_30', name: 'It\'s Over 9000!', description: 'Reach level 30', category: 'progression', rarity: 'epic', requirements: { type: 'level', target: 30 }, rewards: { title: 'Over 9000', tokens: 300 } },
  { id: 'level_40', name: 'Ascended', description: 'Reach level 40', category: 'progression', rarity: 'epic', requirements: { type: 'level', target: 40 }, rewards: { title: 'Ascended', tokens: 500 } },
  { id: 'level_50', name: 'Living Legend', description: 'Reach level 50', category: 'progression', rarity: 'legendary', requirements: { type: 'level', target: 50 }, rewards: { title: 'Legend', tokens: 1000 } },
  
  // Profession Achievements
  { id: 'gather_100', name: 'Minecraft Steve', description: 'Gather 100 materials', category: 'profession', rarity: 'common', requirements: { type: 'gatherCount', target: 100 }, rewards: { title: 'Steve', tokens: 25 } },
  { id: 'gather_500', name: 'Gather \'Round Children', description: 'Gather 500 materials', category: 'profession', rarity: 'common', requirements: { type: 'gatherCount', target: 500 }, rewards: { title: 'Gather Round', tokens: 50 } },
  { id: 'gather_1000', name: 'Diamond Hands', description: 'Gather 1,000 materials', category: 'profession', rarity: 'common', requirements: { type: 'gatherCount', target: 1000 }, rewards: { title: 'Diamond Hands', tokens: 50 } },
  { id: 'gather_10000', name: 'Hoarder', description: 'Gather 10,000 materials', category: 'profession', rarity: 'rare', requirements: { type: 'gatherCount', target: 10000 }, rewards: { title: 'Hoarder', tokens: 200 } },
  { id: 'craft_50', name: 'Craft Master 3000', description: 'Craft 50 items', category: 'profession', rarity: 'common', requirements: { type: 'craftCount', target: 50 }, rewards: { title: 'Craft Master 3000', tokens: 75 } },
  { id: 'craft_100', name: 'How It\'s Made', description: 'Craft 100 items', category: 'profession', rarity: 'rare', requirements: { type: 'craftCount', target: 100 }, rewards: { title: 'How It\'s Made', tokens: 150 } },
  { id: 'craft_500', name: 'Tony Stark', description: 'Craft 500 items', category: 'profession', rarity: 'epic', requirements: { type: 'craftCount', target: 500 }, rewards: { title: 'Tony Stark', tokens: 400 } },
  
  // Social Achievements
  { id: 'join_guild', name: 'Together We Stand', description: 'Join a guild', category: 'social', rarity: 'common', requirements: { type: 'guildJoin', target: 1 }, rewards: { title: 'Guild Member', tokens: 25 } },
  { id: 'guild_level_5', name: 'Squad Goals', description: 'Reach guild level 5', category: 'social', rarity: 'rare', requirements: { type: 'guildLevel', target: 5 }, rewards: { title: 'Squad Member', tokens: 200 } },
  { id: 'guild_level_10', name: 'Power Rangers Assemble', description: 'Reach guild level 10', category: 'social', rarity: 'epic', requirements: { type: 'guildLevel', target: 10 }, rewards: { title: 'Guild Master', tokens: 500 } },
  
  // Meta Achievements
  { id: 'complete_10_quests', name: 'Side Quest Enjoyer', description: 'Complete 10 quests', category: 'meta', rarity: 'common', requirements: { type: 'questsCompleted', target: 10 }, rewards: { title: 'Side Quest Enjoyer', tokens: 50 } },
  { id: 'complete_50_quests', name: 'Main Character Energy', description: 'Complete 50 quests', category: 'meta', rarity: 'rare', requirements: { type: 'questsCompleted', target: 50 }, rewards: { title: 'Main Character', tokens: 150 } },
  { id: 'complete_100_quests', name: 'Completionist', description: 'Complete 100 quests', category: 'meta', rarity: 'epic', requirements: { type: 'questsCompleted', target: 100 }, rewards: { title: 'Completionist', tokens: 300 } },
  { id: 'unlock_5_skills', name: 'Jack of All Trades', description: 'Unlock 5 skills', category: 'meta', rarity: 'common', requirements: { type: 'skillsUnlocked', target: 5 }, rewards: { title: 'Jack of All Trades', tokens: 75 } },
  { id: 'unlock_all_skills', name: 'Master of All', description: 'Unlock all skills for your class', category: 'meta', rarity: 'legendary', requirements: { type: 'skillsUnlocked', target: 10 }, rewards: { title: 'Master of All', tokens: 1000 } }
];

export function getAchievementById(id) {
  return ACHIEVEMENTS.find(a => a.id === id);
}

export function getAchievementsByCategory(category) {
  return ACHIEVEMENTS.filter(a => a.category === category);
}
