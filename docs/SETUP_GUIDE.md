# Firebase Backend Setup Guide

Complete step-by-step guide to set up the Firebase backend.

## Prerequisites

- Node.js 18+ installed
- Firebase account (free tier is fine)
- Terminal/Command Prompt

## Step 1: Firebase Project Setup

### 1.1 Create Firebase Project

1. Go to https://console.firebase.google.com/
2. Click "Add project"
3. Enter project name: "the-never-ending-war" (or your choice)
4. Disable Google Analytics (optional, not needed for this project)
5. Click "Create project"

### 1.2 Enable Firestore Database

1. In Firebase Console, click "Firestore Database" in left menu
2. Click "Create database"
3. Choose "Start in production mode"
4. Select location (choose closest to your users)
5. Click "Enable"

### 1.3 Set Firestore Security Rules

1. In Firestore, click "Rules" tab
2. Replace with this (allows authenticated reads/writes):

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true; // For development only!
      // TODO: Add proper authentication rules for production
    }
  }
}
```

3. Click "Publish"

**⚠️ IMPORTANT:** These rules allow anyone to read/write. For production, implement proper authentication!

### 1.4 Generate Service Account Key

1. Click gear icon (⚙️) next to "Project Overview" > "Project settings"
2. Go to "Service accounts" tab
3. Click "Generate new private key"
4. Click "Generate key" in confirmation dialog
5. Save the downloaded JSON file as `serviceAccountKey.json` in `E:\IdleDnD-Backend\`

## Step 2: Local Development Setup

### 2.1 Install Dependencies

```bash
cd E:\IdleDnD-Backend
npm install
```

### 2.2 Configure Environment

1. Create a `.env` file in the backend root directory

2. Open the `serviceAccountKey.json` file you downloaded

3. Edit `.env` and fill in these values:
   ```env
   PORT=3001
   NODE_ENV=development
   
   # From serviceAccountKey.json
   FIREBASE_PROJECT_ID=your-project-id-from-json
   FIREBASE_CLIENT_EMAIL=your-client-email-from-json
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYOUR_PRIVATE_KEY_HERE\n-----END PRIVATE KEY-----\n"
   
   # Twitch OAuth (for user authentication)
   TWITCH_CLIENT_ID=your_twitch_client_id
   TWITCH_CLIENT_SECRET=your_twitch_client_secret
   TWITCH_REDIRECT_URI=http://localhost:3000/auth/callback
   
   # TikTok OAuth (optional - for TikTok user authentication)
   TIKTOK_CLIENT_ID=your_tiktok_client_key
   TIKTOK_CLIENT_SECRET=your_tiktok_client_secret
   TIKTOK_REDIRECT_URI=http://localhost:3000/auth/tiktok/callback
   
   # JWT Secret (generate a random string)
   JWT_SECRET=your-super-secret-jwt-key-change-this
   
   # CORS
   ALLOWED_ORIGINS=http://localhost:3000,http://localhost:3001
   ```

**Important:** 
- The `FIREBASE_PRIVATE_KEY` must keep the `\n` characters and be wrapped in quotes
- Get Twitch OAuth credentials from https://dev.twitch.tv/console/apps
- Generate a secure JWT_SECRET for production

See `docs/ENVIRONMENT_VARIABLES.md` for detailed information on all variables.

### 2.3 Start Development Server

```bash
npm run dev
```

You should see:
```
✅ Firebase initialized successfully
╔════════════════════════════════════════════╗
║   The Never Ending War - Backend API      ║
╚════════════════════════════════════════════╝

🚀 Server running on: http://localhost:3001
```

### 2.4 Test the API

In another terminal:

```bash
# Test health endpoint
curl http://localhost:3001/api/health

