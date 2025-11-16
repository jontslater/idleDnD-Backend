# The Never Ending War - Backend API

Firebase-based backend API for The Never Ending War game.

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Set Up Firebase

1. Go to https://console.firebase.google.com/
2. Create a new project (or use existing)
3. Enable Firestore Database
4. Go to Project Settings > Service Accounts
5. Click "Generate New Private Key"
6. Download the JSON file and save it as `serviceAccountKey.json` in this directory

### 3. Configure Environment

Copy `.env.example` to `.env`:

```bash
cp .env.example .env
```

Update `.env` with your Firebase credentials from the service account JSON:
- `FIREBASE_PROJECT_ID` - from "project_id"
- `FIREBASE_CLIENT_EMAIL` - from "client_email"
- `FIREBASE_PRIVATE_KEY` - from "private_key" (keep the quotes and newlines)

### 4. Run Development Server

```bash
npm run dev
```

The API will be available at http://localhost:3001

## API Endpoints

### Health Check
```
GET /api/health
```

### Authentication
```
POST   /api/auth/twitch         - Login with Twitch OAuth code
GET    /api/auth/me             - Get current authenticated user
POST   /api/auth/tiktok/link    - Link TikTok account (optional)
POST   /api/auth/logout         - Logout (client-side token removal)
```

### Heroes
```
GET    /api/heroes              - Get all heroes
GET    /api/heroes/:userId      - Get hero by user ID
GET    /api/heroes/twitch/:twitchUserId - Get hero by Twitch ID
POST   /api/heroes              - Create new hero
PUT    /api/heroes/:userId      - Update hero
DELETE /api/heroes/:userId      - Delete hero
```

### Guilds
```
GET    /api/guilds              - Get all guilds
GET    /api/guilds/:guildId     - Get guild by ID
GET    /api/guilds/member/:userId - Get user's guild
POST   /api/guilds              - Create new guild
PUT    /api/guilds/:guildId     - Update guild
POST   /api/guilds/:guildId/join - Join guild
POST   /api/guilds/:guildId/leave - Leave guild
```

### Raids
```
GET    /api/raids               - Get all raids
GET    /api/raids/:raidId       - Get raid by ID
POST   /api/raids/:raidId/signup - Sign up for raid
```

### World Boss
```
GET    /api/worldboss           - Get current world boss
POST   /api/worldboss/signup    - Sign up for world boss
```

### Bits Purchases (Twitch Extension)
```
POST   /api/bits/purchase       - Process Bits purchase
```

### Profession
```
POST   /api/profession/craft    - Craft elixir
POST   /api/profession/use      - Use elixir
```

## Database Structure

### Collections

- **heroes** - Player hero data
- **guilds** - Guild information
- **raids** - Raid schedules and signups
- **worldBoss** - World boss events
- **transactions** - Bits purchase history

See `docs/DATABASE_SCHEMA.md` for detailed schema.

## Deployment

### Option 1: Firebase Functions (Recommended)

```bash
npm run deploy
```

### Option 2: Cloud Platform (Railway, Render, etc.)

1. Push to GitHub
2. Connect to your cloud platform
3. Set environment variables
4. Deploy

### Option 3: VPS (DigitalOcean, AWS EC2, etc.)

1. SSH into server
2. Clone repository
3. Install dependencies
4. Set up PM2 or systemd service
5. Configure nginx reverse proxy

## Testing

### Local Testing

```bash
# Start the server
npm run dev

# In another terminal, test endpoints
curl http://localhost:3001/api/health
```

### Firebase Emulators

```bash
npm run serve
```

## Security

- All routes use JWT verification (Twitch tokens)
- Firebase Admin SDK for secure database access
- CORS configured for allowed origins only
- Sensitive data in environment variables
- Service account key not committed to Git

## Troubleshooting

### "Cannot find module 'firebase-admin'"
```bash
npm install
```

### "Error initializing Firebase"
- Check `serviceAccountKey.json` is present
- Verify `.env` has correct Firebase credentials
- Ensure Firebase project has Firestore enabled

### "CORS error"
- Add your frontend URL to `ALLOWED_ORIGINS` in `.env`
- Restart the server after changing `.env`

## Support

For issues or questions, see the main project documentation in `E:\IdleDnD\docs\`
