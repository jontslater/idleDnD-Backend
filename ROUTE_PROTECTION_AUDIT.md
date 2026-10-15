# Route Protection Audit Report

**Generated**: 2026-10-15T16:16:26.093Z

## Summary

- **Total Routes**: 226
- **Protected**: 179
- **Public (whitelisted)**: 47
- **Unprotected**: 0 ✅

## ✅ NO VIOLATIONS

All routes are properly protected!

## Detailed Route Protection by File

### achievements.js (6 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| GET | / | ✅ PUBLIC | 13 |
| GET | /:userId | requireAuth, requireOwnership | 30 |
| POST | /check | requireInternal | 45 |
| PUT | /:userId/title | requireAuth, requireOwnership | 67 |
| POST | /:userId/sync-titles | requireAuth, requireOwnership | 86 |
| POST | /:userId/unlock-all | requireAdmin | 113 |

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
| POST | /tiktok | ✅ PUBLIC | 311 |
| GET | /me | verifyToken | 424 |
| POST | /tiktok/link | verifyToken | 463 |
| POST | /logout | ✅ PUBLIC | 488 |

### battlefields.js (12 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| GET | /:battlefieldId/heroes | ✅ PUBLIC | 12 |
| GET | /active | ✅ PUBLIC | 40 |
| GET | /:battlefieldId/state | ✅ PUBLIC | 73 |
| POST | /register | requireAuth | 133 |
| POST | /preferences/sprite-facing | requireAuth | 304 |
| GET | /preferences/sprite-facing/:userId | requireAuth, requireOwnership | 389 |
| POST | /preferences/sprite-facing/bulk | requireAuth | 456 |
| POST | /:battlefieldId/combat/xp/accumulate | requireInternal | 492 |
| POST | /:battlefieldId/combat/xp | requireAuth | 568 |
| POST | /:battlefieldId/combat/xp/flush | requireInternal | 645 |
| GET | /:battlefieldId/combat/xp/status | ✅ PUBLIC | 679 |
| POST | /:battlefieldId/combat/xp/preview | requireAuth | 705 |

### bits.js (1 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| POST | /purchase | verifyTwitchToken | 41 |

### chat.js (4 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| POST | /join | requireInternal | 24 |
| POST | /initialize | requireAuth | 464 |
| GET | /status | requireAuth | 521 |
| GET | /activity/:streamerId | requireStreamerAccess, optionalAuth | 602 |

### dungeon.js (11 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| GET | / | ✅ PUBLIC | 51 |
| GET | /queue/status | requireAuth | 63 |
| POST | /queue | requireAuth | 100 |
| DELETE | /queue | requireAuth | 150 |
| POST | /group/accept | requireAuth | 183 |
| POST | /:dungeonId/start | requireAuth | 424 |
| GET | /instance/:instanceId | ✅ PUBLIC | 522 |
| POST | /instance/:instanceId/progress | requireAuthOrStreamerKey, requireAuth | 541 |
| POST | /instance/:instanceId/complete | requireAuthOrStreamerKey, requireAuth | 608 |
| GET | /:dungeonId | ✅ PUBLIC | 830 |
| GET | /available/:userId | requireAuth, requireOwnership | 848 |

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
| GET | /member/:userId | requireAuth, requireOwnership | 41 |
| POST | / | requireAuth | 89 |
| PUT | /:guildId | requireAuth | 115 |
| POST | /:guildId/join | requireAuth | 141 |
| POST | /:guildId/apply | requireAuth | 210 |
| POST | /:guildId/approve/:heroId | requireAuth, requireOwnership | 259 |
| POST | /:guildId/reject/:heroId | requireAuth, requireOwnership | 313 |
| PUT | /:guildId/settings | requireAuth | 349 |
| POST | /:guildId/loot/assign | requireAuth | 387 |
| GET | /:guildId/loot | requireAuth, requireGuildMembership | 463 |
| GET | /:guildId/loot/history | requireAuth, requireGuildMembership | 483 |
| POST | /:guildId/leave | requireAuth | 504 |
| GET | /:guildId/members-with-heroes | requireAuth, requireGuildMembership | 526 |
| POST | /:guildId/invite | requireAuth | 662 |
| GET | /invite/:inviteId | ✅ PUBLIC | 746 |
| POST | /invite/:inviteId/accept | requireAuth | 775 |
| GET | /invites/pending/:heroId | requireAuth, requireOwnership | 857 |
| GET | /:guildId/invites | requireAuth, requireGuildMembership | 889 |

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
| GET | /twitch/:twitchUserId/all | requireAuth | 547 |
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
| GET | /user/:userId | requireAuth, requireOwnership | 11 |
| GET | /:type/:category | ✅ PUBLIC | 33 |
| POST | /update | requireInternal | 60 |