# Should return:
# {"status":"ok","timestamp":"...","firebase":"connected"}
```

## Step 3: Connect Electron App

### 3.1 Update Electron Webhook Server

The Electron app's `webhook-server.js` can now forward requests to this backend instead of handling them locally.

In `E:\IdleDnD\webhook-server.js`, add this method:

```javascript
async forwardToBackend(endpoint, data) {
  const backendUrl = process.env.BACKEND_URL || 'http://localhost:3001';
  
  try {
    const response = await fetch(`${backendUrl}${endpoint}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    return await response.json();
  } catch (error) {
    console.error('Backend request failed:', error);
    throw error;
  }
}
```

### 3.2 Add to Electron .env

Add to `E:\IdleDnD\.env`:
```env
BACKEND_URL=http://localhost:3001
```

## Step 4: Connect Website

### 4.1 Update Website Environment

In `E:\IdleDnD-Web\.env`:

```env
VITE_API_URL=http://localhost:3001
VITE_USE_MOCK=false
```

### 4.2 Restart Website

```bash
cd E:\IdleDnD-Web
npm run dev
```

The website will now fetch real data from Firebase instead of mock data!

## Step 5: Initial Data Setup

### 5.1 Sync Existing Heroes

If you have heroes in the Electron app save file, you need to sync them to Firebase.

**Option A: Use the sync script (recommended)**

```bash
# Sync heroes from Electron save file
npm run sync-heroes E:\IdleDnD\save-data.json

# Or create a test hero for development
npm run test-hero

# You can also run the script directly for more options:
node scripts/sync-heroes.js E:\IdleDnD\save-data.json --overwrite
```

The script will:
- Read your save file
- Transform the data to match Firebase schema
- Upload heroes to Firestore
- Skip duplicates (or use `--overwrite` to update)

**Option B: Manually add a test hero**

You can also manually add a test hero in Firebase Console:
1. Go to Firestore Database
2. Click "Start collection" → enter "heroes"
3. Add document with auto-ID
4. Add fields matching your hero structure (see DATABASE_SCHEMA.md)

## Step 6: Test Everything

### 6.1 Test Hero API

```bash
# Get all heroes
curl http://localhost:3001/api/heroes

# Get specific hero
curl http://localhost:3001/api/heroes/USER_ID

# Create test hero
curl -X POST http://localhost:3001/api/heroes \
  -H "Content-Type: application/json" \
  -d '{
    "name": "TestHero",
    "role": "berserker",
    "level": 1,
    "hp": 100,
    "maxHp": 100,
    "twitchUserId": "test_user_123"
  }'
```

### 6.2 Test Website Connection

1. Open http://localhost:3000
2. You should see real hero data from Firebase (not mock data)
3. Check browser console for any errors

### 6.3 Test Bits Purchase

```bash
curl -X POST http://localhost:3001/api/bits/purchase \
  -H "Content-Type: application/json" \
  -d '{
    "type": "consumable",
    "item": "token_bundle",
    "bits": 50,
    "transactionId": "test_123",
    "userId": "test_user_123",
    "channelId": "test_channel"
  }'
```

## Step 7: Production Deployment

### Option A: Firebase Hosting + Functions

1. Install Firebase CLI:
   ```bash
   npm install -g firebase-tools
   ```

2. Login:
   ```bash
   firebase login
   ```

3. Initialize:
   ```bash
   firebase init
   ```
   - Select "Functions" and "Hosting"
   - Use existing project
   - Choose JavaScript or TypeScript
   - Install dependencies

4. Deploy:
   ```bash
   firebase deploy
   ```

### Option B: Railway.app (Easiest)

1. Go to https://railway.app
2. Sign up/login
3. Click "New Project" > "Deploy from GitHub"
4. Connect your repository
5. Add environment variables from `.env`
6. Deploy

### Option C: Render.com

1. Go to https://render.com
2. Create new "Web Service"
3. Connect GitHub repository
4. Add environment variables
5. Deploy

## Troubleshooting

### "Cannot find module 'express'"
```bash
npm install
```

### "Firebase initialization failed"
- Check `serviceAccountKey.json` exists
- Verify `.env` has correct credentials
- Make sure Firestore is enabled in Firebase Console

### "CORS error" in website
- Add your website URL to `ALLOWED_ORIGINS` in `.env`
- Restart backend server

### "Hero not found" in Bits purchase
- Hero needs `twitchUserId` field
- Test with Twitch user ID from actual Twitch account
- Or create test hero with known `twitchUserId`

## Security Checklist

Before going to production:

- [ ] Update Firestore security rules (remove `allow read, write: if true`)
- [ ] Store `serviceAccountKey.json` securely (never commit to Git)
- [ ] Use environment variables for all secrets
- [ ] Enable Firebase Authentication
- [ ] Add rate limiting
- [ ] Set up monitoring and alerts
- [ ] Use HTTPS only
- [ ] Validate all user inputs
- [ ] Add logging for all transactions

## Next Steps

1. Set up Firebase Authentication for secure user login
2. Implement proper Firestore security rules
3. Add backend validation for all operations
4. Set up monitoring and error tracking
5. Deploy to production
6. Update Twitch Extension to use production URL
7. Test thoroughly before going live

## Support

For issues, check:
- Firebase Console logs
- Backend console output
- Browser console errors
- Network tab in DevTools

See main documentation in `E:\IdleDnD\docs\` for more help.
