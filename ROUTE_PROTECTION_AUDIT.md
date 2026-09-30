# Route Protection Audit Report

**Generated**: 2026-09-30T21:41:09.001Z

## Summary

- **Total Routes**: 220
- **Protected**: 152
- **Public (whitelisted)**: 35
- **Internal (backend services)**: 9
- **Unprotected Mutating**: 0 ❌
- **Unprotected Private Data**: 0 ❌

## ✅ NO VIOLATIONS

All routes are properly protected!

## Detailed Route Protection by File

### achievements.js (6 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| GET | / | ✅ PUBLIC | 12 |
| GET | /:userId | requireAuth, requireOwnership | 29 |
| POST | /check | 🔧 INTERNAL | 44 |
| PUT | /:userId/title | requireAuth, requireOwnership | 66 |
| POST | /:userId/sync-titles | requireAuth, requireOwnership | 85 |
| POST | /:userId/unlock-all | requireAdmin | 112 |

### auction.js (8 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| GET | /listings | ✅ PUBLIC | 9 |
| POST | /list | requireAuth | 97 |
| POST | /:listingId/bid | requireAuth | 261 |
| POST | /:listingId/buyout | requireAuth | 392 |
| POST | /:listingId/cancel | requireAuth | 552 |
| GET | /my-listings/:userId | requireAuth, requireOwnership | 638 |
| GET | /my-bids/:userId | requireAuth, requireOwnership | 723 |
| GET | /history/:userId | requireAuth, requireOwnership | 743 |

### auth.js (5 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| POST | /twitch | ✅ PUBLIC | 36 |
| POST | /tiktok | ✅ PUBLIC | 322 |
| GET | /me | verifyToken | 435 |
| POST | /tiktok/link | verifyToken | 474 |
| POST | /logout | ✅ PUBLIC | 499 |

### battlefields.js (12 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| GET | /:battlefieldId/heroes | ✅ PUBLIC | 11 |
| GET | /active | ✅ PUBLIC | 39 |
| GET | /:battlefieldId/state | ✅ PUBLIC | 72 |
| POST | /register | 🔧 INTERNAL | 132 |
| POST | /preferences/sprite-facing | requireAuth | 303 |
| GET | /preferences/sprite-facing/:userId | requireAuth, requireOwnership | 388 |
| POST | /preferences/sprite-facing/bulk | requireAuth | 455 |
| POST | /:battlefieldId/combat/xp/accumulate | 🔧 INTERNAL | 491 |
| POST | /:battlefieldId/combat/xp | requireAuth | 545 |
| POST | /:battlefieldId/combat/xp/flush | 🔧 INTERNAL | 622 |
| GET | /:battlefieldId/combat/xp/status | ✅ PUBLIC | 656 |
| POST | /:battlefieldId/combat/xp/preview | requireAuth | 682 |

### bits.js (1 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| POST | /purchase | verifyTwitchToken | 41 |

### chat.js (4 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| POST | /join | 🔧 INTERNAL | 23 |
| POST | /initialize | requireAuth | 463 |
| GET | /status | ❌ **NONE** | 520 |
| GET | /activity/:streamerId | requireStreamerAccess, optionalAuth | 601 |

### dungeon.js (11 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| GET | / | ✅ PUBLIC | 45 |
| GET | /queue/status | requireAuth | 57 |
| POST | /queue | requireAuth | 94 |
| DELETE | /queue | requireAuth | 144 |
| POST | /group/accept | requireAuth | 177 |
| POST | /:dungeonId/start | requireAuth | 418 |
| GET | /instance/:instanceId | ❌ **NONE** | 516 |
| POST | /instance/:instanceId/progress | requireAuth | 535 |
| POST | /instance/:instanceId/complete | requireAuth | 593 |
| GET | /:dungeonId | ✅ PUBLIC | 802 |
| GET | /available/:userId | requireAuth, requireOwnership | 820 |

### enchanting.js (4 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| POST | /:userId/enchant | requireAuth, requireOwnership | 11 |
| GET | /:userId/enchantments | requireAuth, requireOwnership | 156 |
| GET | /enchantments/:slot | ✅ PUBLIC | 176 |
| GET | /enchantments | ✅ PUBLIC | 188 |

