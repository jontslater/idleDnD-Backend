# Twitch Chat Commands Implementation Plan

## Overview
Implement all commands from the Electron app (`game.js`) into the backend command handler, making them more user-friendly and simpler for viewers.

## Current Status

### ✅ Already Implemented (Basic Structure)
- `!join` - Join battlefield (with hero selection by number)
- `!leave` - Leave battlefield
- `!heroes` - List all heroes with numbers
- `!rejoin` - Rejoin with specific hero
- `!switch` - Switch class
- `!stats` - Show hero stats
- `!gear` - Show equipped gear
- `!shop` - Show shop items
- `!tokens` - Show token balance
- `!classes` - List available classes
- `!help` - Show command list
- `!recipes` - List profession recipes (just implemented)
- `!profession` - Profession commands
- `!gather` - Gather materials
- `!craft` - Craft items
- `!quest` / `!quests` - Quest commands
- `!auto` - Auto-buy toggle
- `!skills` - Show skills
- `!elixirs` - Show elixirs
- `!dispel` - Remove debuffs
- `!leaderboard` / `!rank` - Show leaderboard

### ⚠️ Partially Implemented (Stubs with TODOs)
- `!attack` - Attack command (stub only)
- `!heal` - Heal command (stub only)
- `!cast` - Cast spell command (stub only)
- `!defend` - Defend command (stub only)
- `!rest` - Rest command (stub only)
- `!claim` - Claim tokens/quests (stub only)
- `!buy` - Buy from shop (stub only)
- `!use` - Use item (stub only)

## Commands from Electron App Analysis

### Combat Commands
1. **!attack [target]** - Deal extra damage (all classes)
   - Current: Stub only
   - Needs: Actual combat integration, cooldown tracking
   - User-friendly: `!attack` or `!attack enemy` (target optional)

2. **!heal [target]** - Stronger heal (healers only, 60-100 HP)
   - Current: Stub only
   - Needs: Healing logic, class restriction, target selection
   - User-friendly: `!heal` (self) or `!heal [username]`

3. **!cast [spell]** - Cast class-specific spell
   - Current: Stub only
   - Needs: Spell system, class-specific abilities
   - User-friendly: `!cast` (auto-selects best spell) or `!cast [spellname]`

4. **!defend** - Temporary defense boost (tanks only)
   - Current: Stub only
   - Needs: Defense buff logic, class restriction
   - User-friendly: `!defend`

5. **!dispel [target]** - Remove debuffs (healers only)
   - Current: Basic structure exists
   - Needs: Debuff removal logic, target selection
   - User-friendly: `!dispel` (self) or `!dispel [username]`

### Utility Commands
6. **!rest** - Full party heal + resurrect, 1 minute pause (5 min cooldown)
   - Current: Stub only
   - Needs: Party-wide heal, cooldown tracking, battlefield pause
   - User-friendly: `!rest`

7. **!claim** - Claim idle tokens (2-3/hour)
   - Current: Stub only
   - Needs: Token calculation, time tracking
   - User-friendly: `!claim`

8. **!buy [item]** - Buy from shop
   - Current: Stub only
   - Needs: Shop system, gold deduction, item addition
   - User-friendly: `!buy potion` or `!buy healthpotion`

9. **!use [item]** - Use consumable item
   - Current: Stub only
   - Needs: Item consumption, effect application
   - User-friendly: `!use potion` or `!use healthpotion`

### Already Working Commands (May Need UX Improvements)
- `!stats` - Could show more info (buffs, debuffs, profession level)
- `!gear` - Could show more slots (helm, cloak, rings, etc.)
- `!shop` - Could show prices more clearly
- `!help` - Could be categorized and more readable

## User-Friendly Improvements

### 1. Simplify Command Syntax
- Remove unnecessary arguments where possible
- Use smart defaults (e.g., `!heal` = heal self)
- Accept multiple formats (`!buy potion` = `!buy healthpotion`)

### 2. Better Error Messages
- Instead of "Error processing command", give specific guidance
- "You need to !join first!" → "Join the battle with !join to use this command"
- "Invalid item" → "Item not found. Use !shop to see available items"

### 3. More Informative Responses
- Show cooldowns in responses
- Show what happened (damage dealt, HP restored, etc.)
- Show remaining resources (gold, tokens, etc.)

### 4. Categorized Help Command
```
!help - Shows: "Commands: Combat (!attack !heal !defend) | Info (!stats !gear !heroes) | Shop (!shop !buy) | Profession (!gather !craft !recipes) | Utility (!claim !rest !auto)"
```

### 5. Shortcuts and Aliases
- `!a` = `!attack`
- `!h` = `!heal`
- `!s` = `!stats`
- `!g` = `!gear`

## Implementation Priority

### Phase 1: Core Combat Commands (High Priority)
1. `!attack` - Basic attack functionality
2. `!heal` - Healing with class restrictions
3. `!defend` - Defense buff for tanks
4. `!dispel` - Debuff removal (enhance existing)

### Phase 2: Utility Commands (Medium Priority)
5. `!rest` - Party rest functionality
6. `!claim` - Token claiming
7. `!buy` - Shop purchases
8. `!use` - Item consumption

### Phase 3: UX Improvements (Low Priority)
9. Enhanced `!help` with categories
10. Command shortcuts/aliases
11. Better error messages
12. More informative responses

## Notes
- Commands should integrate with the existing combat system in `AnimationTestPage.tsx` and `RaidBrowserSourcePage.tsx`
- Cooldowns should be tracked in hero's `cooldowns` object
- All commands should update `lastCommandTime` and `lastActiveAt`
- Combat commands should broadcast to WebSocket for real-time updates












