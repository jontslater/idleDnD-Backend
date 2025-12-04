# 🗓️ 12/04/2025 - Join/Leave Command Improvements Plan

## **Overview**
Refactor `!join` and `!leave` commands to use transactions, battlefield assessment, auto-create heroes with gear/XP boost, and ensure persistence across refresh.

---

## **Current Status**

### ✅ **What Works:**
- Existing heroes can join/leave battlefields
- Multiple heroes per user are supported
- Switching battlefields removes hero from old battlefield
- Firebase listeners update browser source in real-time
- ✅ **Wave count persistence** - Saved to localStorage per battlefield
- ✅ **Hero resurrection visual fix** - Dead heroes return to idle when healed
- ✅ **Dynamic hero/enemy positioning** - Never overflow screen (60/40 split)
- ✅ **OBS-optimized layout** - Transparent background, bottom-aligned, minimal status panel
- ✅ **Guild System (Hero-Based)** - Each hero can join different guilds
- ✅ **Scheduled Guild Raids** - Schedule raids, self-signup, auto-start, delete/cancel
- ✅ **Raid Simulation** - Choose Live (100%) or Simulate (70%) rewards
- ✅ **Smart Healer AI** - Emergency (tanks <50%), Critical (<30%), Normal (lowest HP%)
- ✅ **XP Bug Fixed** - Exponential maxXp formula (100 * 1.5^(level-1))

### ❌ **What Needs Improvement:**
1. **No battlefield assessment** - New heroes don't auto-create based on what role is needed
2. **No starter gear/XP boost** - New heroes start with nothing
3. **Not using transactions** - Race conditions possible with concurrent joins
4. **!leave logic** - Already uses `FieldValue.delete()` (actually working!)
5. **No WebSocket in browser source** - Chat commands don't trigger real-time updates
6. **No rested XP system** - Missing time-based + chat activity bonuses
7. **No active chatter tracking** - Backend doesn't track/broadcast chatter count

---

## **Implementation Plan**

### **Phase 1: Battlefield Role Assessment** 🎯

**Goal:** When a user types `!join` with NO existing heroes, automatically determine what role the battlefield needs most (tank, healer, or DPS) and create that hero type.

**Location:** `E:\IdleDnD-Backend\src\routes\chat.js` - `/api/chat/join` endpoint (around line 296)

**Steps:**

1. **Create `assessBattlefieldNeeds()` function:**
   ```javascript
   /**
    * Assess what role the battlefield needs most
    * @param {string} battlefieldId - The battlefield to assess
    * @returns {Promise<string>} - 'tank', 'healer', or 'dps'
    */
   async function assessBattlefieldNeeds(battlefieldId) {
     // Get all heroes currently on the battlefield
     const heroesSnapshot = await db.collection('heroes')
       .where('currentBattlefieldId', '==', battlefieldId)
       .get();
     
     if (heroesSnapshot.empty) {
       // No heroes on battlefield - default to tank (every party needs a tank!)
       return 'tank';
     }
     
     const heroes = heroesSnapshot.docs.map(doc => doc.data());
     
     // Count heroes by category (tank, healer, dps)
     const counts = { tank: 0, healer: 0, dps: 0 };
     
     heroes.forEach(hero => {
       const category = ROLE_CONFIG[hero.role]?.category || 'dps';
       counts[category] = (counts[category] || 0) + 1;
     });
     
     console.log(`[Assessment] Battlefield ${battlefieldId} composition:`, counts);
     
     // Priority: Healer > Tank > DPS
     // Every party needs at least 1 healer, 1 tank
     if (counts.healer === 0) return 'healer';
     if (counts.tank === 0) return 'tank';
     
     // If we have healer + tank, return the lowest count
     const lowest = Object.entries(counts).sort((a, b) => a[1] - b[1])[0][0];
     return lowest;
   }
   ```

