# Prestige System & Guild Improvements - Implementation Plan

## Overview
This document outlines the complete implementation plan for:
1. **Prestige System** - Level reset system with permanent boosts, prestige gear, and star display
2. **Inventory Fix** - Fix overflow bug where users can exceed inventory limits
3. **Guild Improvements** - Invite links and enhanced guild listing/search

---

## PHASE 1: CRITICAL FIXES (Priority 1)

### 1.1 Inventory Overflow Fix ⚠️ CRITICAL

**Problem**: Users can have more items than their inventory slots allow (e.g., 61/50)

**Root Cause**: Multiple locations push items to inventory without proper validation:
- `quests.js` - Quest rewards
- `professions.js` - Crafted items, socket items, gems
- `raids.js` - Raid loot
- `worldboss.js` - Boss loot
- `mail.js` - Mail attachments
- `guilds.js` - Guild loot assignments
- `bits.js` - Bits purchases
- `auction.js` - Auction purchases

**Solution**:
1. Create centralized inventory validator utility
2. Update all inventory push locations to use validator
3. Add proper error handling and user feedback

**Files to Create**:
- `src/utils/inventoryValidator.js` - Centralized validation logic

**Files to Update**:
- `src/routes/quests.js` (line ~632)
- `src/routes/professions.js` (multiple locations)
- `src/routes/raids.js` (line ~946)
- `src/routes/worldboss.js` (line ~330)
- `src/routes/mail.js` (lines ~522, 529, 533)
- `src/routes/guilds.js` (line ~391)
- `src/routes/bits.js` (line ~138)
- `src/routes/auction.js` (line ~590)

**Implementation Steps**:
1. Create `inventoryValidator.js` with `validateInventorySpace()` function
2. Replace all direct `inventory.push()` calls with validation
3. Return proper error messages when inventory is full
4. Test with edge cases (full inventory, stacking items, etc.)

---

## PHASE 2: PRESTIGE SYSTEM FOUNDATION

### 2.1 Hero Schema Updates

**Add Prestige Fields to Hero**:
```javascript
{
  prestigeLevel: 0,           // 0 = never prestiged, 1+ = prestige count
  prestigeTokens: 0,          // Tokens earned from prestiging
  prestigeBoosts: {
    xpGain: 1.0,              // Multiplier (e.g., 1.02 = +2%)
    goldGain: 1.0,            // Multiplier
    idleTicketGain: 1.0,     // Multiplier
    statBoost: {
      attack: 0,              // Flat bonus
      defense: 0,            // Flat bonus
      hp: 0                  // Flat bonus
    }
  }
}
```

**Skill Points Note**:
- Skill points are earned at levels: 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30
- At level 100, heroes should have 13 skill points total
- When rolling back to level 100, ensure skill points are recalculated correctly
- Prestige resets skill points to 0 (free reset, no cost)

**Files to Update**:
- `E:\IdleDnD-Web\src\types\Hero.ts` - Add TypeScript interfaces
- Backend hero creation/initialization (wherever heroes are created)

### 2.2 Level 100 Rollback Script

**Purpose**: Roll back all existing heroes to level 100 so they can prestige immediately

**Script**: `scripts/rollback-heroes-to-100.js`

**Functionality**:
- Find all heroes with level > 100
- Set level to 100
- Set XP to 0
- Recalculate maxXp for level 100
- Reset stats to level 100 base (gear bonuses remain)
- **Recalculate skill points** (should be 13 at level 100: earned at 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30)
- Preserve all other data (gear, gold, tokens, etc.)

**Safety**:
- Add confirmation prompt
- Create backup before running
- Log all changes
- Dry-run mode option

### 2.3 Level Cap Enforcement

**Update Level Up Logic**:
- Modify `levelUpHelper.js` to enforce max level 100
- Prevent leveling beyond 100
- Show "Max Level Reached" message
- Display "Prestige Available" indicator at level 100

**Skill Points at Level 100**:
- Skill points are earned at levels: 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30
- At level 100, heroes should have **13 skill points** total
- Update `calculateSkillPoints()` to handle level 100 correctly
- Ensure rollback script recalculates skill points for level 100 heroes

**Files to Update**:
- `src/utils/levelUpHelper.js` - Add level cap check

---

## PHASE 3: PRESTIGE CORE FUNCTIONALITY

