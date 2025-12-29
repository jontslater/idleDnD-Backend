# Multi-Platform Chat Integration Plan

## Overview
This document outlines the plan to solidify Twitch chat integration and add TikTok chat support, enabling streamers to use commands on both platforms simultaneously.

---

## Phase 1: Verify & Solidify Twitch Integration

### 1.1 Token Management & Refresh

**Current State:**
- ✅ Tokens stored: `twitchAccessToken`, `twitchRefreshToken`
- ✅ Expiry tracked: `twitchTokenExpiresAt` (1 hour)
- ❌ No automatic token refresh when expired
- ❌ No token validation before use

**Tasks:**
1. **Create Token Refresh Utility**
   - Check `twitchTokenExpiresAt` before using token
   - Auto-refresh if expired or near expiry (< 5 minutes)
   - Handle refresh failures gracefully

2. **Add Token Validation**
   - Validate token before initializing chat listener
   - Handle invalid/expired tokens
   - Log token issues for debugging

3. **Update All Chat Listener Initialization Points**
   - `routes/auth.js` - On login
   - `routes/battlefields.js` - On browser source registration
   - `routes/chat.js` - Manual initialization
   - Use the refresh utility in all places

**Files to Create/Modify:**
- **NEW:** `src/services/twitchTokenManager.js` - Token refresh & validation
- **MODIFY:** `src/websocket/twitch-events.js` - Use token manager
- **MODIFY:** `src/routes/auth.js` - Use token manager
- **MODIFY:** `src/routes/battlefields.js` - Use token manager
- **MODIFY:** `src/routes/chat.js` - Use token manager

---

### 1.2 Chat Listener Reliability

**Current State:**
- ✅ Chat listener initializes on login
- ✅ Chat listener initializes on browser source registration
- ❌ No reconnection logic if connection drops
- ❌ No error recovery for auth failures

**Tasks:**
1. **Add Connection Health Monitoring**
   - Detect disconnections
   - Auto-reconnect with token refresh if needed
   - Exponential backoff for reconnection

2. **Improve Error Handling**
   - Distinguish between recoverable and fatal errors
   - Log errors with context
   - Notify streamer if chat listener fails permanently

3. **Add Connection Status Tracking**
   - Track which streamers have active listeners
   - Expose status in API for frontend
   - Show connection status in Player Portal

**Files to Modify:**
- `src/websocket/twitch-events.js` - Add reconnection logic
- `src/routes/battlefields.js` - Add status endpoint
- Frontend: Add connection status display

---

### 1.3 Command Processing Verification

**Current State:**
- ✅ Commands processed via `commandHandler.js`
- ✅ Commands work for viewers
- ❓ Need to verify all commands work correctly
- ❓ Need to verify error messages are clear

**Tasks:**
1. **Test All Commands**
   - `!join`, `!leave`, `!rejoin`, `!switch`
   - `!stats`, `!heroes`, `!quest`, `!skills`
   - `!auto`, `!classes`, `!leaderboard`
   - Verify error handling for edge cases

2. **Improve Error Messages**
   - Clear messages when commands fail
   - Helpful messages for common issues
   - Rate limiting messages if needed

3. **Add Command Logging**
   - Log all commands for debugging
   - Track command success/failure rates
   - Monitor for unusual patterns

**Files to Modify:**
- `src/services/commandHandler.js` - Improve error messages
- Add logging/monitoring

---

### 1.4 Testing & Documentation

**Tasks:**
1. **Create Test Scenarios**
   - Streamer logs in → chat listener initializes
   - Token expires → auto-refresh works
   - Connection drops → auto-reconnect works
   - Multiple streamers → all listeners work independently

2. **Document Twitch Setup**
   - OAuth scopes required
   - Token refresh flow
   - Troubleshooting guide
   - Common issues and solutions

**Deliverables:**
- ✅ All Twitch features working reliably
- ✅ Token refresh working automatically
- ✅ Chat listeners stable and reconnecting
- ✅ Clear error messages
- ✅ Documentation complete

---

## Phase 2: Add TikTok Support

### 2.1 Store TikTok Tokens on Login

**Current State:**
- ✅ TikTok OAuth implemented
- ✅ Tokens received from TikTok
- ❌ Tokens not stored in hero document
- ❌ No token refresh logic

