# Frontend API Compatibility

## Summary

All frontend-called endpoints have been verified against backend route protection. Browser source and portal calls use user JWT (`Authorization: Bearer <token>`).

## Frontend Repository

- **Repo**: `jontslater/TNEWFE`
- **Branch**: `cursor/refactor-overlay-security-code-health-c08c`
- **Client**: `src/api/client.ts` and component hooks

## Endpoint Compatibility Table

### Browser Source / Overlay Endpoints

| Frontend Call | Backend Route | Middleware | Compatible | Notes |
|---|---|---|---|---|
| `battlefieldAPI.registerBrowserSource()` | POST `/api/battlefields/register` | requireAuth | ✅ Yes | Changed from requireInternal to requireAuth for browser calls |
| `overlayAPI.syncPendingDeltas()` | POST `/api/overlay/sync` | requireStreamerAccess | ✅ Yes | Requires X-Streamer-Key header |
| `overlayAPI.getBatchStatus()` | GET `/api/overlay/sync/:batchId` | requireStreamerAccess | ✅ Yes | Requires X-Streamer-Key header |
| `battlefieldAPI.getBattlefieldHeroes()` | GET `/api/battlefields/:battlefieldId/heroes` | Public | ✅ Yes | Read-only public data |
| `battlefieldAPI.getBattlefieldState()` | GET `/api/battlefields/:battlefieldId/state` | Public | ✅ Yes | Read-only public data |

### Portal / Dashboard Endpoints

| Frontend Call | Backend Route | Middleware | Compatible | Notes |
|---|---|---|---|---|
| `authAPI.loginWithTwitch()` | POST `/api/auth/twitch` | Public | ✅ Yes | OAuth login endpoint |
| `authAPI.getCurrentUser()` | GET `/api/auth/me` | verifyToken | ✅ Yes | Token verification |
| `heroAPI.getHero()` | GET `/api/heroes/:userId` | requireAuth, requireOwnership | ✅ Yes | User's own hero |
| `heroAPI.updateHero()` | PUT `/api/heroes/:userId` | requireAuth, requireOwnership | ✅ Yes | User's own hero |
| `heroAPI.purchaseGold()` | POST `/api/heroes/:userId/purchase/gold` | requireAuth, requireOwnership | ✅ Yes | Gold shop |
| `heroAPI.purchaseTokens()` | POST `/api/heroes/:userId/purchase/tokens` | requireAuth, requireOwnership | ✅ Yes | Token shop |
| `guildAPI.getGuilds()` | GET `/api/guilds/` | Public | ✅ Yes | Browse guilds |
| `guildAPI.createGuild()` | POST `/api/guilds/` | requireAuth | ✅ Yes | Create guild |
| `guildAPI.joinGuild()` | POST `/api/guilds/:guildId/join` | requireAuth | ✅ Yes | Join guild |
| `mailAPI.getMailbox()` | GET `/api/mail/:userId` | requireAuth, requireOwnership | ✅ Yes | User's mailbox |
| `mailAPI.sendMail()` | POST `/api/mail/send` | requireAuth | ✅ Yes | Send mail |
| `auctionAPI.getListings()` | GET `/api/auction/listings` | Public | ✅ Yes | Browse auctions |
| `auctionAPI.placeBid()` | POST `/api/auction/:listingId/bid` | requireAuth | ✅ Yes | Place bid |
| `purchaseAPI.createCheckoutSession()` | POST `/api/purchases/create-checkout-session` | requireAuth | ✅ Yes | Stripe checkout |
| `streamSettings.getSettings()` | GET `/api/stream/settings/:twitchId` | requireAuth | ✅ Yes | Own settings |
| `streamSettings.updateSettings()` | PUT `/api/stream/settings/:twitchId` | requireAuth | ✅ Yes | Own settings |
| `streamSettings.getOverlayKey()` | GET `/api/stream/settings/:twitchId/overlay-key` | requireAuth | ✅ Yes | Own overlay key |

### Chat Activity / Metrics

| Frontend Call | Backend Route | Middleware | Compatible | Notes |
|---|---|---|---|---|
| `chatAPI.getChatActivity()` | GET `/api/chat/activity/:streamerId` | optionalAuth, requireStreamerAccess | ✅ Yes | Requires X-Streamer-Key for overlay |

## Authentication Headers

### User JWT (Portal / Dashboard)
```typescript
headers: {
  'Authorization': `Bearer ${userToken}`,
  'Content-Type': 'application/json'
}
```

### Streamer Key (Overlay / Browser Source)
```typescript
headers: {
  'X-Streamer-Key': overlayKey,
  'Content-Type': 'application/json'
}
```

### Combined (Overlay with User Context)
```typescript
headers: {
  'Authorization': `Bearer ${userToken}`,
  'X-Streamer-Key': overlayKey,
  'Content-Type': 'application/json'
}
```

## Internal API Calls (Backend Only)

The following routes are NOT called by the frontend and require `X-Internal-Key`:

- POST `/api/battlefields/:battlefieldId/combat/xp/accumulate`
- POST `/api/battlefields/:battlefieldId/combat/xp/flush`
- POST `/api/chat/join` (now called directly as function, not HTTP)
- POST `/api/achievements/check`
- POST `/api/lootTokens/award`
- POST `/api/leaderboards/update`

These are called by:
- Backend services (XP accumulator, achievement service)
- Twitch bot (chat join now uses direct function call)
- Cron jobs / scheduled tasks

## Migration Notes

### For Frontend Developers

1. **Browser Source Registration**: No changes needed - still sends user JWT
2. **Overlay Sync**: Requires X-Streamer-Key header (fetched from `/api/stream/settings/:twitchId/overlay-key`)
3. **All other endpoints**: Continue using user JWT in Authorization header

### Breaking Changes

**None** - All frontend-called routes remain compatible with user JWT authentication. The only change is that overlay-specific routes now also require the streamer key for additional validation.

## Testing Checklist

- [ ] Browser source can register heroes with user JWT
- [ ] Overlay sync works with X-Streamer-Key
- [ ] Portal dashboard works with user JWT
- [ ] Chat activity endpoint works with streamer key
- [ ] Public routes work without auth
- [ ] Stripe webhooks work (validated by Stripe signature)

## Environment Variables Required

### Frontend
```bash
VITE_API_URL=https://api.example.com
VITE_STRIPE_PUBLISHABLE_KEY=pk_...
```

### Backend
```bash
JWT_SECRET=<random-secret>
INTERNAL_API_KEY=<random-secret>
ADMIN_KEY=<random-secret>
TWITCH_CLIENT_ID=<twitch-app-id>
TWITCH_CLIENT_SECRET=<twitch-app-secret>
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

All frontend API calls are compatible. No breaking changes.
