# TikTok OAuth Setup Guide

## Overview
TikTok users can now create heroes and track progress alongside Twitch users!

---

## Step 1: Register TikTok App

1. Go to https://developers.tiktok.com/
2. Sign in with your TikTok account
3. Navigate to "My Apps" → "Create an App"
4. Fill in app details:
   - **App name**: The Never Ending War
   - **Category**: Gaming
   - **Description**: MMO idle RPG with Twitch/TikTok integration

5. **Redirect URI** (Important!):
   - Development: `http://localhost:3000/auth/tiktok/callback`
   - Production: `https://yourdomain.com/auth/tiktok/callback`

6. After creation, you'll receive:
   - **Client Key** (similar to Twitch Client ID)
   - **Client Secret**

---

## Step 2: Configure Backend

### Backend Environment Variables

Add to `E:\IdleDnD-Backend\.env`:

```env
TIKTOK_CLIENT_ID=your_tiktok_client_key_here
TIKTOK_CLIENT_SECRET=your_tiktok_client_secret_here
TIKTOK_REDIRECT_URI=http://localhost:3000/auth/tiktok/callback
```

**Status:** ✅ Backend endpoint already implemented at `POST /api/auth/tiktok`

---

## Step 3: Configure Frontend

### Frontend Environment Variables

Add to `E:\IdleDnD-Web\.env.local`:

```env
VITE_TIKTOK_CLIENT_KEY=your_tiktok_client_key_here
VITE_TIKTOK_REDIRECT_URI=http://localhost:3000/auth/tiktok/callback
```

**Status:** ✅ TikTok login button already added to Navigation

---

## Step 4: Test TikTok Login

1. Make sure backend is running: `cd E:\IdleDnD-Backend && npm start`
2. Make sure frontend is running: `cd E:\IdleDnD-Web && npm run dev`
3. Navigate to `http://localhost:3000`
4. Click **"TikTok"** button in navigation
5. Authorize on TikTok
6. Redirect back to website
7. Create a hero (if first time)
8. Access player portal

---

## How It Works

### TikTok OAuth Flow

1. **User clicks "TikTok" button**
   - Frontend generates random state for CSRF protection
   - Redirects to TikTok authorization page

2. **User authorizes on TikTok**
   - TikTok redirects back with `code` and `state`

3. **Frontend receives callback**
   - Verifies state matches (CSRF protection)
   - Sends code to backend

4. **Backend exchanges code for token**
   - Calls TikTok API to get access token
   - Fetches user info (open_id, display_name)
   - Finds existing hero by `tiktokUserId`

5. **Backend generates JWT**
   - JWT contains `tiktokUserId`, `username`, and `hero.id`
   - Returns to frontend

6. **Frontend stores token**
   - User is logged in
   - Can access player portal

---

## Hero Linking

### For TikTok Users

Heroes are linked by `tiktokUserId` field:

```typescript
{
  name: "KoolKid123",
  tiktokUserId: "12345678901234567890", // TikTok Open ID
  role: "berserker",
  level: 15,
  // ... rest of hero data
}
```

### Multi-Platform Support

Users with both Twitch and TikTok can have BOTH IDs on one hero (future feature):

```typescript
{
  name: "MultiPlatformGamer",
  twitchUserId: "98765432",
  tiktokUserId: "12345678901234567890",
  // ... rest of hero data
}
```

---

## Quest Tracking

TikTok users' quest progress works identically to Twitch users:

1. **Electron app** tracks gameplay (kills, damage, healing, etc.)
2. **Syncs to backend** every 60 seconds via `tiktokUserId`
3. **Firebase** stores quest progress
4. **Website** displays real-time progress via Firestore listener
5. **User claims** rewards on website

---

## Production Deployment

### Update Redirect URIs

Before deploying, update redirect URIs in:

1. **TikTok Developer Console:**
   - Add production URL: `https://yourdomain.com/auth/tiktok/callback`

2. **Backend `.env`:**
   ```env
   TIKTOK_REDIRECT_URI=https://yourdomain.com/auth/tiktok/callback
   ```

3. **Frontend `.env.production`:**
   ```env
   VITE_TIKTOK_CLIENT_KEY=your_tiktok_client_key
   VITE_TIKTOK_REDIRECT_URI=https://yourdomain.com/auth/tiktok/callback
   ```

---

## API Endpoints

### POST /api/auth/tiktok
Exchange TikTok OAuth code for JWT token

**Request:**
```json
{
  "code": "authorization_code_from_tiktok"
}
```

**Response:**
```json
{
  "user": {
    "id": "firebase_document_id",
    "tiktokUsername": "KoolKid123",
    "tiktokId": "12345678901234567890",
    "hero": { ... } // or null if no hero exists
  },
  "token": "jwt_token_here"
}
```

---

## Troubleshooting

### "Invalid authorization code"
- Code can only be used once
- Don't refresh the callback page
- Check redirect URI matches exactly

### "State mismatch"
- Clear browser sessionStorage
- Make sure sessionStorage is enabled

### "User not found"
- TikTok user needs to create a hero first
- Go to `/create-hero` page

### Quest progress not syncing
- Ensure hero has `tiktokUserId` field
- Check Electron console for sync logs
- Verify backend is running

---

## Notes

- TikTok OAuth requires app approval (may take 1-2 days)
- Free tier limits apply
- Both Twitch and TikTok users can coexist
- Quest system works identically for both platforms
