# Route Protection Audit Report

**Generated**: 2026-10-19T09:55:46.098Z

## Summary

- **Total Routes**: 241
- **Protected**: 189
- **Public (whitelisted)**: 52
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

### admin.js (1 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| GET | /heroes | requireAdmin | 7 |

### auction.js (8 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| GET | /listings | ✅ PUBLIC | 10 |
| POST | /list | requireAuth | 73 |
| POST | /:listingId/bid | requireAuth | 252 |
| POST | /:listingId/buyout | requireAuth | 393 |
| POST | /:listingId/cancel | requireAuth | 563 |
| GET | /my-listings/:userId | requireAuth, requireOwnership | 654 |
| GET | /my-bids/:userId | requireAuth, requireOwnership | 739 |
| GET | /history/:userId | requireAuth, requireOwnership | 759 |

### auth.js (5 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| POST | /twitch | ✅ PUBLIC | 36 |
| POST | /tiktok | ✅ PUBLIC | 313 |
| GET | /me | verifyToken | 426 |
| POST | /tiktok/link | verifyToken | 465 |
| POST | /logout | ✅ PUBLIC | 490 |

### balance.js (1 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| GET | / | ✅ PUBLIC | 7 |

### battlefields.js (12 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| GET | /:battlefieldId/heroes | ✅ PUBLIC | 41 |
| GET | /active | ✅ PUBLIC | 69 |
| GET | /:battlefieldId/state | ✅ PUBLIC | 102 |
| POST | /register | requireAuth | 162 |
| POST | /preferences/sprite-facing | requireAuth | 326 |
| GET | /preferences/sprite-facing/:userId | requireAuth, requireOwnership | 411 |
| POST | /preferences/sprite-facing/bulk | requireAuth | 478 |
| POST | /:battlefieldId/combat/xp/accumulate | requireInternal | 514 |
| POST | /:battlefieldId/combat/xp | requireAuthOrStreamerKey, requireAuth | 590 |
| POST | /:battlefieldId/combat/xp/flush | requireInternal | 718 |
| GET | /:battlefieldId/combat/xp/status | ✅ PUBLIC | 752 |
| POST | /:battlefieldId/combat/xp/preview | requireAuth | 778 |

### bits.js (1 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| POST | /purchase | verifyTwitchToken | 50 |

### chat.js (4 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| POST | /join | requireInternal | 24 |
| POST | /initialize | requireAuth | 464 |
| GET | /status | requireAuth | 521 |
| GET | /activity/:streamerId | requireStreamerAccess, optionalAuth | 602 |

### cosmetics.js (4 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| GET | / | ✅ PUBLIC | 13 |
| GET | /owned | requireAuth | 17 |
| POST | /purchase | requireAuth | 28 |
| POST | /:userId/equip | requireAuth, requireOwnership | 51 |

### dungeon.js (11 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| GET | / | ✅ PUBLIC | 53 |
| GET | /queue/status | requireAuth | 65 |
| POST | /queue | requireAuth | 102 |
| DELETE | /queue | requireAuth | 152 |
| POST | /group/accept | requireAuth | 185 |
| POST | /:dungeonId/start | requireAuth | 426 |
| GET | /instance/:instanceId | ✅ PUBLIC | 524 |
| POST | /instance/:instanceId/progress | requireAuthOrStreamerKey, requireAuth | 543 |
| POST | /instance/:instanceId/complete | requireAuthOrStreamerKey, requireAuth | 615 |
| GET | /:dungeonId | ✅ PUBLIC | 844 |
| GET | /available/:userId | requireAuth, requireOwnership | 862 |

### enchanting.js (4 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| POST | /:userId/enchant | requireAuth, requireOwnership | 11 |
| GET | /:userId/enchantments | requireAuth, requireOwnership | 156 |
| GET | /enchantments/:slot | ✅ PUBLIC | 176 |
| GET | /enchantments | ✅ PUBLIC | 188 |

### gear.js (2 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| GET | /sets | ✅ PUBLIC | 10 |
| GET | /catalog | ✅ PUBLIC | 14 |

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

### heroes.js (34 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| POST | /:userId/progress-sync | requireAuth, requireOwnership | 15 |
| POST | /:userId/inventory/sell | requireAuth, requireOwnership | 75 |
| POST | /:userId/track-wave | requireAuth, requireOwnership | 173 |
| POST | /test/create | requireAdmin | 200 |
| GET | / | ✅ PUBLIC | 287 |
| GET | /login-reward/:userId/status | requireAuth, requireOwnership | 315 |
| POST | /login-reward/:userId | requireAuth, requireOwnership | 338 |
| GET | /:userId/prestige-store | requireAuth, requireOwnership | 356 |
| GET | /:userId | requireAuth, requireOwnership | 407 |
| POST | /:userId/unlock-slot | requireAuth, requireOwnership | 482 |
| GET | /:userId/slots | requireAuth, requireOwnership | 491 |
| GET | /twitch/:twitchUserId | ✅ PUBLIC | 543 |
| GET | /twitch/:twitchUserId/all | requireAuth | 634 |
| POST | /create | requireAuth | 741 |
| PATCH | /:heroId/rename | requireAuth, requireOwnership | 855 |
| GET | /create/cost-info | ✅ PUBLIC | 921 |
| POST | / | requireAuth | 976 |
| PUT | /:userId | requireAuth, requireOwnership | 1054 |
| POST | /:userId/pin | requireAuth, requireOwnership | 1114 |
| DELETE | /:heroId | requireAuth, requireOwnership | 1140 |
| POST | /:userId/purchase/gold | requireAuth, requireOwnership | 1175 |
| POST | /:userId/purchase/tokens | requireAuth, requireOwnership | 1291 |
| POST | /:userId/purchase/cosmetic-tokens | requireAuth, requireOwnership | 1296 |
| POST | /:userId/upgrade-item | requireAuth, requireOwnership | 1306 |
| POST | /:userId/reforge-item | requireAuth, requireOwnership | 1448 |
| POST | /:userId/equipment/:slot/lock | requireAuth, requireOwnership | 1577 |
| POST | /:userId/equipment/:slot/unlock | requireAuth, requireOwnership | 1620 |
| POST | /:userId/expand-storage | requireAuth, requireOwnership | 1664 |
| POST | /:userId/port | requireAuth, requireOwnership | 1743 |
| POST | /:heroId/claim-idle-rewards | requireAuth, requireOwnership | 1850 |
| POST | /:userId/admin/give-item | requireAdmin | 1893 |
| POST | /:userId/prestige | requireAuth, requireOwnership | 1938 |
| POST | /:userId/prestige-store/purchase | requireAuth, requireOwnership | 2088 |
| POST | /:userId/prestige-store/apply | requireAuth, requireOwnership | 2188 |