### 3.1 Prestige Endpoint

**Route**: `POST /api/heroes/:userId/prestige`

**Functionality**:
1. Validate hero is level 100
2. Reset level to 1
3. Reset XP to 0
4. Recalculate maxXp for level 1
5. Reset base stats to level 1 (gear bonuses remain)
6. **Reset skill points to 0** (free skill point reset on prestige)
7. **Reset skills object** (clear all skill investments)
8. Increment prestigeLevel
9. Award 1 prestige token
10. Calculate and apply permanent boosts
11. Check for prestige achievements
12. Return updated hero data

**Boost Calculation**:
```javascript
function calculatePrestigeBoosts(prestigeLevel) {
  // Diminishing returns after prestige 10
  let xpMultiplier = 1.0;
  let goldMultiplier = 1.0;
  let ticketMultiplier = 1.0;
  
  for (let i = 1; i <= prestigeLevel; i++) {
    const multiplier = i > 10 ? 0.5 : 1.0; // 50% after prestige 10
    
    xpMultiplier += 0.02 * multiplier;      // +2% per prestige
    goldMultiplier += 0.025 * multiplier;   // +2.5% per prestige
    ticketMultiplier += 0.01 * multiplier;   // +1% per prestige
  }
  
  // Hard caps
  xpMultiplier = Math.min(xpMultiplier, 1.5);      // Max +50%
  goldMultiplier = Math.min(goldMultiplier, 1.5);   // Max +50%
  ticketMultiplier = Math.min(ticketMultiplier, 1.25); // Max +25%
  
  // Stat boosts (flat, additive)
  const statBoost = {
    attack: prestigeLevel * 2,   // +2 per prestige
    defense: prestigeLevel * 1,  // +1 per prestige
    hp: prestigeLevel * 5         // +5 per prestige
  };
  
  return { xpGain: xpMultiplier, goldGain: goldMultiplier, idleTicketGain: ticketMultiplier, statBoost };
}
```

**Files to Create**:
- `src/utils/prestigeHelper.js` - Boost calculation functions

**Files to Update**:
- `src/routes/heroes.js` - Add prestige endpoint

### 3.2 Apply Prestige Boosts

**Where to Apply**:
1. **XP/Gold/Ticket Boosts**: 
   - XP distribution service
   - Gold calculation
   - Idle ticket generation
   
2. **Stat Boosts**:
   - Hero stat calculation (base stats + gear + prestige)
   - Combat calculations

**Files to Update**:
- `src/services/xpDistributionService.js` - Apply XP boost
- Gold calculation locations
- Idle ticket calculation
- Hero stat calculation (wherever base stats are calculated)

---

## PHASE 4: PRESTIGE STORE & GEAR

### 4.1 Prestige Store Data Structure

**Gear Tiers**:
```javascript
const PRESTIGE_GEAR_TIERS = {
  bronze: {
    prestigeRequired: 1,
    tokenCost: 1,
    statMultiplier: 1.2,
    namePrefix: 'Bronze Prestige'
  },
  silver: {
    prestigeRequired: 5,
    tokenCost: 2,
    statMultiplier: 1.5,
    namePrefix: 'Silver Prestige'
  },
  gold: {
    prestigeRequired: 10,
    tokenCost: 3,
    statMultiplier: 2.0,
    namePrefix: 'Gold Prestige'
  },
  platinum: {
    prestigeRequired: 20,
    tokenCost: 5,
    statMultiplier: 2.5,
    namePrefix: 'Platinum Prestige'
  },
  mythic: {
    prestigeRequired: 30,
    tokenCost: 10,
    statMultiplier: 3.0,
    namePrefix: 'Mythic Prestige'
  }
};
```

**Gear Slots Available**:
- Weapon, Armor, Accessory, Shield, Helm, Cloak, Gloves, Ring1, Ring2, Boots

### 4.2 Prestige Store Endpoints

**Get Available Gear**:
```
GET /api/heroes/:userId/prestige-store
```
- Returns gear available based on hero's prestige level
- Filters by tier requirements
- Shows token costs

**Purchase Gear**:
```
POST /api/heroes/:userId/prestige-store/purchase
Body: { slot: string, tier: string }
```
- Validates prestige level requirement
- Validates token cost
- Validates inventory space
- Generates gear with tier-appropriate stats
- Deducts tokens
- Adds to inventory