### guildPerks.js (2 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| GET | /hero/:userId | ✅ PUBLIC | 9 |
| GET | /calculate/:level | ✅ PUBLIC | 20 |

### guilds.js (20 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| GET | / | ✅ PUBLIC | 13 |
| GET | /:guildId | ✅ PUBLIC | 25 |
| GET | /member/:userId | ✅ PUBLIC | 41 |
| POST | / | requireAuth | 89 |
| PUT | /:guildId | requireAuth | 115 |
| POST | /:guildId/join | requireAuth | 141 |
| POST | /:guildId/apply | requireAuth | 210 |
| POST | /:guildId/approve/:heroId | requireAuth, requireOwnership | 259 |
| POST | /:guildId/reject/:heroId | requireAuth, requireOwnership | 313 |
| PUT | /:guildId/settings | requireAuth | 349 |
| POST | /:guildId/loot/assign | requireAuth | 387 |
| GET | /:guildId/loot | ❌ **NONE** | 463 |
| GET | /:guildId/loot/history | ❌ **NONE** | 483 |
| POST | /:guildId/leave | requireAuth | 504 |
| GET | /:guildId/members-with-heroes | ❌ **NONE** | 526 |
| POST | /:guildId/invite | requireAuth | 662 |
| GET | /invite/:inviteId | ✅ PUBLIC | 746 |
| POST | /invite/:inviteId/accept | requireAuth | 775 |
| GET | /invites/pending/:heroId | requireAuth, requireOwnership | 857 |
| GET | /:guildId/invites | ❌ **NONE** | 889 |

### heroes.js (31 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| POST | /:userId/track-wave | requireAuth, requireOwnership | 12 |
| POST | /test/create | requireAdmin | 39 |
| GET | / | ✅ PUBLIC | 126 |
| GET | /login-reward/:userId/status | requireAuth, requireOwnership | 146 |
| POST | /login-reward/:userId | requireAuth, requireOwnership | 169 |
| GET | /:userId/prestige-store | requireAuth, requireOwnership | 187 |
| GET | /:userId | requireAuth, requireOwnership | 238 |
| POST | /:userId/unlock-slot | requireAuth, requireOwnership | 313 |
| GET | /:userId/slots | requireAuth, requireOwnership | 404 |
| GET | /twitch/:twitchUserId | ✅ PUBLIC | 456 |
| GET | /twitch/:twitchUserId/all | ❌ **NONE** | 547 |
| POST | /create | requireAuth | 654 |
| PATCH | /:heroId/rename | requireAuth, requireOwnership | 829 |
| GET | /create/cost-info | ✅ PUBLIC | 895 |
| POST | / | requireAuth | 950 |
| PUT | /:userId | requireAuth, requireOwnership | 970 |
| POST | /:userId/pin | requireAuth, requireOwnership | 1131 |
| DELETE | /:heroId | requireAuth, requireOwnership | 1157 |
| POST | /:userId/purchase/gold | requireAuth, requireOwnership | 1192 |
| POST | /:userId/purchase/tokens | requireAuth, requireOwnership | 1308 |
| POST | /:userId/upgrade-item | requireAuth, requireOwnership | 1472 |
| POST | /:userId/reforge-item | requireAuth, requireOwnership | 1614 |
| POST | /:userId/equipment/:slot/lock | requireAuth, requireOwnership | 1743 |
| POST | /:userId/equipment/:slot/unlock | requireAuth, requireOwnership | 1786 |
| POST | /:userId/expand-storage | requireAuth, requireOwnership | 1830 |
| POST | /:userId/port | requireAuth, requireOwnership | 1920 |
| POST | /:heroId/claim-idle-rewards | requireAuth, requireOwnership | 2027 |
| POST | /:userId/admin/give-item | requireAdmin | 2070 |
| POST | /:userId/prestige | requireAuth, requireOwnership | 2115 |
| POST | /:userId/prestige-store/purchase | requireAuth, requireOwnership | 2265 |
| POST | /:userId/prestige-store/apply | requireAuth, requireOwnership | 2365 |