2. **Integrate into !join:**
   - When creating a new hero (line 296-316), if no `classKey` provided:
     ```javascript
     // Determine class to join as
     let role = classKey;
     
     if (!role) {
       // No class specified - assess what battlefield needs
       const neededCategory = await assessBattlefieldNeeds(battlefieldId);
       console.log(`[Join] Battlefield needs: ${neededCategory}. Auto-selecting...`);
       
       // Pick a random class from the needed category
       const classesInCategory = Object.keys(ROLE_CONFIG).filter(
         k => ROLE_CONFIG[k].category === neededCategory
       );
       role = classesInCategory[Math.floor(Math.random() * classesInCategory.length)];
       
       console.log(`[Join] Auto-selected: ${role} (${ROLE_CONFIG[role].displayName})`);
     }
     ```

---

### **Phase 2: Starter Gear + XP Boost** 🎁

**Goal:** New heroes should start with basic gear and an XP boost to help them catch up.

**Location:** `E:\IdleDnD-Backend\src\routes\chat.js` - Hero creation (around line 318-370)

**Starter Gear Template:**
```javascript
// Generate starter gear (common/uncommon items)
function generateStarterGear(role) {
  const category = ROLE_CONFIG[role]?.category || 'dps';
  
  return {
    weapon: {
      name: `Starter ${ROLE_CONFIG[role]?.displayName} Weapon`,
      rarity: 'common',
      attack: 10,
      defense: 0,
      hp: 0,
      level: 1
    },
    armor: {
      name: `Starter ${category === 'tank' ? 'Plate' : category === 'healer' ? 'Cloth' : 'Leather'} Armor`,
      rarity: 'common',
      attack: 0,
      defense: category === 'tank' ? 20 : 10,
      hp: category === 'tank' ? 50 : 25,
      level: 1
    },
    // Shield for tanks only
    ...(category === 'tank' && {
      shield: {
        name: 'Starter Shield',
        rarity: 'common',
        attack: 0,
        defense: 15,
        hp: 30,
        level: 1
      }
    })
  };
}
```

**XP Boost Buff:**
```javascript
shopBuffs: {
  xpBoost: {
    multiplier: 2.0, // 100% bonus XP
    remainingDuration: 3600000, // 1 hour (in milliseconds)
    lastUpdateTime: Date.now(),
    startTime: Date.now()
  }
}
```

**Integration:**
- Update `heroData` object (line 320-370) to include:
  ```javascript
  equipment: generateStarterGear(role),
  shopBuffs: {
    xpBoost: {
      multiplier: 2.0,
      remainingDuration: 3600000, // 1 hour
      lastUpdateTime: Date.now(),
      startTime: Date.now()
    }
  }
  ```

---

### **Phase 3: Transaction-Based Join** 🔒

**Goal:** Use Firestore transactions to ensure atomic updates and prevent race conditions when multiple users join simultaneously.

**Location:** `E:\IdleDnD-Backend\src\routes\chat.js` - `/api/chat/join` endpoint

**Current Issue:**
- Lines 98-154: Multiple `update()` calls that could conflict
- No atomicity guarantee when clearing other heroes

**Transaction Approach:**
```javascript
// Use a transaction to atomically:
// 1. Clear all other heroes of this user from ALL battlefields
// 2. Set the selected hero's currentBattlefieldId
// 3. Update lastActiveAt

const transaction = await db.runTransaction(async (t) => {
  // 1. Get all user's heroes
  const userHeroesSnapshot = await t.get(
    db.collection('heroes').where('twitchUserId', '==', viewerId)
  );
  
  const heroes = userHeroesSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const selectedHero = heroes.find(h => h.id === hero.id);
  
  if (!selectedHero) {
    throw new Error('Hero not found');
  }
  
  // 2. Clear all OTHER heroes' battlefield assignments
  heroes
    .filter(h => h.id !== hero.id && h.currentBattlefieldId)
    .forEach(otherHero => {
      const otherHeroRef = db.collection('heroes').doc(otherHero.id);
      t.update(otherHeroRef, {
        currentBattlefieldId: admin.firestore.FieldValue.delete(),
        currentBattlefieldType: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    });
  
  // 3. Update selected hero
  const heroRef = db.collection('heroes').doc(hero.id);
  t.update(heroRef, {
    currentBattlefieldId: battlefieldId,
    currentBattlefieldType: 'streamer',
    lastActiveAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp()
  });
  
  return { selectedHero, otherHeroes: heroes.filter(h => h.id !== hero.id) };
});

// Broadcast events AFTER transaction succeeds
// ... (existing broadcast logic)
```

