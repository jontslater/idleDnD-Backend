# XP Calculation Issues Found

## Critical Issues

### 1. **Incorrect maxXp Formula in Backend**
- **Backend uses**: `100 * Math.pow(hero.level, 1.5)` 
- **Electron app uses**: `hero.maxXp = Math.floor(hero.maxXp * 1.5)` (multiplies previous maxXp by 1.5 each level)
- **Problem**: The backend formula grows much faster, making leveling easier than intended

**Example:**
- Level 1: Backend = 100, Electron = 100 (matches)
- Level 2: Backend = 282, Electron = 150 (backend is 88% higher!)
- Level 3: Backend = 519, Electron = 225 (backend is 130% higher!)
- Level 10: Backend = 3,162, Electron = 5,767 (Electron is actually higher at this point)
- Level 50: Backend = 35,355, Electron = 1,125,899,906,842,624 (Electron explodes!)

Actually wait, the Electron formula multiplies by 1.5 each time, so it grows exponentially:
- Level 1: 100
- Level 2: 150 (100 * 1.5)
- Level 3: 225 (150 * 1.5)
- Level 4: 337.5 (225 * 1.5)
- Level 10: ~5,767
- Level 20: ~332,525
- Level 50: ~6.3 billion

The backend formula `100 * level^1.5` grows much slower:
- Level 1: 100
- Level 2: 282
- Level 10: 3,162
- Level 20: 8,944
- Level 50: 35,355

So the backend is actually making leveling HARDER at high levels, but EASIER at low levels.

### 2. **No Multiple Level-Up Handling**
- **Backend**: Only checks for ONE level-up per quest/dungeon/raid claim
- **Electron app**: Uses `while (hero.xp >= hero.maxXp)` loop to handle multiple level-ups
- **Problem**: If a hero gets 100,000 XP from a monthly quest, they should level up multiple times, but the backend only levels them up once

### 3. **maxXp Not Updated on Level-Up**
- **Backend**: Doesn't update `maxXp` when hero levels up
- **Electron app**: Updates `maxXp = Math.floor(hero.maxXp * 1.5)` on each level-up
- **Problem**: Hero's maxXp stays at the old level's value, causing incorrect level-up detection

### 4. **Initial maxXp Mismatch**
- **Backend**: New heroes start with `maxXp: 100`
- **Electron app**: New heroes start with `maxXp: 100` (matches, but needs to be updated on level-up)

## Impact

A hero reaching level 215 in a couple hours suggests:
1. They're getting massive XP from quests/dungeons/raids
2. The backend is only leveling them up once per claim, leaving huge XP overflow
3. The maxXp calculation might be wrong, making it too easy to level up
4. Combat XP in Electron app might also be contributing (need to check)

## Solution

1. Fix maxXp calculation to match Electron app: `maxXp = Math.floor(maxXp * 1.5)` on level-up
2. Add while loop to handle multiple level-ups
3. Update maxXp when hero levels up
4. Ensure initial maxXp is 100 for new heroes
