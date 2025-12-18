# XP Distribution System

## Overview

The XP Distribution System implements level-based XP splitting when enemies are killed in battlefields. This prevents power-leveling and ensures balanced progression for all players.

## Features

### 1. **XP Splitting**
- Base XP from enemies is split equally among all heroes in the battlefield
- Example: 500 XP enemy with 5 heroes = 100 XP base per hero

### 2. **Level-Based Penalties**
- **Overlevel Penalty**: Heroes 10+ levels above the enemy get reduced XP
  - 5% reduction per level above threshold
  - Minimum 10% of base XP (even heavily overleveled heroes get something)
- **Party Level Difference Penalty**: Heroes 20+ levels different from party average get reduced XP
  - 2% reduction per level difference above threshold
  - Minimum 50% of base XP

### 3. **XP Buffs Support**
- **Rested XP**: +50% XP when actively chatting
- **XP Boost Items**: +50% XP from shop/crafted items
- **Guild Perks**: XP bonus from guild level
- Buffs are applied after penalties (multiplicative)

### 4. **Minimum XP Guarantee**
- Every hero gets at least 1 XP per kill
- Every hero gets at least 10% of their base split XP (even with penalties)

## Configuration

Located in `src/services/xpDistributionService.js`:

```javascript
const XP_CONFIG = {
  OVERLEVEL_THRESHOLD: 10,              // Levels above enemy before penalty
  OVERLEVEL_PENALTY_PER_LEVEL: 0.05,   // 5% per level
  PARTY_LEVEL_DIFF_THRESHOLD: 20,      // Level difference from party avg
  PARTY_PENALTY_PER_LEVEL: 0.02,      // 2% per level
  MIN_XP_PER_KILL: 1,                  // Absolute minimum
  MIN_XP_PERCENT: 0.1,                 // 10% of base split
  RESTED_XP_MULTIPLIER: 1.5,           // +50% rested
  XP_BOOST_MULTIPLIER: 1.5,            // +50% boost
};
```

## API Endpoints

### Award Combat XP (Single or Batch)

**POST** `/api/battlefields/:battlefieldId/combat/xp`

Awards XP to all heroes in a battlefield when enemies are killed. Supports both single enemy kills and batch processing of multiple enemies.

**Single Enemy Kill:**

**Request Body (Single Enemy):**
```json
{
  "baseXP": 500,
  "enemyLevel": 50,
  "enemyName": "Kobold Warrior",
  "heroIds": ["hero1", "hero2"]  // Optional: only award to these heroes
}
```

**Request Body (Batch - Multiple Enemies):**
```json
{
  "baseXP": [500, 300, 400],
  "enemyLevel": [50, 45, 48],
  "enemyName": ["Kobold Warrior", "Imp", "Lizardman"],
  "heroIds": null  // Optional: only award to these heroes
}
```

**Note:** When using batch mode:
- All enemies' XP is combined into total base XP
- Average enemy level is calculated for level-based penalties
- All heroes are updated in a single Firestore batch operation (more efficient)
- Perfect for processing wave completions or multiple kills at once

**Response:**
```json
{
  "success": true,
  "battlefieldId": "twitch:username",
  "enemyName": "Kobold Warrior",
  "enemyLevel": 50,
  "baseXP": 500,
  "heroesCount": 5,
  "totalXPGiven": 410,
  "levelUps": 2,
  "distribution": [
    {
      "heroId": "hero1",
      "heroName": "Player1",
      "heroLevel": 100,
      "xpGained": 20,
      "newLevel": 100,
      "leveledUp": false,
      "levelsGained": 0
    },
    {
      "heroId": "hero2",
      "heroName": "Player2",
      "heroLevel": 45,
      "xpGained": 100,
      "newLevel": 46,
      "leveledUp": true,
      "levelsGained": 1
    }
  ],
  "levelUpResults": [
    {
      "heroId": "hero2",
      "heroName": "Player2",
      "oldLevel": 45,
      "newLevel": 46,
      "levelsGained": 1
    }
  ]
}
```

### Preview XP Distribution

**POST** `/api/battlefields/:battlefieldId/combat/xp/preview`

Preview XP distribution without actually awarding it (useful for UI display).

**Request Body:**
```json
{
  "baseXP": 500,
  "enemyLevel": 50
}
```

**Response:**
```json
{
  "baseXP": 500,
  "enemyLevel": 50,
  "heroesCount": 5,
  "baseXPSplit": 100,
  "distribution": [
    {
      "heroName": "Player1",
      "heroLevel": 100,
      "xpGained": 20,
      "levelMultiplier": "0.20",
      "buffMultiplier": "1.00",
      "totalMultiplier": "0.20"
    },
    {
      "heroName": "Player2",
      "heroLevel": 45,
      "xpGained": 100,
      "levelMultiplier": "1.00",
      "buffMultiplier": "1.00",
      "totalMultiplier": "1.00"
    }
  ],
  "totalXPGiven": 410
}
```

## Usage Examples

### From Electron App (Combat Handler) - Single Enemy

```javascript
// When single enemy is killed
const enemy = {
  name: "Kobold Warrior",
  level: 50,
  baseXP: 500
};

// Award XP to all heroes in battlefield
const response = await fetch(`/api/battlefields/${battlefieldId}/combat/xp`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    baseXP: enemy.baseXP,
    enemyLevel: enemy.level,
    enemyName: enemy.name
  })
});

const result = await response.json();
if (result.success) {
  console.log(`Awarded ${result.totalXPGiven} XP total`);
  console.log(`${result.levelUps} heroes leveled up!`);
}
```