**Tasks:**
1. **Store TikTok Tokens**
   - Add `tiktokAccessToken` to hero document
   - Add `tiktokRefreshToken` to hero document
   - Add `tiktokTokenExpiresAt` timestamp
   - Store on login (same pattern as Twitch)

2. **Create TikTok Token Manager**
   - Mirror Twitch token manager pattern
   - Handle TikTok-specific token refresh
   - Validate TikTok tokens

**Files to Create/Modify:**
- **NEW:** `src/services/tiktokTokenManager.js` - Token refresh & validation
- **MODIFY:** `src/routes/auth.js` - Store TikTok tokens on login

---

### 2.2 TikTok Live API Integration

**Current State:**
- ❌ No TikTok Live API integration
- ❌ No webhook handler
- ❌ No event subscription

**Tasks:**
1. **Research TikTok Live API**
   - Verify API endpoints
   - Check required scopes/permissions
   - Understand webhook format
   - Test API access

2. **Create TikTok Live Event Subscriber**
   - Subscribe to chat comments
   - Handle subscription lifecycle
   - Manage multiple streamers

3. **Create Webhook Handler**
   - Receive TikTok events
   - Verify webhook signatures
   - Process chat comments as commands

**Files to Create:**
- **NEW:** `src/websocket/tiktok-events.js` - TikTok Live API integration
- **NEW:** `src/routes/tiktok.js` - Webhook routes
- **NEW:** `src/services/tiktokLiveSubscription.js` - Subscription management

---

### 2.3 Unified Command Processing

**Current State:**
- ✅ Commands work for Twitch
- ❌ Battlefield IDs hardcoded to `twitch:` format
- ❌ Command handler assumes Twitch-only

**Tasks:**
1. **Support `tiktok:` Battlefield IDs**
   - Update battlefield ID generation
   - Support both `twitch:` and `tiktok:` formats
   - Update all battlefield queries

2. **Make Command Handler Platform-Agnostic**
   - Add `provider` parameter
   - Handle both Twitch and TikTok users
   - Support multi-platform heroes

3. **Update WebSocket Broadcasting**
   - Support TikTok room IDs
   - Route events to correct platform
   - Handle multi-stream scenarios

**Files to Modify:**
- `src/routes/chat.js` - Add provider parameter
- `src/services/commandHandler.js` - Platform-agnostic
- `src/websocket/server.js` - Support TikTok rooms

---

### 2.4 Multi-Streaming Support

**Current State:**
- ✅ Heroes can have both `twitchUserId` and `tiktokUserId`
- ❌ Joining one platform removes from other
- ❌ No support for same hero on both platforms

**Tasks:**
1. **Allow Multi-Platform Battlefield Presence**
   - Hero can be on `twitch:` and `tiktok:` simultaneously
   - Commands work on both platforms
   - Separate state per platform

2. **Handle Platform-Specific Logic**
   - Different command responses per platform
   - Platform-specific features
   - Unified hero state

3. **Update UI for Multi-Streaming**
   - Show connection status for both platforms
   - Allow linking/unlinking accounts
   - Display active platforms

**Files to Modify:**
- `src/routes/chat.js` - Multi-platform join logic
- Frontend: Player Portal UI updates

---

### 2.5 Frontend Integration

**Tasks:**
1. **Add TikTok Connection UI**
   - "Connect TikTok" button
   - Connection status indicators
   - Link/unlink functionality

2. **Update Player Portal**
   - Show both Twitch and TikTok status
   - Platform-specific settings
   - Multi-streaming toggle

3. **Handle TikTok OAuth Callback**
   - Already exists, verify it works
   - Store tokens properly
   - Initialize subscriptions

**Files to Modify:**
- Frontend: Player Portal components
- Frontend: Navigation (already removed TikTok button, may need to add back for linking)

---

### 2.6 Testing & Documentation

**Tasks:**
1. **Test TikTok Integration**
   - Login flow
   - Token storage
   - Live subscription
   - Webhook processing
   - Command processing
   - Multi-streaming

2. **Document TikTok Setup**
   - TikTok Developer setup
   - Required permissions/scopes
   - Webhook configuration
   - Troubleshooting guide

**Deliverables:**
- ✅ TikTok tokens stored and refreshed
- ✅ TikTok Live API integrated
- ✅ Commands work on TikTok
- ✅ Multi-streaming supported
- ✅ Documentation complete

---