**Files to Create**:
- `src/data/prestigeGear.js` - Prestige gear definitions
- `src/routes/prestigeStore.js` - Prestige store routes

**Files to Update**:
- `src/routes/heroes.js` - Or create separate prestige store router

### 4.3 Prestige Gear Generation

**Gear Stats Calculation**:
- Base stats calculated like regular gear (based on hero level)
- Apply tier multiplier
- Add prestige-exclusive visual identifier
- May include special proc effects

**Files to Create/Update**:
- `src/utils/prestigeGearGenerator.js` - Gear generation logic

---

## PHASE 5: PRESTIGE STAR DISPLAY

### 5.1 Star Calculation System

**Star Logic**:
- 5 stars per prestige level
- Total stars = prestigeLevel * 5
- Tier based on total stars:
  - Bronze: 1-20 stars (Prestige 1-4)
  - Silver: 21-45 stars (Prestige 5-9)
  - Gold: 46-95 stars (Prestige 10-19)
  - Platinum: 96-145 stars (Prestige 20-29)
  - Mythic: 146+ stars (Prestige 30+)

**Star Display Format**:
- Show tier icon/color
- Show star count within tier
- Display below hero sprite

**Files to Create**:
- `src/utils/prestigeStars.js` - Star calculation utility
- `E:\IdleDnD-Web\src\components\PrestigeStars.tsx` - Star display component

**Files to Update**:
- `E:\IdleDnD-Web\src\components\HeroSpriteJS.tsx` - Add star display
- `E:\IdleDnD-Web\src\pages\CleanBattlefieldSource.tsx` - Pass prestige data to hero sprites

### 5.2 Star Visual Design

**Tier Colors**:
- Bronze: `#CD7F32` (copper/bronze)
- Silver: `#C0C0C0` (silver)
- Gold: `#FFD700` (gold)
- Platinum: `#E5E4E2` (platinum)
- Mythic: `#FF1493` (deep pink) or `#9D00FF` (purple)

**Display Options**:
- Individual star icons (5 per row, multiple rows)
- Compact format: `[Tier Icon] x[Count]`
- Animated appearance on prestige

---

## PHASE 6: PRESTIGE ACHIEVEMENTS & TITLES

### 6.1 Prestige Achievements

**Achievement Definitions**:
```javascript
// Add to src/data/achievements.js
{ 
  id: 'prestige_1', 
  name: 'First Prestige', 
  description: 'Prestige for the first time', 
  category: 'prestige', 
  rarity: 'common', 
  requirements: { type: 'prestigeLevel', target: 1 }, 
  rewards: { title: 'Prestiged', tokens: 100 } 
},
{ 
  id: 'prestige_5', 
  name: 'Silver Prestige', 
  description: 'Reach Prestige 5', 
  category: 'prestige', 
  rarity: 'rare', 
  requirements: { type: 'prestigeLevel', target: 5 }, 
  rewards: { title: 'Silver Prestige', tokens: 500 } 
},
{ 
  id: 'prestige_10', 
  name: 'Gold Prestige', 
  description: 'Reach Prestige 10', 
  category: 'prestige', 
  rarity: 'epic', 
  requirements: { type: 'prestigeLevel', target: 10 }, 
  rewards: { title: 'Gold Prestige', tokens: 1000 } 
},
{ 
  id: 'prestige_20', 
  name: 'Platinum Prestige', 
  description: 'Reach Prestige 20', 
  category: 'prestige', 
  rarity: 'legendary', 
  requirements: { type: 'prestigeLevel', target: 20 }, 
  rewards: { title: 'Platinum Prestige', tokens: 2000 } 
},
{ 
  id: 'prestige_30', 
  name: 'Mythic Prestige', 
  description: 'Reach Prestige 30', 
  category: 'prestige', 
  rarity: 'legendary', 
  requirements: { type: 'prestigeLevel', target: 30 }, 
  rewards: { title: 'Mythic Prestige', tokens: 5000 } 
}
```

**Files to Update**:
- `src/data/achievements.js` - Add prestige achievements
- `src/services/achievementService.js` - Add prestige level tracking

### 6.2 Achievement Tracking

**When to Check**:
- After prestige action completes
- On hero load (check current prestige level)