### leaderboards.js (3 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| GET | /user/:userId | ✅ PUBLIC | 10 |
| GET | /:type/:category | ✅ PUBLIC | 32 |
| POST | /update | 🔧 INTERNAL | 59 |

### lootTokens.js (4 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| GET | /:userId | requireAuth, requireOwnership | 25 |
| POST | /award | 🔧 INTERNAL | 54 |
| POST | /spend | requireAuth | 115 |
| GET | /history/:userId | requireAuth, requireOwnership | 176 |

### mail.js (5 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| POST | /send | requireAuth | 27 |
| GET | /:userId | requireAuth, requireOwnership | 272 |
| POST | /:mailId/read | requireAuth | 386 |
| POST | /:mailId/claim | requireAuth | 426 |
| DELETE | /:mailId | requireAuth | 590 |

### overlay.js (2 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| POST | /sync | requireStreamerAccess | 38 |
| GET | /sync/:batchId | ❌ **NONE** | 203 |

### parties.js (12 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| POST | /create | requireAuth | 27 |
| GET | /search | ✅ PUBLIC | 93 |
| GET | /:userId | requireAuth, requireOwnership | 220 |
| POST | /:partyId/invite | requireAuth | 260 |
| POST | /invites/:inviteId/accept | requireAuth | 446 |
| POST | /invites/:inviteId/decline | requireAuth | 541 |
| POST | /:partyId/leave | requireAuth | 583 |
| POST | /:partyId/kick | requireAuth | 659 |
| POST | /:partyId/transfer | requireAuth | 714 |
| POST | /:partyId/cancel-queue | requireAuth | 764 |
| POST | /:partyId/queue | requireAuth | 858 |
| GET | /invites/:userId | requireAuth, requireOwnership | 1493 |

### professions.js (10 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| POST | /:userId/profession | requireAuth, requireOwnership | 99 |
| POST | /:userId/craft | requireAuth, requireOwnership | 177 |
| POST | /:userId/gather | requireAuth, requireOwnership | 546 |
| POST | /:userId/apply | requireAuth, requireOwnership | 756 |
| POST | /:userId/use | requireAuth, requireOwnership | 1001 |
| POST | /:userId/equip | requireAuth, requireOwnership | 1187 |
| POST | /:userId/unequip | requireAuth, requireOwnership | 1316 |
| POST | /:userId/apply-socket | requireAuth, requireOwnership | 1565 |
| POST | /:userId/gem | requireAuth, requireOwnership | 1703 |
| POST | /:userId/remove-gem | requireAuth, requireOwnership | 1849 |

### purchases.js (13 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| POST | /founders-pack | requireAuth | 40 |
| POST | /complete | ✅ PUBLIC | 107 |
| GET | /status/:purchaseId | ❌ **NONE** | 213 |
| GET | /founders | ✅ PUBLIC | 243 |
| POST | /set-founder | requireAdmin | 576 |
| POST | /remove-founder | requireAdmin | 751 |
| POST | /token-pack | requireAuth | 834 |
| POST | /complete-token-pack | ✅ PUBLIC | 900 |
| POST | /create-checkout-session | requireAuth | 990 |
| GET | /success | ✅ PUBLIC | 1092 |
| GET | /cancel | ✅ PUBLIC | 1104 |
| GET | /history/:userId | requireAuth, requireOwnership | 1116 |
| GET | /:purchaseId/details | ❌ **NONE** | 1228 |

### quests.js (11 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| GET | /daily | ✅ PUBLIC | 11 |
| GET | /weekly | ✅ PUBLIC | 31 |
| GET | /monthly | ✅ PUBLIC | 51 |
| GET | /:userId/progress | requireAuth, requireOwnership | 71 |
| POST | /:userId/update/:trackingKey | requireAuth, requireOwnership | 136 |
| POST | /:userId/update-batch | requireAuth, requireOwnership | 258 |
| POST | /update-batch-all | 🔧 INTERNAL | 391 |
| POST | /:userId/claim/:questId | requireAuth, requireOwnership | 562 |
| POST | /:userId/claim-bonus/:type | requireAuth, requireOwnership | 688 |
| POST | /auto-claim-all | requireAuth | 804 |
| POST | /claim-all/:userId | requireAuth, requireOwnership | 938 |