### lootTokens.js (4 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| GET | /:userId | requireAuth, requireOwnership | 26 |
| POST | /award | requireAuth | 55 |
| POST | /spend | requireAuth | 116 |
| GET | /history/:userId | requireAuth, requireOwnership | 177 |

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
| GET | /sync/:batchId | requireStreamerAccess | 203 |

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
| POST | /:userId/gather | requireAuth, requireOwnership | 537 |
| POST | /:userId/apply | requireAuth, requireOwnership | 747 |
| POST | /:userId/use | requireAuth, requireOwnership | 992 |
| POST | /:userId/equip | requireAuth, requireOwnership | 1169 |
| POST | /:userId/unequip | requireAuth, requireOwnership | 1298 |
| POST | /:userId/apply-socket | requireAuth, requireOwnership | 1547 |
| POST | /:userId/gem | requireAuth, requireOwnership | 1685 |
| POST | /:userId/remove-gem | requireAuth, requireOwnership | 1831 |

### purchases.js (13 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| POST | /founders-pack | requireAuth | 40 |
| POST | /complete | ✅ PUBLIC | 107 |
| GET | /status/:purchaseId | requireAuth | 119 |
| GET | /founders | ✅ PUBLIC | 149 |
| POST | /set-founder | requireAdmin | 482 |
| POST | /remove-founder | requireAdmin | 657 |
| POST | /token-pack | requireAuth | 740 |
| POST | /complete-token-pack | ✅ PUBLIC | 806 |
| POST | /create-checkout-session | requireAuth | 896 |
| GET | /success | ✅ PUBLIC | 998 |
| GET | /cancel | ✅ PUBLIC | 1010 |
| GET | /history/:userId | requireAuth, requireOwnership | 1022 |
| GET | /:purchaseId/details | requireAuth | 1134 |

### quests.js (11 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| GET | /daily | ✅ PUBLIC | 12 |
| GET | /weekly | ✅ PUBLIC | 32 |
| GET | /monthly | ✅ PUBLIC | 52 |
| GET | /:userId/progress | requireAuth, requireOwnership | 72 |
| POST | /:userId/update/:trackingKey | requireAuth, requireOwnership | 137 |
| POST | /:userId/update-batch | requireAuth, requireOwnership | 259 |
| POST | /update-batch-all | requireAuthOrStreamerKey, requireAuth | 393 |
| POST | /:userId/claim/:questId | requireAuth, requireOwnership | 577 |
| POST | /:userId/claim-bonus/:type | requireAuth, requireOwnership | 703 |
| POST | /auto-claim-all | requireAuth | 819 |
| POST | /claim-all/:userId | requireAuth, requireOwnership | 953 |

### queues.js (6 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| GET | /keys/dungeons | ✅ PUBLIC | 26 |
| GET | /keys/raids | ✅ PUBLIC | 30 |
| GET | /:twitchId | ✅ PUBLIC | 37 |
| POST | / | requireAuthOrStreamerKey, requireAuth | 55 |
| POST | /:queueId/join | requireAuth | 102 |
| POST | /:queueId/leave | requireAuth | 157 |

