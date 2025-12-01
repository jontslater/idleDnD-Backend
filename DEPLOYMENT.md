# Backend Deployment Guide

## Deployment Options

### Option 1: Railway (Recommended for Express apps)
1. Create account at railway.app
2. Connect GitHub repository
3. Add environment variables:
   - FIREBASE_PROJECT_ID
   - FIREBASE_CLIENT_EMAIL
   - FIREBASE_PRIVATE_KEY
   - ALLOWED_ORIGINS (comma-separated)
   - PORT (optional, defaults to 3001)
4. Deploy - Railway auto-detects Node.js

### Option 2: Render
1. Create account at render.com
2. Create new Web Service
3. Connect repository
4. Set build command: `npm install`
5. Set start command: `npm start`
6. Add environment variables (same as Railway)

### Option 3: Firebase Functions
1. Install Firebase CLI: `npm install -g firebase-tools`
2. Run `firebase init functions`
3. Convert Express app to Functions format
4. Deploy: `firebase deploy --only functions`

## Environment Variables

Required:
- `FIREBASE_PROJECT_ID` - Your Firebase project ID
- `FIREBASE_CLIENT_EMAIL` - Service account email
- `FIREBASE_PRIVATE_KEY` - Service account private key (with \n as actual newlines)

Optional:
- `ALLOWED_ORIGINS` - Comma-separated list of allowed origins (default: *)
- `PORT` - Server port (default: 3001)
- `NODE_ENV` - Environment (development/production)

## Post-Deployment

1. Update frontend API URL to point to deployed backend
2. Update Electron app API URL
3. Test all endpoints
4. Set up leaderboard update cron job (every 5 minutes recommended)

## Leaderboard Updates

Set up a cron job or scheduled task to call:
`POST /api/leaderboards/update`

Recommended frequency: Every 5 minutes
