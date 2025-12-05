# Command Flow Diagrams

## !join Command Flow

```
User types "!join" in Twitch chat
         |
         v
┌────────────────────────────────────────────┐
│  twitch-events.js receives message         │
│  Extracts: username, userId, channelName   │
└────────────────┬───────────────────────────┘
                 |
                 v
┌────────────────────────────────────────────┐
│  POST /api/chat/join                       │
│  Body: { viewerUsername, viewerId,         │
│          streamerUsername, heroIndex }     │
└────────────────┬───────────────────────────┘
                 |
                 v
         Has existing hero?
        /                  \
      YES                   NO
       |                     |
       v                     v
┌─────────────────┐   ┌──────────────────┐
│ Get most recent │   │ Create new hero  │
│ hero (or by #)  │   │ with class       │
└────────┬────────┘   └────────┬─────────┘
         |                     |
         v                     v
   On different          Set battlefield
   battlefield?          to current channel
    /        \                 |
  YES        NO                v
   |          |         ┌──────────────────┐
   v          |         │ Save to Firebase │
┌──────────────────┐   │ Broadcast join   │
│ BROADCAST LEAVE  │   └──────────────────┘
│ to old battlefield│          |
│ (immediate)      │           v
└────────┬─────────┘    ┌──────────────────┐
         |              │ Return success   │
         v              │ Show in chat     │
┌──────────────────┐   └──────────────────┘
│ Update Firebase  │
│ currentBattlefieldId│
└────────┬─────────┘
         |
         v
┌──────────────────┐
│ BROADCAST JOIN   │
│ to new battlefield│
│ (immediate)      │
└────────┬─────────┘
         |
         v
   ┌──────────────────┐
   │ Browser source   │
   │ updates INSTANTLY│
   │ via WebSocket    │
   └──────────────────┘
```

## !join [number] Flow

```
User types "!join 2" in Twitch chat
         |
         v
┌────────────────────────────────────────────┐
│  Parse "2" as heroIndex                    │
└────────────────┬───────────────────────────┘
                 |
                 v
┌────────────────────────────────────────────┐
│  Get all heroes for user                   │
│  Sort by lastActiveAt (most recent first)  │
└────────────────┬───────────────────────────┘
                 |
                 v
         Valid hero index?
        /                  \
      YES                   NO
       |                     |
       v                     v
┌─────────────────┐   ┌──────────────────────┐
│ Select hero #2  │   │ Error: Invalid hero  │
│ from sorted list│   │ "Use !heroes to see" │
└────────┬────────┘   └──────────────────────┘
         |
         v
   [Follow same flow as !join above]
   - Broadcast leave from old
   - Update Firebase
   - Broadcast join to new
```

## !leave Command Flow

```
User types "!leave" in Twitch chat
         |
         v
┌────────────────────────────────────────────┐
│  commandHandler.js processes !leave        │
└────────────────┬───────────────────────────┘
                 |
                 v
         Has hero on battlefield?
        /                  \
      YES                   NO
       |                     |
       v                     v
┌─────────────────┐   ┌──────────────────────┐
│ Capture old     │   │ Error: Not on        │
│ battlefieldId   │   │ battlefield          │
└────────┬────────┘   └──────────────────────┘
         |
         v
┌────────────────────────────────────────────┐
│  STEP 1: BROADCAST FIRST (immediate)       │
│  Send hero_left_battlefield via WebSocket  │
│  → Browser source removes hero INSTANTLY   │
└────────────────┬───────────────────────────┘
                 |
                 v
┌────────────────────────────────────────────┐
│  STEP 2: UPDATE FIREBASE (after broadcast) │
│  - Remove currentBattlefieldId             │
│  - Try FieldValue.delete()                 │
│  - Fallback to null if delete fails        │
│  - Fallback to set() if update fails       │
│  - Verify update completed                 │
└────────────────┬───────────────────────────┘
                 |
                 v
         Update successful?
        /                  \
      YES                   NO
       |                     |
       v                     v
┌─────────────────┐   ┌──────────────────────┐
│ Return success  │   │ Try fallback methods │
│ "You left!"     │   │ (still return success│
└─────────────────┘   │ because broadcast    │
                      │ already removed hero) │
                      └──────────────────────┘
```

## !leave [number] Flow

```
User types "!leave 2" in Twitch chat
         |
         v
┌────────────────────────────────────────────┐
│  Parse "2" as hero index                   │
└────────────────┬───────────────────────────┘
                 |
                 v
┌────────────────────────────────────────────┐
│  Get all heroes for user                   │
│  Sort by lastActiveAt                      │
└────────────────┬───────────────────────────┘
                 |
                 v
         Valid hero index?
        /                  \
      YES                   NO
       |                     |
       v                     v
┌─────────────────┐   ┌──────────────────────┐
│ Select hero #2  │   │ Error: Invalid index │
└────────┬────────┘   └──────────────────────┘
         |
         v
   [Follow same flow as !leave above]
   - Broadcast leave
   - Update Firebase
   - Return success
```

## !heroes Command Flow

