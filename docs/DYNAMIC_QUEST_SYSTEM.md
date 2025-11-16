# Dynamic Quest Generation System

## 🎯 Overview

The quest system now **procedurally generates unique quests** each day/week/month with **level-based scaling** to ensure appropriate difficulty for all players.

---

## ✨ Features

### 1. **Automatic Quest Generation**
- **Daily**: Generates 10 quests at 00:00 UTC every day
- **Weekly**: Generates 7 quests every Monday at 00:00 UTC
- **Monthly**: Generates 7 quests on the 1st of each month at 00:00 UTC

### 2. **Level-Based Scaling**
Quests scale to 4 player tiers:

| Tier | Level Range | Label | Quest Difficulty |
|------|-------------|-------|------------------|
| **Newbie** | 1-10 | Novice | Easy targets for beginners |
| **Intermediate** | 11-25 | Adept | Moderate challenges |
| **Veteran** | 26-40 | Veteran | High-level content |
| **Elite** | 41+ | Elite | Endgame challenges |

### 3. **Quest Types**

#### Combat Quests ⚔️
- Kill X enemies
- Defeat X bosses
- Complete X waves
- Deal X damage
- Heal X HP
- Block X damage
- Survive X boss encounters

#### Profession Quests 🔨
- Gather X materials
- Craft X items
- Use X consumables

#### Social Quests 👥
- Participate in X raids (weekly/monthly only)
- Join X world boss events (weekly/monthly only)

### 4. **Dynamic Rewards**
Rewards scale with:
- **Quest tier** (newbie = 1x, elite = 4x multiplier)
- **Quest period** (daily < weekly < monthly)
- **Quest type** (profession quests include material rewards)

---

## 📊 Example Quest Generation

### Daily Quests (Level 15 player would see)
```
1. Slayer (Novice) - Kill 20 enemies
   Rewards: 500g, 1,000 XP, 10 tokens

2. Boss Hunter (Adept) - Defeat 5 bosses
   Rewards: 2,250g, 4,500 XP, 30 tokens

3. Gatherer (Novice) - Gather 10 materials
   Rewards: 500g, 1,000 XP, 10 tokens + 5 common herbs
```

### Weekly Quests (Level 30 player would see)
```
1. Mass Slayer (Veteran) - Kill 500 enemies
   Rewards: 7,500g, 37,500 XP, 187 tokens

2. Raid Veteran (Veteran) - Participate in 5 raids
   Rewards: 20,000g, 100,000 XP, 500 tokens + Epic Trophy
```

---

## 🔄 How It Works

### Backend Flow
1. **Server starts** → `initializeQuestSystem()` runs
2. **Checks** if quests exist and if reset time has passed
3. **Generates** new random quests with level scaling
4. **Every hour** checks for quest resets
5. **On reset** → new quests generated, all player progress cleared

### Electron Flow
1. **Player actions** (kill enemy, gather material, etc.)
2. **Tracks** using generic keys (`kill`, `gather`, `dealDamage`)
3. **Every 60 seconds** batches updates to backend
4. **Backend** finds ALL matching active quests (daily/weekly/monthly)
5. **Updates progress** for applicable quests
6. **Returns** completion status

### Frontend Flow
1. **Loads** active quests from Firebase
2. **Listens** to hero's `questProgress` in real-time
3. **Displays** quest cards grouped by category
4. **Shows** progress bars, rewards, and claim buttons
5. **Claims** rewards when completed

---

## 🛠️ Manual Quest Regeneration

To manually regenerate quests (for testing):

```bash
cd E:\IdleDnD-Backend
npm run regenerate-quests
```

This will:
- Generate new daily/weekly/monthly quests
- Reset all player quest progress
- Display the new quests in the console

---

## 🎮 Quest Tracking

### Tracking Keys
The Electron app uses these generic tracking keys:

| Tracking Key | Applies To | Description |
|--------------|------------|-------------|
| `kill` | daily, weekly, monthly | Enemy kills |
| `defeatBosses` | daily, weekly, monthly | Boss defeats |
| `completeWaves` | daily, weekly, monthly | Waves completed |
| `dealDamage` | daily, weekly, monthly | Damage dealt |
| `healAmount` | daily, weekly, monthly | HP healed |
| `blockDamage` | daily, weekly, monthly | Damage blocked |
| `surviveBosses` | daily, weekly, monthly | Boss survivals |
| `gather` | daily, weekly, monthly | Materials gathered |
| `craft` | daily, weekly, monthly | Items crafted |
| `use` | daily, weekly, monthly | Consumables used |
| `raid` | weekly, monthly | Raid participations |
| `worldBoss` | weekly, monthly | World boss joins |

### How Tracking Works
1. Player kills an enemy → `trackKill()` called
2. Adds `1` to `gameState.questUpdates['kill']`
3. Every 60 seconds, syncs to backend
4. Backend finds ALL active quests with `objective.type === 'kill'`
5. Updates progress for daily "Kill 20 enemies", weekly "Kill 250 enemies", monthly "Kill 1000 enemies"

---

## 🏆 Benefits

### For New Players (Level 1-10)
- ✅ Achievable targets (Kill 20 vs 1000)
- ✅ Lower rewards appropriate for level
- ✅ Learn game mechanics gradually

### For Veterans (Level 26-40)
- ✅ Challenging objectives (Kill 500, Deal 2.5M damage)
- ✅ Higher rewards (2.5x multiplier)
- ✅ Still rewarding to complete

### For Elite Players (Level 41+)
- ✅ Endgame challenges (Kill 1000, Deal 10M damage)
- ✅ Massive rewards (4x multiplier)
- ✅ Long-term progression

---

## 📈 Quest Variety

The system ensures variety by:
- **Random selection** from quest template pools
- **Tier mixing** (each period has multiple difficulty tiers)
- **Unique IDs** (timestamp-based, never repeats)
- **Auto-rotation** (new quests every reset)

Players will never do the same exact combination of quests twice!

---

## 🔧 Customization

To add new quest types, edit `E:\IdleDnD-Backend\src\services\dynamicQuestGenerator.js`:

```javascript
QUEST_TEMPLATES.combat.new_quest_type = {
  name: ['Name 1', 'Name 2', 'Name 3'],
  description: (count) => `Do X thing ${count} times`,
  type: 'newType',
  scaling: {
    daily: { newbie: 5, intermediate: 10, veteran: 20, elite: 40 },
    weekly: { newbie: 25, intermediate: 50, veteran: 100, elite: 200 }
  }
};
```

Then add tracking in `E:\IdleDnD\game.js`:

```javascript
function trackNewThing() {
  updateQuestProgress('newType', 1);
}
```

---

## 🎉 Summary

- ✅ **No manual quest creation** needed
- ✅ **Scales automatically** with player level
- ✅ **Never repetitive** - unique combos every reset
- ✅ **Fair for all players** - beginners to endgame
- ✅ **Fully automatic** - generates, resets, and syncs itself

**Your quest system is now self-sustaining!** 🚀