**Files to Update**:
- `src/routes/heroes.js` - Prestige endpoint (check achievements after prestige)
- `src/services/achievementService.js` - Add `checkPrestigeAchievements()` function

---

## PHASE 7: GUILD IMPROVEMENTS

### 7.1 Guild Invite Links

**Invite Link Format**:
```
https://yourdomain.com/guilds/join/[guildId]
or
https://yourdomain.com/guilds/join?invite=[guildId]
```

**Backend Endpoint**:
```
GET /api/guilds/:guildId/invite-link
```
- Returns shareable invite link
- Only accessible by guild leader/officers

**Join via Invite**:
```
POST /api/guilds/:guildId/join-via-invite
Body: { userId: string, inviteCode?: string }
```
- Validates invite (optional invite code for extra security)
- Bypasses join mode restrictions (if invite is valid)
- Still checks guild capacity

**Optional: Invite Codes**:
- Generate unique invite codes per guild
- Codes can expire (optional)
- Codes can have usage limits (optional)

**Files to Update**:
- `src/routes/guilds.js` - Add invite link endpoints
- `E:\IdleDnD-Web\src\pages\GuildPage.tsx` - Add "Copy Invite Link" button
- `E:\IdleDnD-Web\src\pages\GuildManagementPage.tsx` - Add invite link UI

**Frontend Route**:
- Create route handler for `/guilds/join/:guildId`
- Auto-join or show join confirmation

### 7.2 Enhanced Guild Listing & Search

**Current State**: 
- Basic guild listing exists in `GuildPage.tsx`
- Has search by name
- Has filter by join mode

**Improvements Needed**:
1. **Better Search**:
   - Search by name (current)
   - Search by tags/description
   - Search by member count range
   - Search by guild level range

2. **Sorting Options**:
   - Sort by name (A-Z, Z-A)
   - Sort by member count
   - Sort by guild level
   - Sort by creation date

3. **Filtering**:
   - Filter by join mode (current)
   - Filter by member count
   - Filter by guild level
   - Filter by tags

4. **Pagination**:
   - Limit results per page (e.g., 20 guilds)
   - Add pagination controls

**Backend Endpoint Updates**:
```
GET /api/guilds?search=term&joinMode=open&minMembers=5&maxMembers=50&sortBy=level&sortOrder=desc&page=1&limit=20
```

**Query Parameters**:
- `search`: Search term (name, description, tags)
- `joinMode`: Filter by join mode
- `minMembers`: Minimum member count
- `maxMembers`: Maximum member count
- `minLevel`: Minimum guild level
- `maxLevel`: Maximum guild level
- `tags`: Comma-separated tags
- `sortBy`: Field to sort by (name, members, level, createdAt)
- `sortOrder`: asc or desc
- `page`: Page number (1-based)
- `limit`: Results per page

**Files to Update**:
- `src/routes/guilds.js` - Enhance GET `/` endpoint with query parameters
- `E:\IdleDnD-Web\src\pages\GuildPage.tsx` - Add advanced search/filter UI
- `E:\IdleDnD-Web\src\api\client.ts` - Update guild API calls

---

## IMPLEMENTATION ORDER

### Week 1: Critical Fixes
1. ✅ Inventory overflow fix (Day 1-2)
2. ✅ Level 100 rollback script (Day 2)
3. ✅ Level cap enforcement (Day 2-3)

### Week 2: Prestige Foundation
4. ✅ Hero schema updates (Day 1)
5. ✅ Prestige endpoint (Day 2-3)
6. ✅ Boost calculation system (Day 3-4)
7. ✅ Apply boosts to XP/Gold/Tickets (Day 4-5)

### Week 3: Prestige Features
8. ✅ Prestige store system (Day 1-3)
9. ✅ Prestige gear generation (Day 3-4)
10. ✅ Star display system (Day 4-5)

### Week 4: Polish & Guild
11. ✅ Prestige achievements (Day 1-2)
12. ✅ Guild invite links (Day 2-3)
13. ✅ Enhanced guild listing/search (Day 3-5)

---

## TESTING CHECKLIST

### Inventory Fix
- [ ] Test with full inventory (50/50)
- [ ] Test quest rewards with full inventory
- [ ] Test profession crafting with full inventory
- [ ] Test raid loot with full inventory
- [ ] Test mail attachments with full inventory
- [ ] Test stacking items (potions, consumables)
- [ ] Test non-stacking items (gear)