---

### **Phase 4: Frontend Simplification** 🎨

**Goal:** Simplify `CleanBattlefieldSource.tsx` to trust Firebase as single source of truth.

**Location:** `E:\IdleDnD-Web\src\pages\CleanBattlefieldSource.tsx`

**Changes:**

1. **Remove `localStorage` for `removedHeroIds`** (lines 63-85)
   - Firebase is the single source of truth
   - If hero has `currentBattlefieldId`, show them
   - If not, don't show them

2. **Simplify WebSocket handling** (lines 235-327)
   - Remove `pendingJoinedHeroes` temporary state
   - Remove `removedHeroIds` filtering
   - Trust Firebase real-time listener exclusively

3. **Hero Display Logic:**
   ```javascript
   // SIMPLE: Just use Firebase heroes directly
   const displayHeroes = useMemo(() => {
     return firebaseHeroes.filter(hero => 
       hero.currentBattlefieldId === battlefieldId
     );
   }, [firebaseHeroes, battlefieldId]);
   ```

---

## **Testing Checklist** ✅

### **Scenario 1: New User Joins (No Existing Heroes)**
1. User types `!join` (no class specified)
2. ✅ Backend assesses battlefield needs
3. ✅ Creates hero with needed role (tank/healer/DPS)
4. ✅ Hero has starter gear equipped
5. ✅ Hero has 1-hour XP boost active
6. ✅ Hero appears on browser source immediately (via WebSocket + Firebase)
7. ✅ Refresh browser - hero persists
8. ✅ Rested XP starts accumulating from join time

### **Scenario 2: Existing User Joins (Multiple Heroes)**
1. User types `!join` (has 3 heroes)
2. ✅ Most recently active hero joins
3. ✅ Other 2 heroes are removed from any battlefields
4. ✅ Transaction ensures no duplicates
5. ✅ Refresh browser - correct hero persists

### **Scenario 3: User Joins, Then Leaves**
1. User types `!join`
2. ✅ Hero appears on browser source
3. User types `!leave`
4. ✅ Hero disappears immediately
5. ✅ Refresh browser - hero stays gone
6. ✅ `currentBattlefieldId` is `deleted` (not null)

### **Scenario 4: User Switches Battlefields**
1. User joins Streamer A's battlefield
2. User joins Streamer B's battlefield
3. ✅ Hero removed from Streamer A immediately
4. ✅ Hero appears on Streamer B immediately
5. ✅ Streamer A refreshes - hero still gone
6. ✅ Streamer B refreshes - hero still there

### **Scenario 5: WebSocket Real-Time Updates**
1. User types `!join` in Twitch chat
2. ✅ Backend processes command
3. ✅ Backend broadcasts to WebSocket
4. ✅ Browser source receives message immediately
5. ✅ Firebase updates (triggers hero list refresh)
6. ✅ Hero appears on screen within 500ms

### **Scenario 6: Rested XP & Chat Activity**
1. User joins battlefield (`!join`)
2. ✅ Join time tracked
3. Wait 5 minutes without chatting
4. ✅ Hero gains 1% of max XP (base rested XP)
5. User chats in Twitch (any message)
6. Wait 5 minutes
7. ✅ Hero gains 1.5% of max XP (rested XP × 1.5 chat bonus)
8. Wait 1 hour without chatting
9. ✅ Hero gains only base rested XP (chat bonus expired)

