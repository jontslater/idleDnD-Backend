/**
 * Dungeon and Raid Queue Requirements
 * Defines level, gear score, and role requirements for each instance
 */

export const DUNGEON_REQUIREMENTS = {
  normal: {
    id: 'normal',
    name: 'Normal Dungeon',
    description: 'Ancient Catacombs - Explore undead-filled burial grounds',
    minLevel: 10,
    minGearScore: 300,
    recommendedGearScore: 400,
    duration: '~15 min',
    rewards: 'Common-Rare gear, Gold, XP',
    roles: {
      tank: { required: 1, description: '1 Tank' },
      healer: { required: 1, description: '1 Healer' },
      dps: { required: 3, description: '3 DPS' }
    },
    totalPlayers: 5
  },
  heroic: {
    id: 'heroic',
    name: 'Heroic Dungeon',
    description: 'Shadow Fortress - A fortress consumed by darkness',
    minLevel: 25,
    minGearScore: 1200,
    recommendedGearScore: 1500,
    duration: '~25 min',
    rewards: 'Rare-Epic gear, Gold, Tokens',
    roles: {
      tank: { required: 1, description: '1 Tank' },
      healer: { required: 1, description: '1 Healer' },
      dps: { required: 3, description: '3 DPS' }
    },
    totalPlayers: 5
  },
  mythic: {
    id: 'mythic',
    name: 'Mythic Dungeon',
    description: 'Elemental Nexus - Harness the power of primal elements',
    minLevel: 40,
    minGearScore: 2500,
    recommendedGearScore: 3000,
    duration: '~40 min',
    rewards: 'Epic-Legendary gear, Rare materials, Tokens',
    roles: {
      tank: { required: 1, description: '1 Tank' },
      healer: { required: 1, description: '1 Healer' },
      dps: { required: 3, description: '3 DPS' }
    },
    totalPlayers: 5
  }
};

export const RAID_REQUIREMENTS = {
  elder_dragon_normal: {
    id: 'elder_dragon_normal',
    name: "Elder Dragon's Lair (Normal)",
    description: 'Face the Elder Dragon in its ancient lair',
    minLevel: 20,
    minGearScore: 800,
    recommendedGearScore: 1000,
    duration: '~30 min',
    rewards: 'Rare-Epic gear, Dragon scales',
    roles: {
      tank: { required: 1, description: '1-2 Tanks', flexible: true, max: 2 },
      healer: { required: 1, description: '1-2 Healers', flexible: true, max: 2 },
      dps: { required: 2, description: '2-4 DPS', flexible: true, max: 4 }
    },
    minHealers: 1,
    minPlayers: 4,
    totalPlayers: 6
  },
  elder_dragon_heroic: {
    id: 'elder_dragon_heroic',
    name: "Elder Dragon's Lair (Heroic)",
    description: 'Face the Elder Dragon at full power',
    minLevel: 35,
    minGearScore: 2000,
    recommendedGearScore: 2500,
    duration: '~45 min',
    rewards: 'Epic-Legendary gear, Rare scales',
    roles: {
      tank: { required: 2, description: '2 Tanks' },
      healer: { required: 2, description: '2-3 Healers', flexible: true, max: 3 },
      dps: { required: 4, description: '4-6 DPS', flexible: true, max: 6 }
    },
    minHealers: 2,
    minPlayers: 5,
    totalPlayers: 8
  },
  elder_dragon_mythic: {
    id: 'elder_dragon_mythic',
    name: "Elder Dragon's Lair (Mythic)",
    description: 'The ultimate dragon challenge',
    minLevel: 50,
    minGearScore: 3500,
    recommendedGearScore: 4500,
    duration: '~60 min',
    rewards: 'Legendary gear, Ancient scales, Set pieces',
    roles: {
      tank: { required: 2, description: '2 Tanks' },
      healer: { required: 3, description: '3 Healers' },
      dps: { required: 5, description: '5 DPS' }
    },
    minHealers: 2,
    minPlayers: 6,
    totalPlayers: 10
  },
  corrupted_temple: {
    id: 'corrupted_temple',
    name: 'Corrupted Temple',
    description: 'Cleanse corruption and face the Corrupted High Priest',
    minLevel: 15,
    minGearScore: 500,
    recommendedGearScore: 600,
    duration: '~20 min',
    rewards: 'Rare gear, Gold, Tokens',
    roles: {
      tank: { required: 1, description: '1 Tank' },
      healer: { required: 1, description: '1 Healer' },
      dps: { required: 1, description: '1-3 DPS', flexible: true, max: 3 }
    },
    minHealers: 1,
    minPlayers: 3,
    totalPlayers: 5
  },
  bandit_stronghold: {
    id: 'bandit_stronghold',
    name: 'Bandit Stronghold',
    description: 'Infiltrate the fortress and eliminate the Bandit King',
    minLevel: 15,
    minGearScore: 500,
    recommendedGearScore: 600,
    duration: '~20 min',
    rewards: 'Rare gear, Gold, Tokens',
    roles: {
      tank: { required: 1, description: '1 Tank' },
      healer: { required: 1, description: '1 Healer' },
      dps: { required: 1, description: '1-3 DPS', flexible: true, max: 3 }
    },
    minHealers: 1,
    minPlayers: 3,
    totalPlayers: 5
  }
};

