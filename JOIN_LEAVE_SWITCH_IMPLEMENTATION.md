# !join, !leave, and !switch Command Implementation

## Current Status

### ✅ !join Command - FULLY IMPLEMENTED

**File:** `src/routes/chat.js` and `src/websocket/twitch-events.js`

**Features:**
- ✅ Creates new hero if viewer has none
- ✅ Joins with most recent hero if viewer has multiple
- ✅ Select specific hero by number: `!join 1`, `!join 2`, etc.
- ✅ Automatically removes from old battlefield when joining new one
- ✅ Real-time WebSocket broadcasts for immediate UI updates
- ✅ Handles battlefield switching seamlessly

**Usage:**
```
!join              → Join with most recent hero (or create new one)
!join berserker    → Create new hero as berserker
!join 1            → Join with hero #1 (from !heroes list)
!join 2            → Join with hero #2
```

**What Happens:**
1. **Immediate broadcast to OLD battlefield** (if switching)
   - Hero removed from old battlefield instantly via WebSocket
   - Browser source updates in real-time

2. **Firebase update** 
   - `currentBattlefieldId` changed to new battlefield
   - `lastActiveAt` timestamp updated

3. **Immediate broadcast to NEW battlefield**
   - Hero added to new battlefield instantly via WebSocket
   - Browser source shows hero immediately

**Implementation Details:**
- Uses `battlefieldId` format: `twitch:username` (e.g., `twitch:streamer123`)
- Converts to numeric Twitch ID for WebSocket rooms
- Broadcasts `hero_left_battlefield` to old battlefield BEFORE Firebase update
- Broadcasts `hero_joined_battlefield` to new battlefield AFTER Firebase update
- Double-checks hero document existence before operations

---

### ✅ !leave Command - FULLY IMPLEMENTED

**File:** `src/services/commandHandler.js` (line 1120)

**Features:**
- ✅ Removes hero from battlefield
- ✅ Leave specific hero by number: `!leave 1`
- ✅ Leave all heroes: `!leave` (no number)
- ✅ Real-time WebSocket broadcast (instant removal)
- ✅ Comprehensive Firebase update verification
- ✅ Fallback strategies if Firebase update fails

**Usage:**
```
!leave     → Leave with current hero (or all heroes if multiple)
!leave 1   → Leave with hero #1 only
!leave 2   → Leave with hero #2 only
```

**What Happens:**
1. **Immediate WebSocket broadcast** (BEFORE Firebase)
   - Browser source removes hero instantly
   - User sees immediate feedback

2. **Firebase update** (AFTER WebSocket)
   - Removes `currentBattlefieldId` field
   - Uses multiple fallback strategies if primary update fails
   - Verifies update completed successfully

3. **Response to chat**
   - Confirms hero left
   - Suggests `!rejoin` to return

**Implementation Details:**
- Broadcast happens FIRST (before Firebase) for instant UI updates
- Multiple fallback strategies:
  1. `FieldValue.delete()` to remove field
  2. Set to `null` explicitly if delete fails
  3. `set()` with merge if update fails
  4. Direct document overwrite as last resort
- Handles deleted hero documents gracefully
- Works even if hero was already deleted

---

### ⚠️ !switch Command - PARTIALLY IMPLEMENTED

**File:** `src/services/commandHandler.js` (line 1581)

**Current Status:**
- ❌ Command structure exists but returns "coming soon" message
- ❌ Does not actually switch classes
- ✅ Validates class names

**Current Behavior:**
```
!switch guardian
→ "Class switching functionality coming soon!"
```

**What You Need:**
Based on your requirements, you have two options:

#### Option 1: Switch Class (Change Current Hero)
- Changes the current hero's class
- Resets stats based on new class
- Costs tokens/gold
- Keeps inventory and progress

#### Option 2: Switch Character (Use Different Hero)
- Switch to a different hero from your !heroes list
- This is **already implemented** via `!join [number]`

**Recommended Implementation:**
Since `!join [number]` already switches between heroes, I recommend:
- **Remove `!switch [class]`** entirely (confusing)
- **OR** implement it as "change class" with a token/gold cost
- **Promote `!join [number]`** as the hero switching command

---

## Your Requirements vs Current Implementation

