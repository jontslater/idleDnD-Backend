# Firebase Database Schema

## Collections

### heroes
Player hero data

```typescript
{
  id: string, // Auto-generated
  name: string,
  twitchUserId?: string, // Twitch user ID for linking (optional)
  tiktokUserId?: string, // TikTok user ID for linking (optional)
  role: string, // berserker, cleric, etc.
  level: number,
  hp: number,
  maxHp: number,
  xp: number,
  maxXp: number,
  attack: number,
  defense: number,
  gold: number,
  tokens: number,
  totalIdleTokens: number,
  lastTokenClaim: number, // timestamp
  lastCommandTime: number, // timestamp
  equipment: {
    weapon: Item | null,
    armor: Item | null,
    accessory: Item | null,
    shield: Item | null
  },
  stats: {
    totalDamage: number,
    totalHealing: number,
    damageBlocked: number
  },
  isDead: boolean,
  deathTime: number | null,
  potions: {
    health: number
  },
  activeBuffs: {
    [key: string]: {
      value: number,
      remainingDuration: number,
      name: string,
      lastUpdateTime: number,
      persistsThroughDeath?: boolean
    }
  },
  profession: {
    type: 'herbalism' | 'mining' | 'enchanting',
    level: number,
    xp: number,
    maxXp: number,
    materials: {
      herbs?: {
        common: number,
        uncommon: number,
        rare: number,
        epic: number
      },
      ore?: { ... },
      essence?: number
    },
    inventory: CraftedItem[],
    totalGathered: number,
    totalCrafted: number,
    lastGatherTime: number
  } | null,
  questProgress: {
    daily: {
      [questId: string]: {
        current: number,
        completed: boolean,
        claimedAt: Timestamp | null
      }
    },
    weekly: {
      [questId: string]: {
        current: number,
        completed: boolean,
        claimedAt: Timestamp | null
      }
    },
    monthly: {
      [questId: string]: {
        current: number,
        completed: boolean,
        claimedAt: Timestamp | null
      }
    },
    lastDailyReset: Timestamp,
    lastWeeklyReset: Timestamp,
    lastMonthlyReset: Timestamp,
    dailiesCompletedThisWeek: number,
    dailiesCompletedThisMonth: number,
    weekliesCompletedThisMonth: number,
    dailyBonusClaimed: boolean,
    weeklyBonusClaimed: boolean,
    monthlyBonusClaimed: boolean
  },
  joinedAt: number,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### guilds
Guild information

```typescript
{
  id: string,
  name: string,
  createdBy: string, // userId
  level: number,
  gold: number,
  maxMembers: number,
  memberIds: string[], // Array of user IDs
  members: {
    userId: string,
    username: string,
    rank: 'leader' | 'officer' | 'member',
    contributionPoints: number,
    joinedAt: number,
    heroLevel: number,
    heroRole: string
  }[],
  perks: {
    craftingBonus?: number,
    gatherBonus?: number,
    combatBonus?: number
  },
  craftingStations: {
    id: string,
    type: 'herbalism_lab' | 'forge' | 'enchanting_tower',
    level: number,
    bonusQuality: number
  }[],
  bank: {
    gold: number,
    materials: { ... }
  },
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### raids
Raid schedules and signups

```typescript
{
  id: string,
  type: 'daily' | 'weekly' | 'monthly',
  difficulty: 'normal' | 'heroic' | 'mythic',
  suggestedItemScore: number,
  boss: {
    name: string,
    hp: number,
    maxHp: number,
    attack: number,
    mechanics: string[]
  },
  rewards: {
    gold: number,
    tokens: number,
    guaranteedLoot: 'epic' | 'legendary',
    xpBonus: number
  },
  maxParticipants: number,
  duration: number, // minutes
  schedule: {
    startsAt: Timestamp,
    endsAt: Timestamp
  },
  signups: {
    guildId: string,
    guildName: string,
    participants: {
      userId: string,
      username: string,
      heroLevel: number,
      heroRole: string,
      itemScore: number
    }[],
    signedUpAt: Timestamp,
    signedUpBy: string
  }[],
  status: 'upcoming' | 'active' | 'completed',
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### raidInstances
Active raid instances in progress

```typescript
{
  id: string,
  raidId: string, // References the raid definition from raids.js
  difficulty: 'normal' | 'heroic' | 'mythic',
  status: 'starting' | 'in-progress' | 'completed' | 'failed',
  currentWave: number,
  maxWaves: number,
  bossHp: number,
  bossMaxHp: number,
  participants: {
    userId: string,
    username: string,
    heroName: string,
    heroLevel: number,
    heroRole: string,
    itemScore: number,
    damageDealt: number,
    healingDone: number,
    damageTaken: number,
    deaths: number,
    isAlive: boolean
  }[],
  combatLog: {
    timestamp: number,
    message: string,
    type: 'damage' | 'heal' | 'death' | 'mechanic' | 'phase'
  }[],
  lootDrops: {
    item: Item,
    assignedTo: string | null // userId or null if not assigned
  }[],
  startedAt: Timestamp,
  completedAt: Timestamp | null,
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### worldBoss
World boss events

```typescript
{
  id: string,
  name: string,
  hp: number,
  maxHp: number,
  attack: number,
  mechanics: string[],
  scheduledTime: Timestamp,
  duration: number, // minutes
  rewards: {
    gold: number,
    tokens: number,
    guaranteedLoot: 'legendary',
    xpBonus: number
  },
  participants: {
    userId: string,
    username: string,
    heroLevel: number,
    heroRole: string,
    damageDealt: number,
    healingDone: number
  }[],
  status: 'upcoming' | 'active' | 'completed',
  results?: {
    winners: Participant[],
    totalDamage: number,
    duration: number,
    completedAt: Timestamp
  },
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### quests
Global quest definitions (same for all players)

```typescript
{
  id: string, // 'daily', 'weekly', or 'monthly'
  type: 'daily' | 'weekly' | 'monthly',
  resetTime: Timestamp, // When these quests reset
  activeUntil: Timestamp, // When these quests expire
  quests: {
    id: string, // e.g., 'kill_enemies_50'
    name: string, // e.g., 'Slayer'
    description: string, // e.g., 'Kill 50 enemies'
    category: 'combat' | 'profession' | 'social' | 'meta',
    objective: {
      type: 'kill' | 'defeatBosses' | 'completeWaves' | 'craft' | 'gather' | 'use' | 'raid' | 'worldBoss' | 'completeDailies' | 'completeWeeklies' | 'reachLevel' | 'dealDamage' | 'healAmount' | 'blockDamage' | 'survivebosses',
      target: number, // How many needed
      specific: string | null // Optional filter: 'boss', 'herbs', 'raids', etc.
    },
    rewards: {
      gold: number,
      xp: number,
      tokens: number,
      materials?: {
        type: 'herbs' | 'ore' | 'essence',
        rarity: 'common' | 'uncommon' | 'rare' | 'epic',
        amount: number
      }[],
      items?: Item[]
    }
  }[],
  completionBonus: {
    gold: number,
    xp: number,
    tokens: number,
    materials?: {
      type: 'herbs' | 'ore' | 'essence',
      rarity: 'common' | 'uncommon' | 'rare' | 'epic',
      amount: number
    }[],
    items?: Item[]
  },
  createdAt: Timestamp,
  updatedAt: Timestamp
}
```

### transactions
Bits purchase history

```typescript
{
  id: string,
  transactionId: string, // From Twitch
  userId: string, // Twitch user ID
  channelId: string, // Broadcaster ID
  type: 'gear' | 'consumable',
  rarity?: string,
  slot?: string,
  item?: string,
  bits: number,
  message: string,
  createdAt: Timestamp
}
```

## Indexes

### heroes
- `twitchUserId` (for quick lookups)
- `level` (for leaderboards)
- `joinedAt` (for sorting)

### guilds
- `memberIds` (array-contains for finding user's guild)
- `level` (for leaderboards)

### raids
- `type`, `status` (composite, for filtering)
- `schedule.startsAt` (for upcoming raids)

### worldBoss
- `status`, `scheduledTime` (composite, for finding current)

### quests
- `type` (for filtering daily/weekly/monthly)
- `resetTime` (for finding active quests)

### transactions
- `transactionId` (unique, for duplicate detection)
- `userId` (for user history)
- `createdAt` (for sorting)

## Security Rules

See `SETUP_GUIDE.md` for security rule implementation.

Basic structure:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Heroes - users can only read/write their own
    match /heroes/{heroId} {
      allow read: if request.auth != null;
      allow write: if request.auth.uid == resource.data.userId;
    }
    
    // Guilds - members can read, officers+ can write
    match /guilds/{guildId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && 
        resource.data.memberIds.hasAny([request.auth.uid]);
    }
    
    // Raids - read all, write by admins only
    match /raids/{raidId} {
      allow read: if request.auth != null;
      allow write: if false; // TODO: Add admin check
    }
    
    // Quests - read all, write by backend only
    match /quests/{questId} {
      allow read: if request.auth != null;
      allow write: if false; // Only backend can write
    }
    
    // Transactions - read own only
    match /transactions/{transactionId} {
      allow read: if request.auth != null && 
        resource.data.userId == request.auth.uid;
      allow write: if false; // Only backend can write
    }
  }
}
```