// Role categories for auto-detection
export const ROLE_CATEGORIES = {
  tank: ['guardian', 'paladin', 'warden', 'bloodknight', 'vanguard', 'brewmaster'],
  healer: ['cleric', 'atoner', 'druid', 'lightbringer', 'shaman', 'mistweaver', 'chronomancer', 'bard'],
  dps: [
    'berserker', 'crusader', 'assassin', 'reaper', 'bladedancer', 'monk', 
    'stormwarrior', 'hunter', 'mage', 'warlock', 'necromancer', 'ranger',
    'shadowpriest', 'mooncaller', 'stormcaller', 'frostmage', 'firemage', 'dragonsorcerer'
  ]
};

/**
 * Get hero's role category from class
 */
export function getHeroRole(heroClass) {
  const classLower = heroClass.toLowerCase();
  
  if (ROLE_CATEGORIES.tank.includes(classLower)) return 'tank';
  if (ROLE_CATEGORIES.healer.includes(classLower)) return 'healer';
  return 'dps';
}

/**
 * Calculate hero's gear score
 */
export function calculateGearScore(hero) {
  const rarityValues = {
    common: 10,
    uncommon: 25,
    rare: 50,
    epic: 100,
    legendary: 200
  };
  
  let totalScore = 0;
  
  if (hero.equipment) {
    Object.values(hero.equipment).forEach(item => {
      if (item && item.rarity) {
        totalScore += rarityValues[item.rarity] || 0;
      }
    });
  }
  
  return totalScore;
}

/**
 * Generate random 4-letter room code (uppercase letters only)
 */
export function generateQueueCode(type, difficulty) {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  
  // Generate 4 random uppercase letters
  for (let i = 0; i < 4; i++) {
    code += letters[Math.floor(Math.random() * letters.length)];
  }
  
  return code;
}

/**
 * Get total required players for a dungeon/raid
 */
export function getTotalRequired(roleRequirements) {
  return Object.values(roleRequirements).reduce((sum, req) => sum + req.required, 0);
}

/**
 * Check if all required roles are filled
 */
export function areRolesFilled(queue) {
  const roles = queue.requirements.roles;
  
  // Check basic requirements
  if (roles.tank.current < roles.tank.required) return false;
  if (roles.healer.current < roles.healer.required) return false;
  if (roles.dps.current < roles.dps.required) return false;
  
  // For raids, check minimum healers
  if (queue.type === 'raid' && queue.requirements.minHealers) {
    if (roles.healer.current < queue.requirements.minHealers) return false;
  }
  
  return true;
}

/**
 * Format queue status message for chat
 */
export function formatQueueStatus(queue) {
  const roles = queue.requirements.roles;
  const tankStatus = roles.tank.current >= roles.tank.required ? '✅' : '⚠️';
  const healerStatus = roles.healer.current >= roles.healer.required ? '✅' : '⚠️';
  const dpsStatus = roles.dps.current >= roles.dps.required ? '✅' : '⚠️';
  
  const total = queue.participants.length;
  const required = getTotalRequired(roles);
  
  return `(${total}/${required}) TANK: ${roles.tank.current}/${roles.tank.required} ${tankStatus} | HEALER: ${roles.healer.current}/${roles.healer.required} ${healerStatus} | DPS: ${roles.dps.current}/${roles.dps.required} ${dpsStatus}`;
}

/**
 * Get list of still-needed roles
 */
export function getNeededRoles(queue) {
  const needed = [];
  const roles = queue.requirements.roles;
  
  if (roles.tank.current < roles.tank.required) {
    needed.push(`${roles.tank.required - roles.tank.current} Tank${roles.tank.required - roles.tank.current > 1 ? 's' : ''}`);
  }
  if (roles.healer.current < roles.healer.required) {
    needed.push(`${roles.healer.required - roles.healer.current} Healer${roles.healer.required - roles.healer.current > 1 ? 's' : ''}`);
  }
  if (roles.dps.current < roles.dps.required) {
    needed.push(`${roles.dps.required - roles.dps.current} DPS`);
  }
  
  return needed;
}