## Implementation Checklist

### Phase 1: Twitch (Must Complete First)

- [ ] **1.1.1** Create `twitchTokenManager.js` with refresh logic
- [ ] **1.1.2** Add token validation before use
- [ ] **1.1.3** Update all chat listener init points to use token manager
- [ ] **1.2.1** Add connection health monitoring
- [ ] **1.2.2** Implement auto-reconnection with backoff
- [ ] **1.2.3** Add connection status API endpoint
- [ ] **1.2.4** Add connection status UI in Player Portal
- [ ] **1.3.1** Test all commands thoroughly
- [ ] **1.3.2** Improve error messages
- [ ] **1.3.3** Add command logging
- [ ] **1.4.1** Create test scenarios document
- [ ] **1.4.2** Write Twitch setup documentation

### Phase 2: TikTok (After Phase 1 Complete)

- [ ] **2.1.1** Store TikTok tokens in hero document
- [ ] **2.1.2** Create `tiktokTokenManager.js`
- [ ] **2.2.1** Research TikTok Live API (verify endpoints)
- [ ] **2.2.2** Create TikTok Live event subscriber
- [ ] **2.2.3** Create webhook handler
- [ ] **2.3.1** Support `tiktok:` battlefield IDs
- [ ] **2.3.2** Make command handler platform-agnostic
- [ ] **2.3.3** Update WebSocket broadcasting
- [ ] **2.4.1** Allow multi-platform battlefield presence
- [ ] **2.4.2** Handle platform-specific logic
- [ ] **2.4.3** Update UI for multi-streaming
- [ ] **2.5.1** Add TikTok connection UI
- [ ] **2.5.2** Update Player Portal
- [ ] **2.6.1** Test TikTok integration end-to-end
- [ ] **2.6.2** Document TikTok setup

---

## Success Criteria

### Phase 1 Complete When:
- ✅ Twitch tokens refresh automatically
- ✅ Chat listeners reconnect automatically
- ✅ All commands work reliably
- ✅ Connection status visible to streamers
- ✅ No token-related errors in production

### Phase 2 Complete When:
- ✅ Streamers can connect both Twitch and TikTok
- ✅ Commands work on both platforms
- ✅ Same hero can be active on both platforms
- ✅ Multi-streaming works seamlessly
- ✅ Documentation complete

---

## Risk Assessment

### Phase 1 Risks:
- **Token refresh may fail** → Need fallback to re-login
- **Connection issues** → Need robust reconnection
- **Mitigation:** Comprehensive error handling and logging

### Phase 2 Risks:
- **TikTok API may have limitations** → Research first
- **Webhook setup complexity** → Clear documentation needed
- **Multi-streaming state conflicts** → Careful state management
- **Mitigation:** Thorough testing, clear architecture

---

## Estimated Timeline

- **Phase 1:** 2-3 days (Twitch solidification)
- **Phase 2:** 3-4 days (TikTok integration)
- **Total:** 5-7 days

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│              Multi-Platform Support                      │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  Twitch Chat (tmi.js)          TikTok Webhooks            │
│       │                              │                    │
│       ▼                              ▼                    │
│  twitch-events.js              tiktok-events.js          │
│       │                              │                    │
│       └──────────┬───────────────────┘                    │
│                  ▼                                        │
│         Unified Command Handler                           │
│         (processCommand.js)                               │
│                  │                                        │
│                  ▼                                        │
│         Battlefield System                                │
│         - twitch:123456                                   │
│         - tiktok:789012                                   │
│         - Same hero can be on both                        │
│                                                           │
└─────────────────────────────────────────────────────────┘
```

---

## Token Storage Schema

```javascript
hero: {
  // Twitch (existing)
  twitchUserId: string,
  twitchAccessToken: string,
  twitchRefreshToken: string,
  twitchTokenExpiresAt: number,
  twitchUsername: string,
  
  // TikTok (new)
  tiktokUserId: string,
  tiktokAccessToken: string,
  tiktokRefreshToken: string,
  tiktokTokenExpiresAt: number,
  tiktokUsername: string,
}
```

---

## Notes

- **Phase 1 must be completed before starting Phase 2**
- All Twitch functionality must be stable and reliable
- Token management is critical for both platforms
- Multi-streaming requires careful state management
- Documentation is essential for troubleshooting

---

## Last Updated
2024-12-XX






