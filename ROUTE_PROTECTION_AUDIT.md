# Route Protection Audit Report

**Generated**: 2026-10-19T08:33:55.467Z

## Summary

- **Total Routes**: 230
- **Protected**: 181
- **Public (whitelisted)**: 49
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
| POST | /:listingId/bid | requireAuth | 265 |
| POST | /:listingId/buyout | requireAuth | 401 |
| POST | /:listingId/cancel | requireAuth | 566 |
| GET | /my-listings/:userId | requireAuth, requireOwnership | 652 |
| GET | /my-bids/:userId | requireAuth, requireOwnership | 737 |
| GET | /history/:userId | requireAuth, requireOwnership | 757 |

### auth.js (5 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| POST | /twitch | ✅ PUBLIC | 36 |
| POST | /tiktok | ✅ PUBLIC | 311 |
| GET | /me | verifyToken | 424 |
| POST | /tiktok/link | verifyToken | 463 |
| POST | /logout | ✅ PUBLIC | 488 |

### balance.js (1 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| GET | / | ✅ PUBLIC | 7 |

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
| POST | /instance/:instanceId/complete | requireAuthOrStreamerKey, requireAuth | 610 |
| GET | /:dungeonId | ✅ PUBLIC | 833 |
| GET | /available/:userId | requireAuth, requireOwnership | 851 |

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
| PUT | /:guildId | requireAuth | 128 |
| POST | /:guildId/join | requireAuth | 179 |
| POST | /:guildId/apply | requireAuth | 248 |
| POST | /:guildId/approve/:heroId | requireAuth, requireOwnership | 297 |
| POST | /:guildId/reject/:heroId | requireAuth, requireOwnership | 351 |
| PUT | /:guildId/settings | requireAuth | 387 |
| POST | /:guildId/loot/assign | requireAuth | 425 |
| GET | /:guildId/loot | requireAuth, requireGuildMembership | 501 |
| GET | /:guildId/loot/history | requireAuth, requireGuildMembership | 521 |
| POST | /:guildId/leave | requireAuth | 542 |
| GET | /:guildId/members-with-heroes | requireAuth, requireGuildMembership | 564 |
| POST | /:guildId/invite | requireAuth | 700 |
| GET | /invite/:inviteId | ✅ PUBLIC | 784 |
| POST | /invite/:inviteId/accept | requireAuth | 813 |
| GET | /invites/pending/:heroId | requireAuth, requireOwnership | 895 |
| GET | /:guildId/invites | requireAuth, requireGuildMembership | 927 |