### Prestige System
- [ ] Test prestige at level 100
- [ ] Test prestige prevents at level < 100
- [ ] Test level reset to 1
- [ ] Test XP reset to 0
- [ ] Test stats reset (gear bonuses remain)
- [ ] Test prestige token awarded
- [ ] Test boost calculations (various prestige levels)
- [ ] Test boost caps (prestige 30+)
- [ ] Test XP boost applied in combat
- [ ] Test gold boost applied
- [ ] Test ticket boost applied
- [ ] Test stat boosts in combat

### Prestige Store
- [ ] Test gear purchase with tokens
- [ ] Test prestige level requirements
- [ ] Test inventory space validation
- [ ] Test gear stats generation
- [ ] Test tier multipliers

### Star Display
- [ ] Test star calculation (all tiers)
- [ ] Test star display on battlefield
- [ ] Test star colors per tier
- [ ] Test star count accuracy

### Achievements
- [ ] Test prestige achievement unlocks
- [ ] Test title awards
- [ ] Test multiple prestige achievements

### Guild Improvements
- [ ] Test invite link generation
- [ ] Test join via invite link
- [ ] Test invite link permissions
- [ ] Test guild search functionality
- [ ] Test guild filtering
- [ ] Test guild sorting
- [ ] Test pagination

---

## BALANCE CONSIDERATIONS

### XP Scaling
- **Critical**: Fix XP scaling issues BEFORE implementing prestige
- Ensure leveling to 100 takes 2-4 hours of active play
- Prestige bonuses should make subsequent runs faster, not instant

### Boost Caps
- Hard cap XP/Gold at +50%
- Hard cap Tickets at +25%
- Stat boosts are additive (not multiplicative)

### Prestige Gear
- Should feel rewarding but not mandatory
- Consider level requirements for prestige gear
- Balance against regular gear progression

### Prestige Progression
- First prestige: 2-4 hours
- Subsequent prestiges: Slightly faster due to bonuses
- Max prestige achievable: 30-50 within reasonable time

---

## NOTES

### Missing from Chat Review
- ✅ All prestige system features covered
- ✅ Inventory fix identified
- ✅ Guild invite links added
- ✅ Guild listing/search improvements added

### Future Considerations
- Prestige cosmetics (deferred - sprite work needed first)
- Prestige leaderboards
- Prestige-exclusive content
- Prestige milestones/celebrations

---

## FILES SUMMARY

### New Files to Create
1. `src/utils/inventoryValidator.js`
2. `scripts/rollback-heroes-to-100.js`
3. `src/utils/prestigeHelper.js`
4. `src/data/prestigeGear.js`
5. `src/utils/prestigeGearGenerator.js`
6. `src/utils/prestigeStars.js`
7. `src/routes/prestigeStore.js` (or add to heroes.js)
8. `E:\IdleDnD-Web\src\components\PrestigeStars.tsx`

### Files to Update
**Backend**:
- `src/routes/heroes.js` (prestige endpoint, level cap)
- `src/routes/quests.js` (inventory validation)
- `src/routes/professions.js` (inventory validation)
- `src/routes/raids.js` (inventory validation)
- `src/routes/worldboss.js` (inventory validation)
- `src/routes/mail.js` (inventory validation)
- `src/routes/guilds.js` (inventory validation, invite links, search)
- `src/routes/bits.js` (inventory validation)
- `src/routes/auction.js` (inventory validation)
- `src/utils/levelUpHelper.js` (level cap)
- `src/services/xpDistributionService.js` (XP boost)
- `src/services/achievementService.js` (prestige achievements)
- `src/data/achievements.js` (prestige achievements)

**Frontend**:
- `E:\IdleDnD-Web\src\types\Hero.ts` (prestige fields)
- `E:\IdleDnD-Web\src\components\HeroSpriteJS.tsx` (star display)
- `E:\IdleDnD-Web\src\pages\CleanBattlefieldSource.tsx` (pass prestige data)
- `E:\IdleDnD-Web\src\pages\GuildPage.tsx` (invite links, enhanced search)
- `E:\IdleDnD-Web\src\pages\GuildManagementPage.tsx` (invite links)
- `E:\IdleDnD-Web\src\api\client.ts` (API calls)

---

**Last Updated**: [Current Date]
**Status**: Planning Phase - Ready for Implementation
