# Pre-Deployment Checklist

## ✅ Completed Features
- [x] Skills combat integration
- [x] Guild management UI
- [x] Guild perks system
- [x] Login reward modal
- [x] Dungeon finder UI
- [x] Enchanting station UI
- [x] All routes registered in index.js

## 🔧 Pre-Deployment Steps

### 1. Stop Local Backend
```powershell
# Find and kill process on port 3001
netstat -ano | findstr :3001
taskkill /PID <PID> /F
```

### 2. Test Local Startup
```powershell
npm run dev
# Should start without errors
```

### 3. Environment Variables (Railway/Render)
Required:
- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY` (with actual newlines, not \n)
- `ALLOWED_ORIGINS` (comma-separated: your frontend URLs)

Optional:
- `PORT` (Railway will set this automatically)
- `NODE_ENV=production`

### 4. Verify All Routes Are Working
Test these endpoints locally:
- ✅ `/api/health` - Health check
- ✅ `/api/skills/:userId` - Skills
- ✅ `/api/guilds` - Guild management
- ✅ `/api/guild-perks/hero/:userId` - Guild perks
- ✅ `/api/login-rewards/:userId` - Login rewards
- ✅ `/api/dungeon/queue` - Dungeon finder
- ✅ `/api/enchanting/:userId` - Enchanting

### 5. Update Frontend API URL
After deployment, update:
- `IdleDnD-Web/src/api/client.ts` - Change base URL
- `IdleDnD/game.js` - Update any API calls

### 6. Deploy to Railway
1. Push code to GitHub
2. Railway will auto-deploy
3. Add environment variables in Railway dashboard
4. Get deployment URL
5. Update frontend to use new URL

## 🚨 Known Issues to Fix Before Deploy

### Issue 1: Port Already in Use
**Solution:** Kill existing process or change PORT in .env

### Issue 2: Guild Perks Service Import
The `guildPerksService.js` imports from `../index.js` which might cause circular dependency.
**Status:** Should be fine, but test locally first.

## 📝 Post-Deployment Tasks

1. Test all new endpoints
2. Verify CORS is working
3. Check Firebase connection
4. Test login reward system
5. Test guild management
6. Test dungeon finder
7. Set up leaderboard update cron (every 5 min)

## 🔗 Deployment URLs

After deployment, you'll get:
- Railway: `https://your-app.railway.app`
- Update frontend: `IdleDnD-Web/src/api/client.ts`