### Batch Processing (Multiple Enemies/Wave Completion)

```javascript
// When multiple enemies are killed (e.g., wave completion)
const enemies = [
  { name: "Kobold Warrior", level: 50, baseXP: 500 },
  { name: "Imp", level: 45, baseXP: 300 },
  { name: "Lizardman", level: 48, baseXP: 400 }
];

// Award XP for all enemies in a single batch operation
const response = await fetch(`/api/battlefields/${battlefieldId}/combat/xp`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    baseXP: enemies.map(e => e.baseXP),        // [500, 300, 400]
    enemyLevel: enemies.map(e => e.level),     // [50, 45, 48]
    enemyName: enemies.map(e => e.name)        // ["Kobold Warrior", "Imp", "Lizardman"]
  })
});

const result = await response.json();
if (result.success) {
  console.log(`Batch: ${result.enemyCount} enemies killed`);
  console.log(`Total XP awarded: ${result.totalXPGiven}`);
  console.log(`${result.levelUps} heroes leveled up!`);
}
```

**Benefits of Batch Processing:**
- ✅ Single Firestore batch operation (more efficient)
- ✅ Reduced API calls (1 call instead of N calls)
- ✅ Better performance for wave completions
- ✅ Atomic updates (all heroes updated together)

### From Backend Service

```javascript
import { awardCombatXP } from '../services/xpDistributionService.js';

// When processing enemy death
const result = await awardCombatXP(
  battlefieldId,
  enemy.baseXP,
  enemy.level,
  {
    enemyName: enemy.name,
    specificHeroIds: null // Award to all, or specify hero IDs
  }
);

if (result.success) {
  console.log(`XP awarded: ${result.totalXPGiven} total`);
  result.levelUpResults.forEach(levelUp => {
    console.log(`${levelUp.heroName} leveled up!`);
  });
}
```

## XP Calculation Examples

### Example 1: Balanced Party
- **Enemy**: Level 50, 500 base XP
- **Party**: 5 heroes (Levels 45, 48, 50, 52, 55)
- **Result**: Each hero gets ~100 XP (no penalties, all within thresholds)

### Example 2: Overleveled Hero
- **Enemy**: Level 50, 500 base XP
- **Party**: 5 heroes (Levels 100, 50, 50, 50, 50)
- **Result**:
  - Level 100 hero: ~20 XP (50 levels above enemy = 90% penalty)
  - Level 50 heroes: ~100 XP each (no penalty)

### Example 3: Mixed Party with Buffs
- **Enemy**: Level 50, 500 base XP
- **Party**: 3 heroes (Levels 60, 50, 40)
- **Level 60 hero**: Has XP Boost buff (+50%)
- **Result**:
  - Level 60 hero: ~90 XP (10 levels above = 50% penalty, but +50% buff = 90 XP)
  - Level 50 hero: 100 XP (no penalty)
  - Level 40 hero: 100 XP (no penalty)

## Integration Points

### 1. Enemy Death Handler
When an enemy dies in combat, call the XP award endpoint:
- Electron app combat system
- Backend battlefield manager
- Firebase Cloud Function (if using serverless)

### 2. UI Display
Use the preview endpoint to show expected XP before combat:
- Display "You will gain ~X XP" in combat UI
- Show XP distribution breakdown
- Highlight level-up potential

### 3. Rested XP Detection
The system checks for `hero.hasRestedXP` or `hero.chatActive` flags:
- Set these flags when hero is actively chatting
- Clear after inactivity period
- Can be tracked via periodic chat updates service

## Monitoring & Logging

The service logs:
- Enemy kills with XP distribution
- Level-ups with hero names
- Total XP awarded per kill
- Distribution breakdowns

Example log output:
```
[XP Distribution] Enemy "Kobold Warrior" (L50) killed in battlefield twitch:username
   Base XP: 500, Heroes: 5, Total XP Given: 410
   Level-ups: 1
   🎉 Player2 leveled up: 45 → 46 (+1)
```

## Future Enhancements

### Potential Improvements:
1. **Kill Participation Tracking**: Award more XP to heroes who dealt more damage
2. **First Hit Bonus**: Small bonus XP for hero who initiated combat
3. **Kill Streak Bonus**: Bonus XP for consecutive kills
4. **Difficulty Scaling**: Adjust penalties based on battlefield difficulty
5. **Guild XP Sharing**: Bonus XP when party members are in same guild
6. **Achievement Integration**: Track XP-related achievements (total XP gained, kills, etc.)

### Configuration Tuning:
- Adjust penalty thresholds based on player feedback
- Fine-tune minimum XP guarantees
- Balance buff multipliers
- Add configurable per-battlefield XP modifiers

## Troubleshooting

### Issue: Heroes getting 0 XP
**Solution**: Check minimum XP guarantees - should be at least 1 XP per kill

### Issue: Overleveled heroes getting too much XP
**Solution**: Adjust `OVERLEVEL_PENALTY_PER_LEVEL` or `OVERLEVEL_THRESHOLD`

### Issue: XP buffs not applying
**Solution**: Ensure hero objects have `buffs` array with valid `xpMultiplier` and `expiresAt` fields

### Issue: Party penalties too harsh
**Solution**: Adjust `PARTY_LEVEL_DIFF_THRESHOLD` or `PARTY_PENALTY_PER_LEVEL`

## Testing

Test scenarios:
1. Single hero kill (should get full base XP)
2. Multiple heroes, same level (should split evenly)
3. Overleveled hero (should get reduced XP)
4. Mixed level party (should apply appropriate penalties)
5. XP buffs active (should multiply correctly)
6. Level-up scenarios (should process multiple level-ups)