### **Scenario 7: Viewer Bonuses from Active Chatters**
1. 10 users chat in last hour
2. ✅ Backend tracks 10 active chatters
3. ✅ Backend broadcasts chatter count every 30s
4. ✅ Browser source displays: "10👥 +10%"
5. ✅ Damage/healing/defense bonuses applied in combat
6. User stops chatting for 1 hour
7. ✅ Count drops to 9, bonuses recalculate

---

### **Phase 5: WebSocket Integration for Browser Source** 🔌

**Goal:** Connect `CleanBattlefieldSource.tsx` to WebSocket server to receive real-time Twitch chat events (commands, redeems, etc.)

**Location:** `E:\IdleDnD-Web\src\pages\CleanBattlefieldSource.tsx`

**Current Issue:**
- ❌ Browser source does NOT listen to WebSocket
- ❌ Chat commands (`!join`, `!leave`, etc.) don't update browser source in real-time
- ❌ Channel point redeems don't trigger visual effects

**Implementation:**

1. **Import WebSocket hook:**
   ```typescript
   import { useWebSocket } from '../hooks/useWebSocket';
   ```

2. **Extract twitchId from battlefieldId:**
   ```typescript
   // Get twitchId from battlefieldId (format: "twitch:1087777297")
   const twitchId = battlefieldId?.split(':')[1] || null;
   ```

3. **Create message handler:**
   ```typescript
   const handleWebSocketMessage = useCallback((message: any) => {
     console.log('[WebSocket] 📨 Received:', message);
     
     switch (message.type) {
       case 'hero_joined':
         console.log(`[WebSocket] ✅ ${message.hero.name} joined!`);
         // Firebase listener will auto-update, no manual action needed
         break;
       
       case 'hero_left':
         console.log(`[WebSocket] 👋 ${message.hero.name} left!`);
         // Firebase listener will auto-update
         break;
       
       case 'channel_point_redeem':
         console.log(`[WebSocket] 🎁 ${message.username} redeemed: ${message.reward}`);
         // Handle visual effects for redeems
         break;
       
       case 'chatter_count_update':
         console.log(`[WebSocket] 👥 Active chatters: ${message.count}`);
         setActiveChatterCount(message.count);
         break;
       
       default:
         console.log('[WebSocket] Unknown message type:', message.type);
     }
   }, []);
   ```

4. **Connect to WebSocket:**
   ```typescript
   // Connect to WebSocket for real-time events
   useWebSocket(twitchId, handleWebSocketMessage);
   ```

---

### **Phase 6: Rested XP System** 💤

**Goal:** Implement rested XP bonus for heroes based on:
1. **Time on battlefield** - passive XP gain over time
2. **Chat activity** - bonus XP for users who chat in last hour

**Location:** `E:\IdleDnD-Web\src\pages\CleanBattlefieldSource.tsx`

**Rested XP Formula:**
```typescript
// Time-based rested XP
const hoursOnBattlefield = (Date.now() - joinTime) / (1000 * 60 * 60);
const timeBasedXP = Math.floor(hero.maxXp * Math.min(hoursOnBattlefield * 0.01, 0.5)); // 1% per hour, max 50%

// Chat activity bonus (if user chatted in last hour)
const chatBonus = lastChatTime && (Date.now() - lastChatTime < 3600000) ? 1.5 : 1.0;

const totalRestedXP = Math.floor(timeBasedXP * chatBonus);
```

**Implementation:**

1. **Track hero join time:**
   ```typescript
   const heroBattlefieldJoinTime = useRef<Map<string, number>>(new Map());
   
   // When hero joins battlefield, track join time
   useEffect(() => {
     heroes.forEach(hero => {
       if (!heroBattlefieldJoinTime.current.has(hero.id)) {
         heroBattlefieldJoinTime.current.set(hero.id, Date.now());
       }
     });
   }, [heroes]);
   ```

2. **Track chat activity (from WebSocket):**
   ```typescript
   const lastChatTime = useRef<Map<string, number>>(new Map());
   
   // Update chat time when WebSocket receives chat message
   case 'chat_activity':
     const heroId = findHeroByTwitchId(message.userId);
     if (heroId) {
       lastChatTime.current.set(heroId, Date.now());
     }
     break;
   ```