```
User types "!heroes" in Twitch chat
         |
         v
┌────────────────────────────────────────────┐
│  Get all heroes for user                   │
│  Sort by lastActiveAt (most recent first)  │
└────────────────┬───────────────────────────┘
                 |
                 v
         Has heroes?
        /           \
      YES            NO
       |              |
       v              v
┌──────────────┐  ┌───────────────────────┐
│ Format list: │  │ "You have no saved    │
│ 1. Berserker │  │  characters. Use      │
│    Lv10      │  │  !join [class] to     │
│ 2. Guardian  │  │  create one!"         │
│    Lv5       │  └───────────────────────┘
│ 3. Priest    │
│    Lv8       │
└──────┬───────┘
       |
       v
┌──────────────────────────────────────────────┐
│ Add shared resources:                        │
│ "Total Gold: 1500 | Total Tokens: 50"       │
│ "Use !join [number] to switch heroes"       │
└──────────────────────────────────────────────┘
```

## Battlefield Switching Example

```
User "Alice" on StreamerA's battlefield
         |
         v
Types "!join" in StreamerB's chat
         |
         v
┌─────────────────────────────────────────────┐
│ INSTANT UPDATE (WebSocket)                  │
│                                             │
│ StreamerA's browser source:                 │
│   → hero_left_battlefield                   │
│   → Remove Alice sprite IMMEDIATELY         │
│                                             │
│ StreamerB's browser source:                 │
│   → hero_joined_battlefield                 │
│   → Add Alice sprite IMMEDIATELY            │
└────────────────┬────────────────────────────┘
                 |
                 v (happens in background)
┌─────────────────────────────────────────────┐
│ FIREBASE UPDATE (slower)                    │
│                                             │
│ Alice's hero document:                      │
│   currentBattlefieldId:                     │
│     "twitch:streamera" → "twitch:streamerb" │
│                                             │
│ Firebase listeners detect change:           │
│   → StreamerA's source: remove Alice        │
│   → StreamerB's source: add Alice           │
│   (redundant but ensures consistency)       │
└─────────────────────────────────────────────┘

Result: Alice appears on StreamerB immediately,
        disappears from StreamerA immediately,
        Firebase syncs in background for reliability
```

## WebSocket vs Firebase: Why Both?

```
┌─────────────────────────────────────────────┐
│              USER ACTION                    │
│           (types !join or !leave)           │
└────────────────┬────────────────────────────┘
                 |
        ┌────────┴────────┐
        |                  |
        v                  v
┌───────────────┐   ┌──────────────┐
│   WebSocket   │   │   Firebase   │
│   (INSTANT)   │   │  (RELIABLE)  │
└───────┬───────┘   └──────┬───────┘
        |                  |
        v                  v
┌───────────────┐   ┌──────────────┐
│ Pros:         │   │ Pros:        │
│ - Instant     │   │ - Persistent │
│ - Real-time   │   │ - Reliable   │
│ - No lag      │   │ - Syncs      │
│               │   │   everywhere │
│ Cons:         │   │              │
│ - Temporary   │   │ Cons:        │
│ - Lost on     │   │ - Slower     │
│   refresh     │   │ - 1-2s delay │
└───────┬───────┘   └──────┬───────┘
        |                  |
        └────────┬─────────┘
                 v
         ┌───────────────┐
         │ BEST OF BOTH  │
         │               │
         │ WebSocket:    │
         │ → UI updates  │
         │   immediately │
         │               │
         │ Firebase:     │
         │ → Data syncs  │
         │   reliably    │
         │ → Survives    │
         │   refresh     │
         └───────────────┘
```

## Timeline: User Joins New Battlefield

```
T=0ms    User types "!join" in chat
         │
         ├─→ Twitch sends message to bot
         │
T=50ms   Bot receives message
         │
         ├─→ POST /api/chat/join
         │
T=100ms  Backend processes request
         │
         ├─→ Query Firebase for hero
         │
T=150ms  Hero found
         │
         ├─→ BROADCAST to old battlefield (WebSocket)
         │   ▼
         │   StreamerA's browser: Hero sprite REMOVED
         │
T=200ms  Update Firebase
         │
         ├─→ Set currentBattlefieldId to new battlefield
         │
T=250ms  BROADCAST to new battlefield (WebSocket)
         │
         ├─→ StreamerB's browser: Hero sprite ADDED
         │   ▼
         │   User sees hero on new battlefield immediately!
         │
T=300ms  Send chat message
         │
         ├─→ "Alice joined StreamerB's battlefield as Berserker Lv10"
         │
T=500ms  Firebase listeners trigger
         │
         ├─→ StreamerA's browser: Remove Alice (redundant)
         ├─→ StreamerB's browser: Add Alice (redundant)
         │   (These are redundant because WebSocket already did it,
         │    but provide reliability in case WebSocket failed)
         │
T=1000ms Everything synced and stable
         └─→ Alice fighting in StreamerB's battlefield
```

## Current Implementation Summary

```
┌─────────────────────────────────────────────┐
│              COMMANDS                       │
├─────────────────────────────────────────────┤
│ !join              ✅ Working               │
│ !join [class]      ✅ Working               │
│ !join [number]     ✅ Working               │
│ !leave             ✅ Working               │
│ !leave [number]    ✅ Working               │
│ !heroes            ✅ Working               │
│ !rejoin            ✅ Working               │
│ !switch            ⚠️  Stubbed (needs work) │
└─────────────────────────────────────────────┘

┌─────────────────────────────────────────────┐
│           BATTLEFIELD BEHAVIOR              │
├─────────────────────────────────────────────┤
│ Join → Immediate appearance    ✅           │
│ Leave → Immediate removal      ✅           │
│ Switch → Automatic transfer    ✅           │
│ Multiple heroes per user       ✅           │
│ Real-time sync                 ✅           │
│ Survives refresh               ✅           │
└─────────────────────────────────────────────┘
```