### ✅ "!join puts hero on battlefield immediately"
**Status:** FULLY IMPLEMENTED
- Hero appears instantly via WebSocket
- Firebase syncs in background
- Combat starts immediately

### ✅ "!join on another battlefield removes from current one"
**Status:** FULLY IMPLEMENTED
- Old battlefield gets `hero_left_battlefield` broadcast
- New battlefield gets `hero_joined_battlefield` broadcast
- Seamless switching with no duplication

### ✅ "!leave removes user from battlefield"
**Status:** FULLY IMPLEMENTED
- Instant removal via WebSocket
- Hero can rejoin later with !rejoin or !join

### ⚠️ "User stays until they !join somewhere else"
**Status:** CONFIGURABLE

**Current Behavior:**
- Heroes stay on battlefield unless they explicitly `!leave` or `!join` elsewhere
- This is already what you want!

**Optional Change:**
If you want to **remove !leave entirely**:
1. Users can only switch battlefields with `!join`
2. No way to leave without joining somewhere else
3. Simplifies commands

**Pros:**
- Simpler for users
- Less confusion
- Encourages continuous gameplay

**Cons:**
- Users can't take a break without joining another battlefield
- Hero always visible somewhere

### ⚠️ "!switch [1-4] to switch heroes"
**Status:** ALREADY IMPLEMENTED AS `!join [number]`

**Current Implementation:**
```
!heroes          → Shows: "1. Berserker Lv10 | 2. Guardian Lv5 | 3. Priest Lv8"
!join 2          → Switches to Guardian (hero #2)
!join 3          → Switches to Priest (hero #3)
```

**Recommendation:**
- Keep `!join [number]` (it works perfectly)
- Remove or repurpose `!switch` to avoid confusion

---

## Recommendations

### 1. Remove or Clarify !switch Command

**Option A: Remove !switch entirely**
- Users use `!join [number]` to switch heroes
- Simpler, less confusion
- One command to rule them all

**Option B: Repurpose !switch for class changes**
```typescript
async function handleSwitchCommand(hero, args, username, userId, battlefieldId) {
  if (!args[0]) {
    // If no argument, list heroes like !join does
    const heroes = await getHeroes(userId);
    return showHeroList(heroes, username);
  }

  // Check if argument is a number (hero index)
  const heroIndex = parseInt(args[0], 10);
  if (!isNaN(heroIndex)) {
    // Switch to different hero
    return await switchToHero(heroIndex, username, userId, battlefieldId);
  }

  // Otherwise, treat as class name (class respec)
  const newClass = args[0].toLowerCase();
  return await respecClass(hero, newClass, username);
}
```

**Option C: Make !switch an alias for !join**
```typescript
case 'switch':
  // Alias for !join - just redirect to join command
  return await processCommand('join', args, viewerUsername, viewerId, battlefieldId);
```

### 2. Optional: Make !leave Optional

If you want users to stay until they join elsewhere:

**Remove from chat:**
- Hide `!leave` from command list
- Still keep the code for admin/testing
- Users naturally switch with `!join`

**Keep but discourage:**
- Add message: "Tip: Use !join to switch battlefields instead of leaving!"
- Only promote `!join` in docs

### 3. Improve User Experience

**Add hints to responses:**
```
!join → "Welcome! Use !heroes to see all your characters, or !join [number] to switch."
!heroes → "Your heroes: 1. Berserker Lv10 | 2. Guardian Lv5 | Use !join [number] to switch."
!leave → "You left the party! Use !join to return, or !join [streamer] to join another battle."
```

### 4. Centralized Hero Switching

Create a single function for all hero switching:

