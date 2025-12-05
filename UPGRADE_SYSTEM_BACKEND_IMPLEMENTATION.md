# Upgrade System Backend Implementation

## Overview
Replace the old upgrade system (levels parameter) with new customization system (selectedStats array).

## Changes Needed

### 1. Update Upgrade Endpoint (`src/routes/heroes.js`)

**Old Request:**
```json
{
  "itemId": "item_123",
  "levels": 3
}
```

**New Request:**
```json
{
  "itemId": "item_123",
  "selectedStats": [
    { "type": "attack", "value": 7 },
    { "type": "critChance", "value": 5 }
  ]
}
```

**Changes:**
- Accept `selectedStats` array (exactly 2 stats)
- Calculate cost using same formula as frontend: `baseCost * rarityMultiplier * (1.5 ^ currentLevel)`
- Store selected stats in `item.upgradeStats` array
- Increment `upgradeLevel` by 1 (not by multiple levels)
- Don't modify item base stats - upgrades are applied in stat calculation

### 2. Cost Formula (Match Frontend)
```javascript
const baseCost = 100;
const rarityMultipliers = {
  'common': 1.0,
  'uncommon': 1.5,
  'rare': 2.0,
  'epic': 3.0,
  'legendary': 5.0,
  'artifact': 10.0
};

const currentLevel = item.upgradeLevel || 0;
const rarityMultiplier = rarityMultipliers[item.rarity?.toLowerCase() || 'common'] || 1.0;
const upgradeCost = Math.ceil(baseCost * rarityMultiplier * Math.pow(1.5, currentLevel));
```

### 3. Item Structure Update
Store upgrade stats in item:
```javascript
item.upgradeStats = [
  {
    level: 1,
    selectedStats: [
      { type: "attack", value: 7 },
      { type: "critChance", value: 5 }
    ]
  },
  {
    level: 2,
    selectedStats: [
      { type: "defense", value: 8 },
      { type: "hp", value: 6 }
    ]
  }
];
item.upgradeLevel = 2; // Current upgrade level (0-10)
```

### 4. Stat Calculation (Frontend & Backend)
Upgrade bonuses are applied when calculating hero stats, not stored as modified base stats.

**Frontend:** Apply in `calculateHeroStats` function
**Backend:** Apply in hero stat calculation functions

## Implementation Steps

1. Update upgrade endpoint to accept selectedStats
2. Store upgrade stats in item.upgradeStats array
3. Use new cost formula
4. Update battlefield stat calculation to apply upgrade bonuses
5. Test end-to-end
