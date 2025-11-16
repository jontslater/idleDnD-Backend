# Hero Sync Solution - Complete Architecture

## Problem Statement

**Original Issue:** When a user creates a hero in the Electron app and then logs into the website, they see a different (default) hero instead of their actual game hero.

**Root Cause:** The Electron app saved heroes locally, while the backend auto-created new heroes on first website login. Two separate heroes were created for the same user.

## Solution Overview

Heroes are now synced to Firebase from the Electron app automatically. The website reads from Firebase, creating a single source of truth.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    User Journey                         │
└─────────────────────────────────────────────────────────┘

1. User creates hero in Electron app (!join berserker)
          ↓
2. Electron saves to Firebase (with twitchUserId)
          ↓
3. User logs into website with Twitch
          ↓
4. Backend finds existing hero by twitchUserId
          ↓
5. Website displays the correct hero! ✅
```

## Implementation Details

### Electron App Changes

**File:** `E:\IdleDnD\firebase-sync.js` (NEW)
- Firebase Admin SDK integration
- `saveHeroToFirebase()` - Saves individual hero
- `syncAllHeroesToFirebase()` - Bulk sync on game save
- `loadHeroFromFirebase()` - Load hero from cloud

**File:** `E:\IdleDnD\main.js` (UPDATED)
- Imports `firebase-sync` module
- `save-game` handler now syncs to Firebase after local save
- `load-game` handler initializes Firebase on startup

**Setup Required:**
1. Copy `serviceAccountKey.json` from backend to Electron directory
2. Restart Electron app
3. Heroes automatically sync on every save

### Backend Changes

**File:** `E:\IdleDnD-Backend\src\routes\auth.js` (UPDATED)
- **No longer auto-creates heroes** on first login
- Finds existing hero by `twitchUserId`
- Returns `hero: null` if no hero exists
- User sees "No Hero Found" message on website

**Why This Works:**
- Heroes must be created in the Electron app (where the game is)
- Website is a dashboard/management tool, not a hero creator
- Prevents duplicate heroes

### Frontend Changes

**File:** `E:\IdleDnD-Web\src\pages\HomePage.tsx` (UPDATED)
- Added logout button (already done)
- "No Hero Found" screen shows when `hero === null`
- Instructions tell user to create hero in Electron app

## Data Flow

### Creating a Hero:

```
1. User types in Twitch chat: !join berserker
2. Electron app creates hero with twitchUserId
3. Electron saves to local file AND Firebase
4. Hero exists in Firebase with correct twitchUserId
```

### Logging Into Website:

```
1. User clicks "Login with Twitch"
2. Website calls backend: POST /api/auth/twitch
3. Backend gets Twitch user ID from OAuth
4. Backend searches Firebase: WHERE twitchUserId == user.id
5. If found: Returns hero data
   If not found: Returns hero: null
6. Website displays hero or "No Hero Found" message
```

### Playing the Game:

```
1. User plays Electron app (combat, quests, etc.)
2. Electron auto-saves periodically
3. Each save writes to:
   - Local: %APPDATA%/the-never-ending-war/savegame.json
   - Firebase: heroes collection
4. Website automatically updates (with real-time listeners)
```

## Setup Instructions

### For New Users:

1. **Install Electron app**
2. **Connect Twitch** (in settings)
3. **Join the game** in Twitch chat: `!join [class]`
4. **Visit website** at `http://localhost:3000`
5. **Login with Twitch**
6. **See your hero!**

### For Existing Users (Migrating from Local Save):

1. **Copy service account key:**
   ```bash
   copy E:\IdleDnD-Backend\serviceAccountKey.json E:\IdleDnD\
   ```

2. **Restart Electron app** - it will initialize Firebase

3. **Load your existing save** (if you have one)

4. **Save the game** - this syncs all heroes to Firebase

5. **Visit website** and login - your hero should appear!

## Technical Details

### Hero Matching

Heroes are matched by `twitchUserId`:
- Electron app: Gets this from Twitch integration
- Backend: Gets this from OAuth token
- Firebase: Stores it as a field on hero document