### heroes.js (32 routes)

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
| GET | /:userId/slots | requireAuth, requireOwnership | 322 |
| GET | /twitch/:twitchUserId | ✅ PUBLIC | 374 |
| GET | /twitch/:twitchUserId/all | requireAuth | 465 |
| POST | /create | requireAuth | 572 |
| PATCH | /:heroId/rename | requireAuth, requireOwnership | 686 |
| GET | /create/cost-info | ✅ PUBLIC | 752 |
| POST | / | requireAuth | 807 |
| PUT | /:userId | requireAuth, requireOwnership | 854 |
| POST | /:userId/pin | requireAuth, requireOwnership | 914 |
| DELETE | /:heroId | requireAuth, requireOwnership | 940 |
| POST | /:userId/purchase/gold | requireAuth, requireOwnership | 975 |
| POST | /:userId/purchase/tokens | requireAuth, requireOwnership | 1091 |
| POST | /:userId/purchase/cosmetic-tokens | requireAuth, requireOwnership | 1096 |
| POST | /:userId/upgrade-item | requireAuth, requireOwnership | 1140 |
| POST | /:userId/reforge-item | requireAuth, requireOwnership | 1282 |
| POST | /:userId/equipment/:slot/lock | requireAuth, requireOwnership | 1411 |
| POST | /:userId/equipment/:slot/unlock | requireAuth, requireOwnership | 1454 |
| POST | /:userId/expand-storage | requireAuth, requireOwnership | 1498 |
| POST | /:userId/port | requireAuth, requireOwnership | 1577 |
| POST | /:heroId/claim-idle-rewards | requireAuth, requireOwnership | 1684 |
| POST | /:userId/admin/give-item | requireAdmin | 1727 |
| POST | /:userId/prestige | requireAuth, requireOwnership | 1772 |
| POST | /:userId/prestige-store/purchase | requireAuth, requireOwnership | 1922 |
| POST | /:userId/prestige-store/apply | requireAuth, requireOwnership | 2022 |

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
| POST | /sync | requireStreamerAccess | 35 |
| GET | /sync/:batchId | requireStreamerAccess | 198 |

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
| POST | /founders-pack | requireAuth | 34 |
| POST | /complete | ✅ PUBLIC | 101 |
| GET | /status/:purchaseId | requireAuth | 113 |
| GET | /founders | ✅ PUBLIC | 143 |
| POST | /set-founder | requireAdmin | 476 |
| POST | /remove-founder | requireAdmin | 632 |
| POST | /token-pack | requireAuth | 715 |
| POST | /complete-token-pack | ✅ PUBLIC | 780 |
| POST | /create-checkout-session | requireAuth | 870 |
| GET | /success | ✅ PUBLIC | 972 |
| GET | /cancel | ✅ PUBLIC | 984 |
| GET | /history/:userId | requireAuth, requireOwnership | 996 |
| GET | /:purchaseId/details | requireAuth | 1108 |

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
| GET | /keys/dungeons | ✅ PUBLIC | 30 |
| GET | /keys/raids | ✅ PUBLIC | 34 |
| GET | /:twitchId | ✅ PUBLIC | 41 |
| POST | / | requireAuthOrStreamerKey, requireAuth | 55 |
| POST | /:queueId/join | requireAuth | 106 |
| POST | /:queueId/leave | requireAuth | 162 |

### raids.js (22 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| GET | / | ✅ PUBLIC | 18 |
| POST | /test-instance | requireAuth | 79 |
| GET | /upcoming | ✅ PUBLIC | 155 |
| GET | /:raidId | ✅ PUBLIC | 196 |
| POST | /worldboss/signup | requireAuth | 232 |
| POST | /:raidId/signup | requireAuth | 276 |
| GET | /available/:userId | requireAuth, requireOwnership | 321 |
| POST | /:raidId/start | requireAuth | 407 |
| POST | /instance/:instanceId/progress | requireAuthOrStreamerKey, requireAuth | 619 |
| POST | /instance/:instanceId/resume | requireAuthOrStreamerKey, requireAuth | 764 |
| GET | /instance/:instanceId | ✅ PUBLIC | 810 |
| GET | /instance/:instanceId/status | ✅ PUBLIC | 834 |
| POST | /instance/:instanceId/complete | requireAuthOrStreamerKey, requireAuth | 852 |
| POST | /schedule | requireAuth | 1073 |
| POST | /queue/:raidId/join | requireAuth | 1120 |
| GET | /queue/:raidId | ✅ PUBLIC | 1222 |
| POST | /queue/:raidId/leave | requireAuth | 1267 |
| GET | /:raidId/guild-signup/:guildId | ✅ PUBLIC | 1752 |
| POST | /:raidId/guild-signup | requireAuth | 1784 |
| PUT | /:raidId/guild-signup/:guildId | requireAuth | 1879 |
| POST | /instance/:instanceId/command | requireAuthOrStreamerKey, requireAuth | 1954 |
| POST | /instance/:instanceId/chat | requireAuthOrStreamerKey, requireAuth | 2016 |

### reports.js (4 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| POST | / | requireAuth | 24 |
| GET | / | requireAdmin | 88 |
| GET | /:reportId | requireAdmin | 155 |
| PATCH | /:reportId | requireAuth | 195 |

### skills.js (8 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| GET | /definitions | ✅ PUBLIC | 23 |
| GET | / | ✅ PUBLIC | 38 |
| POST | /retroactive-points/:userId | requireAuth, requireOwnership | 49 |
| GET | /class/:className | ✅ PUBLIC | 113 |
| GET | /:userId | requireAuth, requireOwnership | 124 |
| POST | /:userId/allocate | requireAuth, requireOwnership | 137 |
| POST | /:userId/respec | requireAuth, requireOwnership | 152 |
| POST | /:userId/reset | requireAdmin | 163 |

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