3. **Grant rested XP periodically:**
   ```typescript
   // Grant rested XP every 5 minutes
   useEffect(() => {
     const interval = setInterval(() => {
       setHeroes(current => {
         return current.map(hero => {
           const joinTime = heroBattlefieldJoinTime.current.get(hero.id);
           if (!joinTime) return hero;
           
           const hoursOnBattlefield = (Date.now() - joinTime) / (1000 * 60 * 60);
           const baseRestedXP = Math.floor(hero.maxXp * Math.min(hoursOnBattlefield * 0.01, 0.5));
           
           // Chat activity bonus
           const lastChat = lastChatTime.current.get(hero.id);
           const chatBonus = lastChat && (Date.now() - lastChat < 3600000) ? 1.5 : 1.0;
           
           const restedXP = Math.floor(baseRestedXP * chatBonus);
           
           if (restedXP > 0) {
             // Show rested XP SCT
             const heroElement = document.querySelector(`[data-hero-id="${hero.id}"]`);
             if (heroElement) {
               const rect = heroElement.getBoundingClientRect();
               addSCT(`+${restedXP} Rested XP`, rect.left + rect.width / 2, rect.top + 30, 'xp');
             }
             
             // Reset join time to prevent double-counting
             heroBattlefieldJoinTime.current.set(hero.id, Date.now());
             
             return { ...hero, xp: (hero.xp || 0) + restedXP };
           }
           
           return hero;
         });
       });
     }, 5 * 60 * 1000); // Every 5 minutes
     
     return () => clearInterval(interval);
   }, [heroes]);
   ```

---

### **Phase 7: Backend - Track Active Chatters** 📊

**Goal:** Track users who have chatted in the last hour and broadcast count to browser sources for viewer bonuses.

**Location:** `E:\IdleDnD-Backend\src\websocket\twitch-events.js`

**Implementation:**

1. **Track active chatters:**
   ```javascript
   // Map of channelId -> Set of userIds who chatted in last hour
   const activeChattersByChannel = new Map();
   
   // When chat message received (line 67)
   client.on('message', async (channel, tags, message, self) => {
     const channelName = channel.replace('#', '').toLowerCase();
     const userId = tags['user-id'];
     
     // Track this user as active chatter
     if (!activeChattersByChannel.has(channelName)) {
       activeChattersByChannel.set(channelName, new Map());
     }
     
     const chatters = activeChattersByChannel.get(channelName);
     chatters.set(userId, Date.now());
     
     // ... existing command handling ...
   });
   ```

2. **Clean up old chatters (every minute):**
   ```javascript
   // Remove chatters who haven't chatted in 1 hour
   setInterval(() => {
     const oneHourAgo = Date.now() - (60 * 60 * 1000);
     
     activeChattersByChannel.forEach((chatters, channelName) => {
       chatters.forEach((lastChatTime, userId) => {
         if (lastChatTime < oneHourAgo) {
           chatters.delete(userId);
         }
       });
     });
   }, 60 * 1000); // Every minute
   ```

3. **Broadcast chatter count (every 30 seconds):**
   ```javascript
   setInterval(() => {
     activeChattersByChannel.forEach((chatters, channelName) => {
       const count = chatters.size;
       
       // Broadcast to browser sources for this channel
       broadcastToRoom(channelName, {
         type: 'chatter_count_update',
         count: count,
         timestamp: Date.now()
       });
     });
   }, 30 * 1000); // Every 30 seconds
   ```

---

## **Files to Modify**

### **Backend:**
1. ✏️ `E:\IdleDnD-Backend\src\routes\chat.js` (main changes)
   - Add `assessBattlefieldNeeds()` function
   - Add `generateStarterGear()` function
   - Refactor `/api/chat/join` to use transactions
   - Add starter gear + XP boost to new heroes