**Example:**
```javascript
{
  id: "firestore-doc-id",
  name: "Slayer420",
  twitchUserId: "1087777297", // ← Matching key
  role: "berserker",
  level: 15,
  attack: 45,
  // ... more fields
}
```

### Firebase Security

**Service Account (Server-Side):**
- Electron app: Has full read/write access
- Backend: Has full read/write access
- Used for: Automated syncing, no user interaction

**Client SDK (Future Enhancement):**
- Frontend: Can read heroes via Firestore listeners
- Writes still go through backend API
- Requires Firestore security rules

### Data Consistency

**Save Priority:**
1. Local file is written first (instant, always works)
2. Firebase sync happens after (async, may fail)
3. If Firebase fails: Hero still saved locally
4. Next successful save will sync to Firebase

**Load Priority:**
1. Local file is primary source
2. Firebase is backup/sync mechanism
3. Website always reads from Firebase
4. Future: Could merge local + cloud data

## Benefits

✅ **Single Source of Truth** - One hero per user, synced everywhere

✅ **No Duplicates** - Website won't create conflicting heroes

✅ **Cloud Backup** - Heroes backed up automatically

✅ **Multi-Device** - Play on one device, view on another

✅ **Real-Time Updates** - Website can show live game data

✅ **Graceful Degradation** - If Firebase is down, game still works locally

## Troubleshooting

### "No Hero Found" on website

**Cause:** Hero hasn't been synced to Firebase yet

**Solutions:**
1. Make sure `serviceAccountKey.json` is in Electron directory
2. Restart Electron app to initialize Firebase
3. Save your game to trigger sync
4. Check Electron console for "✅ Hero synced to Firebase"

### Wrong stats showing on website

**Cause:** Old hero data in Firebase (before sync was set up)

**Solutions:**
1. Delete the old hero in Firebase Console
2. Save game in Electron to create new synced hero
3. Refresh website

### Electron console shows "Firebase sync disabled"

**Cause:** Missing `serviceAccountKey.json`

**Solution:** Copy file from backend to Electron directory

### Multiple heroes showing up

**Cause:** Created heroes in different places before sync was set up

**Solution:** 
1. Go to Firebase Console
2. Find the correct hero (check stats/level)
3. Delete the wrong hero(es)
4. Only create new heroes in Electron app from now on

## Future Enhancements

### Phase 1 (Current):
- ✅ One-way sync: Electron → Firebase → Website
- ✅ Manual save triggers sync
- ✅ Website is read-only dashboard

### Phase 2 (Future):
- ⏳ Real-time listeners for live updates
- ⏳ Two-way sync (edit on website, update in Electron)
- ⏳ Conflict resolution for multi-device play
- ⏳ Automatic sync every N seconds

### Phase 3 (Advanced):
- ⏳ Offline mode with sync queue
- ⏳ Hero versioning/rollback
- ⏳ Cloud save slots
- ⏳ Cross-platform play (mobile app?)

## Testing Checklist

- [ ] Copy `serviceAccountKey.json` to Electron app
- [ ] Restart Electron app
- [ ] See "✅ Firebase sync enabled" in console
- [ ] Create new hero in Electron: `!join berserker`
- [ ] Save game, see "☁️ Hero synced to Firebase"
- [ ] Open Firebase Console, verify hero exists
- [ ] Visit website, login with Twitch
- [ ] See correct hero with right stats
- [ ] Make changes in Electron, save
- [ ] Refresh website, see updated stats

## Documentation Files

- `E:\IdleDnD\FIREBASE_SYNC_SETUP.md` - Electron app setup guide
- `E:\IdleDnD-Backend\docs\HERO_SYNC_SOLUTION.md` - This file
- `E:\IdleDnD-Backend\docs\AUTH_INTEGRATION.md` - Auth flow details
- `E:\IdleDnD-Web\REALTIME_SYNC.md` - Website real-time updates

## Summary

**The Problem:** Separate heroes in Electron vs Website  
**The Solution:** Electron syncs to Firebase, Website reads from Firebase  
**The Result:** One hero, everywhere, always in sync! 🎮☁️🌐
