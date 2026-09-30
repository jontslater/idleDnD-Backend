# Frontend Formula Changes Required

This document lists all formula changes needed in the frontend repository (`jontslater/TNEWFE`) to match backend balance fixes.

## Overview

The backend fixes address critical balance issues where the backend is authoritative (shop prices, chat activity boosts). The frontend needs complementary changes for client-side combat calculations and display.

---

## 1. Enemy Scaling Formula

**Location:** Frontend combat calculation logic (likely in battle/combat service)

**Current Issue:** Enemy stats scale quadratically (level²), making high-level enemies impossibly strong

**Required Change:**
```javascript
// OLD (Quadratic - Too Strong):
const enemyAttack = baseAttack * Math.pow(enemyLevel, 2);
const enemyDefense = baseDefense * Math.pow(enemyLevel, 2);
const enemyHealth = baseHealth * Math.pow(enemyLevel, 2);

// NEW (Linear - Balanced):
const enemyAttack = baseAttack * enemyLevel;
const enemyDefense = baseDefense * enemyLevel;
const enemyHealth = baseHealth * enemyLevel;
```

**Rationale:** Linear scaling ensures level 50 enemies are 50x stronger than level 1, not 2500x stronger.

---

## 2. Kill XP Rewards

**Location:** XP calculation when hero defeats enemy

**Current Issue:** Fixed XP per kill regardless of enemy level makes grinding low-level enemies optimal

**Required Change:**
```javascript
// OLD (Fixed XP):
const killXP = 10; // Same for all enemies

// NEW (Level-Scaled XP):
const baseXP = 10;
const killXP = baseXP * enemyLevel;
// Level 1 enemy = 10 XP
// Level 10 enemy = 100 XP
// Level 50 enemy = 500 XP
```

**Additional Scaling (Optional but Recommended):**
```javascript
// Consider adding difficulty multipliers for elite/boss enemies
const difficultyMultiplier = enemy.isElite ? 2.0 : enemy.isBoss ? 5.0 : 1.0;
const killXP = baseXP * enemyLevel * difficultyMultiplier;
```

---

## 3. Token Shop Prices Display

**Location:** Premium shop UI (token-purchased gear)

**Backend Change Summary:** Token shop prices doubled to prevent cheap shop gear from beating dropped legendaries

**Required Change:**
```javascript
// Update token prices to match backend (src/routes/heroes.js lines 1316-1321)
const TOKEN_SHOP_PRICES = {
  common: 100,      // Was: 50
  rare: 400,        // Was: 200
  epic: 1200,       // Was: 600
  legendary: 5000,  // Was: 2500
  mythic: 20000     // Was: 10000
};
```

**Note:** If frontend displays prices from backend API, no change needed. If prices are hardcoded in frontend, they MUST match the backend.

---

## 4. Chat Activity Group Boost Display

**Location:** Overlay/portal displaying active viewer bonuses

**Backend Change Summary:** Replaced stepped tiers with smooth diminishing returns curve

**Required Change:**

**OLD Logic (Stepped Tiers):**
```javascript
// Stepped boost calculation
if (activeUsers >= 6 && activeUsers <= 15) {
  boost = 0.10; // +10%
} else if (activeUsers >= 16 && activeUsers <= 30) {
  boost = 0.25; // +25%
} else if (activeUsers >= 31) {
  boost = 0.50; // +50%
}
```

**NEW Logic (Smooth Diminishing Returns):**
```javascript
// Fetch from backend API endpoint instead
const response = await fetch(`/api/chat/activity/${streamerId}`, {
  headers: {
    'Authorization': `Bearer ${token}`,
    'X-Streamer-Key': streamerKey // For overlay/browser source
  }
});
const { groupBoostActive, groupBoostMultiplier, groupBoostPercentage } = await response.json();

// groupBoostMultiplier uses formula: 0.5 * (users / (users + 20))
// This creates smooth curve: 3 users = ~7%, 10 users = ~17%, 20 users = ~25%, 50 users = ~36%
```

