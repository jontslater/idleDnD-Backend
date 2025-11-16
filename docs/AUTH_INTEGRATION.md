# Authentication Integration Guide

How to integrate Twitch OAuth authentication with the backend.

## Overview

The backend now supports Twitch OAuth authentication, allowing users to log in with their Twitch accounts. The flow creates or finds a hero in Firebase and returns a JWT token for subsequent API requests.

## Authentication Flow

```
1. User clicks "Login with Twitch" on frontend
2. Frontend redirects to Twitch OAuth page
3. User authorizes on Twitch
4. Twitch redirects back with authorization code
5. Frontend sends code to POST /api/auth/twitch
6. Backend exchanges code for Twitch access token
7. Backend fetches Twitch user info
8. Backend creates/finds hero in Firebase
9. Backend generates JWT token
10. Backend returns user data + token
11. Frontend stores token and user data
```

## API Endpoints

### 1. Login with Twitch

**POST** `/api/auth/twitch`

Exchange Twitch OAuth authorization code for user data and JWT token.

**Request:**
```json
{
  "code": "authorization_code_from_twitch"
}
```

**Response:**
```json
{
  "user": {
    "id": "hero_firebase_id",
    "twitchUsername": "DisplayName",
    "twitchId": "12345678",
    "hero": {
      "id": "hero_firebase_id",
      "name": "DisplayName",
      "level": 1,
      "hp": 100,
      "maxHp": 100,
      ...
    }
  },
  "token": "jwt_token_here"
}
```

**Frontend Example:**
```typescript
const response = await fetch('http://localhost:3001/api/auth/twitch', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ code: authorizationCode })
});

const { user, token } = await response.json();
localStorage.setItem('auth_token', token);
```

### 2. Get Current User

**GET** `/api/auth/me`

Verify JWT token and get current user data.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "id": "hero_firebase_id",
  "twitchUsername": "DisplayName",
  "twitchId": "12345678",
  "hero": {
    ...hero_data
  }
}
```

**Frontend Example:**
```typescript
const token = localStorage.getItem('auth_token');
const response = await fetch('http://localhost:3001/api/auth/me', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});

const userData = await response.json();
```

### 3. Link TikTok Account

**POST** `/api/auth/tiktok/link`

Link a TikTok account to the user's profile (coming soon).

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Request:**
```json
{
  "code": "tiktok_authorization_code"
}
```

## Frontend Integration

### Update AuthCallback Component

Replace the mock authentication in `src/pages/AuthCallback.tsx`:

```typescript
// Before (mock):
const mockUser = {
  id: 'user_' + Math.random().toString(36).substr(2, 9),
  twitchUsername: 'TwitchUser',
  twitchId: code.substr(0, 10)
};
const mockToken = 'mock_token_' + Date.now();
login(mockToken, mockUser);

// After (real):
const { user, token } = await authAPI.loginWithTwitch(code);
login(token, user);
```

### API Client Configuration

The API client in `src/api/client.ts` already handles:
- ✅ Adding JWT token to request headers
- ✅ Auth API methods (`loginWithTwitch`, `getCurrentUser`, `linkTikTok`)

## Environment Variables

### Backend (.env)
```env
TWITCH_CLIENT_ID=your_client_id
TWITCH_CLIENT_SECRET=your_client_secret
TWITCH_REDIRECT_URI=http://localhost:3000/auth/callback
JWT_SECRET=your-super-secret-jwt-key
```

### Frontend (.env)
```env
VITE_TWITCH_CLIENT_ID=your_client_id
VITE_TWITCH_REDIRECT_URI=http://localhost:3000/auth/callback
VITE_API_URL=http://localhost:3001
VITE_USE_MOCK=false
```

**Important:** Both backend and frontend must use the same `TWITCH_CLIENT_ID` and `TWITCH_REDIRECT_URI`.

## Twitch App Setup

1. Go to https://dev.twitch.tv/console/apps
2. Click "Register Your Application"
3. Fill in:
   - **Name:** The Never Ending War (or your choice)
   - **OAuth Redirect URLs:** `http://localhost:3000/auth/callback`
   - **Category:** Game Integration or Website Integration
4. Click "Create"
5. Copy the **Client ID**
6. Click "New Secret" to generate a **Client Secret**
7. Add both to your `.env` files

## Testing

### Test the Auth Flow

1. Start backend: `npm run dev` (in backend directory)
2. Start frontend: `npm run dev` (in frontend directory)
3. Click "Login with Twitch" on the website
4. Authorize on Twitch
5. Should redirect back and see your hero data

### Test with cURL

```bash
# This won't work directly because you need a real OAuth code from Twitch
# But you can test the /me endpoint with a valid token:

curl http://localhost:3001/api/auth/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

## Hero Auto-Creation

When a new user logs in for the first time, the backend automatically creates a hero with:

- **Name:** Twitch display name
- **Role:** Berserker (default)
- **Level:** 1
- **HP:** 100/100
- **Stats:** Default starting stats
- **Equipment:** Empty
- **Gold/Tokens:** 0

Users can customize their hero after first login.

## Security Notes

1. **JWT Tokens** expire after 30 days by default
2. **HTTPS required** for production Twitch OAuth
3. **State parameter** prevents CSRF attacks (frontend handles this)
4. **Client Secret** never exposed to frontend
5. **Tokens stored** in localStorage (consider httpOnly cookies for production)

## Troubleshooting

### "Failed to authenticate with Twitch"
- Check `TWITCH_CLIENT_ID` and `TWITCH_CLIENT_SECRET` in backend `.env`
- Verify `TWITCH_REDIRECT_URI` matches exactly in Twitch console and both `.env` files

### "Invalid or expired token"
- Token may have expired (30 days)
- User should re-login with Twitch

### "CORS error"
- Add frontend URL to `ALLOWED_ORIGINS` in backend `.env`
- Restart backend server after .env changes

### "Hero not found"
- Hero should be auto-created on first login
- Check Firebase console to verify hero was created
- Check backend logs for errors during hero creation

## Next Steps

1. ✅ Replace mock auth with real auth in frontend
2. ⏳ Test with real Twitch account
3. ⏳ Add TikTok OAuth integration
4. ⏳ Implement token refresh mechanism
5. ⏳ Add role selection after first login
6. ⏳ Deploy to production with HTTPS