### raids.js (22 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| GET | / | ✅ PUBLIC | 18 |
| POST | /test-instance | requireAuth | 79 |
| GET | /upcoming | ✅ PUBLIC | 155 |
| GET | /:raidId | ✅ PUBLIC | 196 |
| POST | /worldboss/signup | requireAuth | 222 |
| POST | /:raidId/signup | requireAuth | 266 |
| GET | /available/:userId | requireAuth, requireOwnership | 311 |
| POST | /:raidId/start | requireAuth | 397 |
| POST | /instance/:instanceId/progress | requireAuthOrStreamerKey, requireAuth | 609 |
| POST | /instance/:instanceId/resume | requireAuthOrStreamerKey, requireAuth | 754 |
| GET | /instance/:instanceId | ✅ PUBLIC | 800 |
| GET | /instance/:instanceId/status | ✅ PUBLIC | 824 |
| POST | /instance/:instanceId/complete | requireAuthOrStreamerKey, requireAuth | 842 |
| POST | /schedule | requireAuth | 1059 |
| POST | /queue/:raidId/join | requireAuth | 1106 |
| GET | /queue/:raidId | ✅ PUBLIC | 1208 |
| POST | /queue/:raidId/leave | requireAuth | 1253 |
| GET | /:raidId/guild-signup/:guildId | ✅ PUBLIC | 1738 |
| POST | /:raidId/guild-signup | requireAuth | 1770 |
| PUT | /:raidId/guild-signup/:guildId | requireAuth | 1865 |
| POST | /instance/:instanceId/command | requireAuthOrStreamerKey, requireAuth | 1940 |
| POST | /instance/:instanceId/chat | requireAuthOrStreamerKey, requireAuth | 2002 |

### reports.js (4 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| POST | / | requireAuth | 24 |
| GET | / | requireAdmin | 88 |
| GET | /:reportId | requireAdmin | 155 |
| PATCH | /:reportId | requireAuth | 195 |

### skills.js (6 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| GET | / | ✅ PUBLIC | 12 |
| POST | /retroactive-points/:userId | requireAuth, requireOwnership | 24 |
| GET | /class/:className | ✅ PUBLIC | 98 |
| GET | /:userId | requireAuth, requireOwnership | 110 |
| POST | /:userId/allocate | requireAuth, requireOwnership | 124 |
| POST | /:userId/reset | requireAdmin | 140 |

### streamSettings.js (5 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| POST | /:twitchId/test | requireAuth | 76 |
| GET | /:twitchId/overlay-key | requireAuth | 165 |
| POST | /:twitchId/overlay-key/regenerate | requireAuth | 207 |
| GET | /:twitchId | requireAuth | 241 |
| PUT | /:twitchId | requireAuth | 290 |

### webChat.js (12 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| POST | /send | requireAuth | 38 |
| GET | /history | requireAuth | 381 |
| DELETE | /message/:messageId | requireAuth | 601 |
| POST | /block | requireAuth | 651 |
| DELETE | /block | requireAuth | 697 |
| GET | /blocks/:userId | requireAuth, requireOwnership | 733 |
| POST | /report | requireAuth | 764 |
| GET | /reports | requireAuth | 809 |
| DELETE | /admin/message/:messageId | requireAdmin | 848 |
| POST | /admin/ban | requireAdmin | 897 |
| DELETE | /admin/ban/:bannedUserId | requireAdmin | 936 |
| GET | /ban-status/:userId | requireAuth, requireOwnership | 988 |

### worldboss.js (7 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| GET | /active | ✅ PUBLIC | 10 |
| GET | /:bossId | ✅ PUBLIC | 49 |
| POST | /:bossId/join | requireAuth | 65 |
| POST | /:bossId/damage | requireAuth | 121 |
| GET | /:bossId/leaderboard | ✅ PUBLIC | 190 |
| POST | /:bossId/complete | requireAuth | 243 |
| POST | /create | requireAuth | 370 |