2. ✏️ `E:\IdleDnD-Backend\src\services\commandHandler.js` (verify !leave)
   - Confirm `FieldValue.delete()` is used (should already be there)

### **Frontend:**
1. ✏️ `E:\IdleDnD-Web\src\pages\CleanBattlefieldSource.tsx`
   - ✅ Add WebSocket integration (`useWebSocket` hook)
   - ✅ Add rested XP system (time-based + chat activity bonuses)
   - ✅ Track hero join times
   - ✅ Handle chatter count updates from WebSocket
   - Remove `localStorage` logic for `removedHeroIds`
   - Simplify `displayHeroes` to trust Firebase
   - Remove `pendingJoinedHeroes` temporary state

### **Backend WebSocket:**
1. ✏️ `E:\IdleDnD-Backend\src\websocket\twitch-events.js`
   - ✅ Track active chatters per channel (rolling 1-hour window)
   - ✅ Broadcast chatter count every 30 seconds
   - ✅ Clean up inactive chatters every minute
   - ✅ Send `chat_activity` events for rested XP tracking

---

## **Optional Enhancements** 💡

1. **Role Balance Notifications:**
   - When user types `!join [class]`, check battlefield composition
   - If too many of that role, suggest: "⚠️ We have 3 tanks already. Consider healer/DPS!"

2. **Starter Gear Scaling:**
   - If battlefield average level is 50+, give higher-tier starter gear
   - Helps new players catch up in high-level streams

3. **XP Boost Duration Based on Battlefield Level:**
   - Higher level battlefields = longer XP boost (up to 2 hours)

4. **Welcome Message:**
   - First-time heroes get: "🎉 Welcome to IdleDnD! You have 1 hour of 2x XP!"

---

## **Questions to Resolve Tomorrow** ❓

1. **Starter Gear Rarity:** Common or Uncommon?
2. **XP Boost Duration:** 1 hour or 2 hours?
3. **Auto-Role Selection Priority:** Healer > Tank > DPS, or Tank > Healer > DPS?
4. **Should `!join [class]` override assessment?** (Yes - user choice takes priority)

---

## **ChatGPT Reference** 💬

User mentioned: *"work on the join and leave commands with the help I gave you from chatgpt"*

**Key Points from ChatGPT Approach:**
- ✅ **Single active hero per user** - Use transactions to enforce
- ✅ **Auto-create hero if none exists** - Based on battlefield assessment
- ✅ **Clear other heroes' battlefields** - When joining with a different hero
- ✅ **Use `FieldValue.delete()`** - For `currentBattlefieldId` removal
- ✅ **Broadcast events** - For immediate frontend updates

---

## **Estimated Time** ⏱️
- **Phase 1 (Assessment):** 30 minutes
- **Phase 2 (Starter Gear):** 45 minutes
- **Phase 3 (Transactions):** 1 hour
- **Phase 4 (Frontend Cleanup):** 30 minutes
- **Phase 5 (WebSocket Integration):** 45 minutes
- **Phase 6 (Rested XP System):** 1 hour
- **Phase 7 (Backend Chatter Tracking):** 45 minutes
- **Testing:** 1.5 hours
- **Total:** ~6.5 hours

---

## **Success Criteria** 🎯

### **Join/Leave Commands:**
✅ New users auto-join as the role their battlefield needs most
✅ New users start with gear and 1-hour XP boost
✅ No duplicate heroes on battlefields (enforced by transactions)
✅ Join/leave persist through refresh (no localStorage hacks)

### **WebSocket Integration:**
✅ Browser source connects to WebSocket on load
✅ Real-time updates when users join/leave
✅ Chatter count updates every 30 seconds
✅ Viewer bonuses applied in combat

### **Rested XP:**
✅ Heroes gain 1% max XP per hour on battlefield
✅ Chat activity grants 1.5x rested XP multiplier
✅ Rested XP awarded every 5 minutes
✅ SCT displays rested XP gains

### **Testing:**
✅ All 7 test scenarios pass

---

**Ready to implement! 🚀**