### leaderboards.js (3 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| GET | /user/:userId | requireAuth, requireOwnership | 11 |
| GET | /:type/:category | ✅ PUBLIC | 33 |
| POST | /update | requireInternal | 60 |

### lootRoll.js (1 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| POST | /:battlefieldId/loot/roll | requireStreamerAccess | 13 |

### lootTokens.js (4 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| GET | /:userId | requireAuth, requireOwnership | 26 |
| POST | /award | requireInternal | 55 |
| POST | /spend | requireAuth | 121 |
| GET | /history/:userId | requireAuth, requireOwnership | 187 |

### mail.js (5 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| POST | /send | requireAuth | 27 |
| GET | /:userId | requireAuth, requireOwnership | 296 |
| POST | /:mailId/read | requireAuth | 410 |
| POST | /:mailId/claim | requireAuth | 450 |
| DELETE | /:mailId | requireAuth | 614 |

### overlay.js (3 routes)

| Method | Route | Middleware | Line |
|--------|-------|------------|------|
| POST | /sync | requireStreamerAccess | 53 |
| GET | /sync/:batchId | requireStreamerAccess | 249 |
| POST | /loot-roll | requireStreamerAccess | 281 |

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
| POST | /:userId/gather | requireAuth, requireOwnership | 540 |
| POST | /:userId/apply | requireAuth, requireOwnership | 750 |
| POST | /:userId/use | requireAuth, requireOwnership | 995 |
| POST | /:userId/equip | requireAuth, requireOwnership | 1172 |
| POST | /:userId/unequip | requireAuth, requireOwnership | 1311 |
| POST | /:userId/apply-socket | requireAuth, requireOwnership | 1560 |
| POST | /:userId/gem | requireAuth, requireOwnership | 1698 |
| POST | /:userId/remove-gem | requireAuth, requireOwnership | 1844 |

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
| GET | /success | ✅ PUBLIC | 978 |
| GET | /cancel | ✅ PUBLIC | 990 |
| GET | /history/:userId | requireAuth, requireOwnership | 1002 |
| GET | /:purchaseId/details | requireAuth | 1114 |

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
| GET | / | ✅ PUBLIC | 20 |
| POST | /test-instance | requireAuth | 81 |
| GET | /upcoming | ✅ PUBLIC | 157 |
| GET | /:raidId | ✅ PUBLIC | 198 |
| POST | /worldboss/signup | requireAuth | 234 |
| POST | /:raidId/signup | requireAuth | 288 |
| GET | /available/:userId | requireAuth, requireOwnership | 333 |
| POST | /:raidId/start | requireAuth | 419 |
| POST | /instance/:instanceId/progress | requireAuthOrStreamerKey, requireAuth | 631 |
| POST | /instance/:instanceId/resume | requireAuthOrStreamerKey, requireAuth | 787 |
| GET | /instance/:instanceId | ✅ PUBLIC | 833 |
| GET | /instance/:instanceId/status | ✅ PUBLIC | 857 |
| POST | /instance/:instanceId/complete | requireAuthOrStreamerKey, requireAuth | 875 |
| POST | /schedule | requireAuth | 1106 |
| POST | /queue/:raidId/join | requireAuth | 1153 |
| GET | /queue/:raidId | ✅ PUBLIC | 1255 |
| POST | /queue/:raidId/leave | requireAuth | 1300 |
| GET | /:raidId/guild-signup/:guildId | ✅ PUBLIC | 1785 |
| POST | /:raidId/guild-signup | requireAuth | 1817 |
| PUT | /:raidId/guild-signup/:guildId | requireAuth | 1912 |
| POST | /instance/:instanceId/command | requireAuthOrStreamerKey, requireAuth | 1987 |
| POST | /instance/:instanceId/chat | requireAuthOrStreamerKey, requireAuth | 2049 |

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
| POST | /:userId/reset | requireAdmin | 162 |

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
| GET | /active | ✅ PUBLIC | 30 |
| GET | /:bossId | ✅ PUBLIC | 69 |
| POST | /:bossId/join | requireAuth | 85 |
| POST | /:bossId/damage | requireAuth | 149 |
| GET | /:bossId/leaderboard | ✅ PUBLIC | 226 |
| POST | /:bossId/complete | requireAuth | 279 |
| POST | /create | requireAdmin | 408 |