**Display:**
```javascript
// Show as percentage with one decimal
const boostDisplay = `+${(groupBoostMultiplier * 100).toFixed(1)}% Group Boost`;
// Or use the pre-calculated groupBoostPercentage from API
```

**Rate Limiting Note:** Backend now only counts users active in last 5 minutes. Frontend should:
- Fetch this data from the API (don't calculate locally)
- Show real-time boost value
- Display "X active players" count from backend

---

## 5. Gold Sink Opportunities (Recommendations)

**Location:** Various UI displays

These are not formula changes but display opportunities to encourage gold spending:

1. **Equipment Repair System (If Implemented)**
   - Show repair costs clearly
   - Warn when durability is low

2. **Reforge/Enchant Costs**
   - Highlight gold cost in UI
   - Show expected stat improvements

3. **Teleportation/Fast Travel**
   - Display gold cost per use
   - Consider adding cooldowns to prevent spam

4. **Guild Features (If Implemented)**
   - Guild bank deposits (gold sink)
   - Guild hall upgrades (large gold sinks)

---

## Implementation Checklist

- [ ] Update enemy scaling formula (linear instead of quadratic)
- [ ] Update kill XP calculation (scale with enemy level)
- [ ] Update token shop price display (doubled prices)
- [ ] Switch chat boost to API-driven display (smooth curve)
- [ ] Add active user count display (5-minute activity window)
- [ ] Test all changes with backend API
- [ ] Verify shop prices match backend exactly

---

## Testing Recommendations

1. **Enemy Scaling Test:**
   - Fight level 1, 10, 25, 50 enemies
   - Verify stats scale linearly
   - Confirm level 50 is challenging but beatable with appropriate gear

2. **XP Test:**
   - Kill enemies at various levels
   - Verify XP = baseXP × enemyLevel
   - Confirm no XP exploits (e.g., farming low-level for same rewards)

3. **Shop Test:**
   - Compare shop legendary price (5000 tokens) vs drop rates
   - Verify shop items are convenience, not power advantage
   - Confirm prices match backend (/api/heroes/:userId/purchase/tokens)

4. **Chat Boost Test:**
   - Join with 3, 10, 20, 50 heroes
   - Verify smooth boost increase (no sudden jumps)
   - Confirm only recently active users count (5-min window)

---

## API Endpoints to Use

**Chat Activity (for group boost):**
```
GET /api/chat/activity/:streamerId
Headers:
  Authorization: Bearer <jwt-token>
  X-Streamer-Key: <overlay-key>

Response:
{
  "activeUsers": 15,
  "groupBoostActive": true,
  "groupBoostMultiplier": 0.1875,
  "groupBoostPercentage": 19,
  "lastActivityTimestamp": 1727724000000
}
```

**Shop Prices:**
Shop prices are server-authoritative. Frontend should NOT calculate costs locally. All purchases go through `/api/heroes/:userId/purchase/tokens` which validates prices server-side.

---

## Notes

- **Enemy Generation:** If frontend generates enemy stats for display before server validation, it MUST match backend formulas exactly
- **Client-Side Combat:** If combat is calculated client-side then validated server-side, formulas must be identical
- **Server Authority:** Backend is authoritative for purchases, quest progress, instance completion - frontend is display only
- **Token Security:** Never log or expose tokens in frontend console/network inspector
- **Rate Limiting:** Respect backend rate limits (5-min activity window for chat boost)

---

## Questions for Owner

1. **Enemy Generation:** Where is the authoritative enemy stat generation? Backend or frontend?
2. **Combat Resolution:** Is combat calculated client-side (with server validation) or fully server-side?
3. **Gold Sinks:** Which gold sink features should be prioritized? (Repair, guild upgrades, cosmetics?)
4. **XP Accumulation:** Is XP accumulation real-time (idle) or only on kills? This affects XP formula impact.

---

**Document Version:** 1.0  
**Backend PR:** #9 (`cursor/fix-critical-issues-3f3e`)  
**Date:** 2026-09-30