```typescript
/**
 * Switch hero - handles !join [number], !switch [number], and !rejoin [number]
 */
async function switchHero(userId, heroIndex, newBattlefieldId, username) {
  // 1. Get all heroes
  const heroes = await getHeroesByUserId(userId);
  
  // 2. Validate index
  const hero = heroes[heroIndex - 1]; // Convert 1-based to 0-based
  if (!hero) {
    throw new Error(`Hero #${heroIndex} not found`);
  }
  
  // 3. Remove from old battlefield (if any)
  await removeFromOldBattlefield(hero);
  
  // 4. Add to new battlefield
  await addToNewBattlefield(hero, newBattlefieldId);
  
  // 5. Broadcast changes
  await broadcastHeroSwitch(hero, oldBattlefield, newBattlefieldId);
  
  return hero;
}
```

---

## Testing Checklist

### !join Command
- [ ] Create new hero: `!join berserker`
- [ ] Join with existing hero: `!join`
- [ ] Join with specific hero: `!join 2`
- [ ] Switch battlefields: `!join` in different channel
- [ ] Verify hero removed from old battlefield immediately
- [ ] Verify hero appears in new battlefield immediately
- [ ] Check Firebase updates correctly

### !leave Command
- [ ] Leave with one hero: `!leave`
- [ ] Leave specific hero: `!leave 2`
- [ ] Leave all heroes: `!leave` (with multiple heroes)
- [ ] Verify hero removed from browser source immediately
- [ ] Check Firebase `currentBattlefieldId` removed
- [ ] Verify `!rejoin` works after leaving

### !switch Command
- [ ] Test `!switch` without argument
- [ ] Test `!switch [class]` (should show "coming soon")
- [ ] Decide on implementation (remove, alias, or implement)

### Edge Cases
- [ ] Join while already on same battlefield (should work - refresh state)
- [ ] Join with deleted hero (should handle gracefully)
- [ ] Leave while not on battlefield (should handle gracefully)
- [ ] Switch between 3+ battlefields rapidly
- [ ] Multiple heroes from same user on same battlefield

---

## Quick Implementation Guide

### To Make !switch Work Like !join

**File:** `src/services/commandHandler.js`

```typescript
case 'switch':
  // Make !switch an alias for !join with hero number
  if (!args[0]) {
    return await handleHeroesCommand(viewerUsername, viewerId);
  }
  
  // Check if it's a number (hero index)
  const heroIndex = parseInt(args[0], 10);
  if (!isNaN(heroIndex) && heroIndex > 0) {
    // Forward to join handler with hero index
    // This reuses all the existing join logic
    const heroes = await db.collection('heroes')
      .where('twitchUserId', '==', viewerId)
      .get();
    
    if (heroes.empty) {
      return { success: false, message: `@${viewerUsername} No heroes found! Use !join [class] to create one.` };
    }
    
    const heroesList = heroes.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    heroesList.sort((a, b) => {
      const aTime = a.lastActiveAt?.toMillis?.() ?? 0;
      const bTime = b.lastActiveAt?.toMillis?.() ?? 0;
      return bTime - aTime;
    });
    
    const index = heroIndex - 1;
    if (index < 0 || index >= heroesList.length) {
      return { success: false, message: `@${viewerUsername} Invalid hero number. Use !heroes to see your characters.` };
    }
    
    const selectedHero = heroesList[index];
    
    // Call the join logic from chat.js
    // This will handle battlefield switching automatically
    return await joinWithHero(selectedHero, viewerUsername, viewerId, battlefieldId);
  }
  
  // If not a number, treat as class name (future: class respec)
  return {
    success: false,
    message: `@${viewerUsername} Use !switch [number] to switch heroes (e.g., !switch 2). Use !heroes to see your list.`
  };
```

---

## Summary

| Command | Status | Purpose |
|---------|--------|---------|
| `!join` | ✅ **Working** | Join battlefield / Create hero / Switch hero by number |
| `!join [class]` | ✅ **Working** | Create new hero with specific class |
| `!join [number]` | ✅ **Working** | Join with specific hero from !heroes list |
| `!leave` | ✅ **Working** | Leave battlefield (optional to keep) |
| `!leave [number]` | ✅ **Working** | Leave with specific hero |
| `!switch` | ⚠️ **Stubbed** | Needs decision: remove, alias, or implement class respec |
| `!rejoin` | ✅ **Working** | Rejoin last battlefield |
| `!heroes` | ✅ **Working** | List all heroes with numbers |

**Your system already does what you want!** The only question is whether to keep/change the `!switch` command.

**My Recommendation:**
1. ✅ Keep `!join` and `!join [number]` - works perfectly
2. ✅ Keep `!leave` - gives users control
3. 🔄 Make `!switch [number]` an alias for `!join [number]` for user convenience
4. 📝 Update docs to promote `!join [number]` as the primary hero switching method

