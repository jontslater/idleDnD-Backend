/**
 * Dungeon Data
 * Defines available dungeons with types, rooms, scaling, and rewards
 */

const DUNGEONS = {
  // ==================== SOLO DUNGEONS (Level 10+) ====================
  goblin_cave: {
    id: 'goblin_cave',
    name: 'Goblin Cave',
    type: 'solo',
    difficulty: 'normal',
    minLevel: 10,
    minItemScore: 200,
    description: 'A small cave infested with goblins. Perfect for solo adventurers.',
    rooms: [
      {
        id: 'entrance',
        name: 'Cave Entrance',
        enemies: [
          { type: 'Goblin', count: 3, level: 10 }
        ],
        isBoss: false
      },
      {
        id: 'main_chamber',
        name: 'Main Chamber',
        enemies: [
          { type: 'Goblin', count: 5, level: 12 }
        ],
        isBoss: false
      },
      {
        id: 'goblin_chief',
        name: 'Goblin Chief\'s Lair',
        enemies: [
          { type: 'Goblin Chief', count: 1, level: 15, isBoss: true }
        ],
        isBoss: true
      }
    ],
    rewards: {
      gold: 200,
      tokens: 5,
      experience: 500,
      guaranteedLoot: ['weapon']
    },
    estimatedDuration: 120000 // 2 minutes
  },

  // ==================== GROUP DUNGEONS (Level 15+, 3-5 players) ====================
  ancient_catacombs: {
    id: 'ancient_catacombs',
    name: 'Ancient Catacombs',
    type: 'group',
    difficulty: 'normal',
    minLevel: 15,
    minItemScore: 400,
    minPlayers: 3,
    maxPlayers: 5,
    description: 'Explore the depths of an ancient burial ground filled with undead.',
    rooms: [
      {
        id: 'entrance_hall',
        name: 'Entrance Hall',
        enemies: [
          { type: 'Skeleton', count: 4, level: 15 }
        ],
        isBoss: false
      },
      {
        id: 'corridor',
        name: 'Dark Corridor',
        enemies: [
          { type: 'Skeleton', count: 3, level: 16 },
          { type: 'Skeleton Mage', count: 2, level: 16 }
        ],
        isBoss: false
      },
      {
        id: 'tomb_chamber',
        name: 'Tomb Chamber',
        enemies: [
          { type: 'Skeleton Warrior', count: 1, level: 18, isBoss: true, isMiniBoss: true }
        ],
        isBoss: false,
        isMiniBoss: true
      },
      {
        id: 'final_chamber',
        name: 'Final Chamber',
        enemies: [
          { type: 'Lich', count: 1, level: 20, isBoss: true }
        ],
        isBoss: true
      }
    ],
    rewards: {
      gold: 500,
      tokens: 10,
      experience: 1500,
      guaranteedLoot: ['weapon', 'armor']
    },
    estimatedDuration: 300000 // 5 minutes
  },

  // ==================== CHALLENGE DUNGEONS (Level 20+, harder, better rewards) ====================
  demon_ruins: {
    id: 'demon_ruins',
    name: 'Demon Ruins',
    type: 'challenge',
    difficulty: 'heroic',
    minLevel: 20,
    minItemScore: 800,
    minPlayers: 4,
    maxPlayers: 6,
    description: 'Face the corrupted remains of an ancient temple. Extremely dangerous.',
    rooms: [
      {
        id: 'outer_ruins',
        name: 'Outer Ruins',
        enemies: [
          { type: 'Imp', count: 6, level: 20 }
        ],
        isBoss: false
      },
      {
        id: 'inner_chamber',
        name: 'Inner Chamber',
        enemies: [
          { type: 'Demon', count: 4, level: 22 }
        ],
        isBoss: false
      },
      {
        id: 'demon_lord_chamber',
        name: 'Demon Lord\'s Chamber',
        enemies: [
          { type: 'Demon Lord', count: 1, level: 25, isBoss: true }
        ],
        isBoss: true
      }
    ],
    rewards: {
      gold: 1000,
      tokens: 20,
      experience: 3000,
      guaranteedLoot: ['weapon', 'armor', 'accessory']
    },
    estimatedDuration: 600000 // 10 minutes
  }
};

/**
 * Get dungeon by ID
 */
function getDungeonById(dungeonId) {
  return DUNGEONS[dungeonId] || null;
}

/**
 * Get all dungeons
 */
function getAllDungeons() {
  return Object.values(DUNGEONS);
}

/**
 * Get dungeons by type
 */
function getDungeonsByType(type) {
  return Object.values(DUNGEONS).filter(d => d.type === type);
}

/**
 * Get dungeons by difficulty
 */
function getDungeonsByDifficulty(difficulty) {
  return Object.values(DUNGEONS).filter(d => d.difficulty === difficulty);
}

export {
  DUNGEONS,
  getDungeonById,
  getAllDungeons,
  getDungeonsByType,
  getDungeonsByDifficulty
};