### raids.js (22 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| GET | / | ✅ PUBLIC | 10 |
| POST | /test-instance | requireAuth | 71 |
| GET | /upcoming | ❌ **NONE** | 147 |
| GET | /:raidId | ✅ PUBLIC | 188 |
| POST | /:raidId/signup | requireAuth | 214 |
| POST | /worldboss/signup | requireAuth | 256 |
| GET | /available/:userId | requireAuth, requireOwnership | 304 |
| POST | /:raidId/start | requireAuth | 390 |
| POST | /instance/:instanceId/progress | requireAuth | 602 |
| POST | /instance/:instanceId/resume | requireAuth | 739 |
| GET | /instance/:instanceId | ❌ **NONE** | 777 |
| GET | /instance/:instanceId/status | ❌ **NONE** | 801 |
| POST | /instance/:instanceId/complete | requireAuth | 819 |
| POST | /schedule | requireAuth | 1003 |
| POST | /queue/:raidId/join | requireAuth | 1050 |
| GET | /queue/:raidId | ❌ **NONE** | 1152 |
| POST | /queue/:raidId/leave | requireAuth | 1197 |
| GET | /:raidId/guild-signup/:guildId | ❌ **NONE** | 1682 |
| POST | /:raidId/guild-signup | requireAuth | 1714 |
| PUT | /:raidId/guild-signup/:guildId | requireAuth | 1809 |
| POST | /instance/:instanceId/command | requireAuth | 1884 |
| POST | /instance/:instanceId/chat | requireAuth | 1939 |

### reports.js (4 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| POST | / | requireAuth | 24 |
| GET | / | ❌ **NONE** | 88 |
| GET | /:reportId | ❌ **NONE** | 155 |
| PATCH | /:reportId | requireAuth | 195 |

### skills.js (6 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| GET | / | ❌ **NONE** | 12 |
| POST | /retroactive-points/:userId | requireAuth, requireOwnership | 24 |
| GET | /class/:className | ❌ **NONE** | 98 |
| GET | /:userId | requireAuth, requireOwnership | 110 |
| POST | /:userId/allocate | requireAuth, requireOwnership | 124 |
| POST | /:userId/reset | requireAdmin | 140 |

### streamSettings.js (5 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| POST | /:twitchId/test | 🔧 INTERNAL | 75 |
| GET | /:twitchId/overlay-key | requireAuth | 164 |
| POST | /:twitchId/overlay-key/regenerate | requireAuth | 206 |
| GET | /:twitchId | requireAuth | 240 |
| PUT | /:twitchId | requireAuth | 289 |

### webChat.js (12 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| POST | /send | requireAuth | 38 |
| GET | /history | ❌ **NONE** | 381 |
| DELETE | /message/:messageId | requireAuth | 601 |
| POST | /block | requireAuth | 651 |
| DELETE | /block | requireAuth | 697 |
| GET | /blocks/:userId | requireAuth, requireOwnership | 733 |
| POST | /report | requireAuth | 764 |
| GET | /reports | ❌ **NONE** | 809 |
| DELETE | /admin/message/:messageId | requireAdmin | 848 |
| POST | /admin/ban | requireAdmin | 897 |
| DELETE | /admin/ban/:bannedUserId | requireAdmin | 936 |
| GET | /ban-status/:userId | requireAuth, requireOwnership | 988 |

### worldboss.js (7 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| GET | /active | ❌ **NONE** | 10 |
| GET | /:bossId | ❌ **NONE** | 49 |
| POST | /:bossId/join | requireAuth | 65 |
| POST | /:bossId/damage | requireAuth | 121 |
| GET | /:bossId/leaderboard | ❌ **NONE** | 190 |
| POST | /:bossId/complete | requireAuth | 243 |
| POST | /create | requireAuth | 370 |

