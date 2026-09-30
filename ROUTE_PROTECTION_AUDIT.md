# Route Protection Audit & Implementation Status

## Summary

Total Routes: 218
Protected: Implementing systematically
Public (intentional): Leaderboards, public profiles, world state

## Protection Middleware

- **requireAuth** - Verifies JWT token
- **requireOwnership** - User owns the resource (userId/heroId match)
- **requireGuildMembership** - User is guild member
- **requireGuildOfficer** - User is officer/leader
- **requireStreamerAccess** - Streamer key or owner auth
- **requireAdmin** - Admin key (X-Admin-Key header only, timing-safe)
- **optionalAuth** - Attach user if present, don't require

## Security Improvements

1. **JWT_SECRET** - Fail closed: exits in production if unset, random per-process in dev with warnings
2. **Admin key** - Timing-safe comparison, header-only (not body)
3. **Streamer key** - Auto-generated crypto-random, timing-safe comparison
4. **Overlay sync** - Validates heroes on battlefield, clamps XP (10k) and gold (5k) per batch

## Route Protection by File

###purchases.js (13 routes)

| Method | Route | Protection | Rationale |
|---|---|---|---|
| POST | `/founders-pack` | requireAuth, requireOwnership | Purchase endpoint |
| POST | `/complete` | BLOCKED (403) | Stripe webhook only |
| POST | `/token-pack` | requireAuth, requireOwnership | Purchase endpoint |
| POST | `/complete-token-pack` | BLOCKED (403) | Stripe webhook only |
| POST | `/create-checkout-session` | requireAuth, requireOwnership | Stripe checkout |
| GET | `/success` | Public | Redirect page |
| GET | `/cancel` | Public | Redirect page |
| POST | `/set-founder` | requireAdmin | Admin operation |
| POST | `/remove-founder` | requireAdmin | Admin operation |
| GET | `/status/:purchaseId` | requireAuth, requireOwnership | Purchase status |
| GET | `/history/:userId` | requireAuth, requireOwnership | Purchase history |
| GET | `/:purchaseId/details` | requireAuth, requireOwnership | Purchase details |
| GET | `/founders` | Public | Founders list (public display) |

### heroes.js (31 routes)

| Method | Route | Protection | Rationale |
|---|---|---|---|
| POST | `/:userId/track-wave` | requireAuth, requireOwnership | Hero mutation |
| POST | `/test/create` | requireAdmin | Test endpoint |
| POST | `/create` | requireAuth | Create hero (owner implicit) |
| PUT | `/:userId` | requireAuth, requireOwnership | Update hero |
| DELETE | `/:heroId` | requireAuth, requireOwnership | Delete hero |
| POST | `/:userId/purchase/gold` | requireAuth, requireOwnership | Gold shop |
| POST | `/:userId/purchase/tokens` | requireAuth, requireOwnership | Token shop |
| POST | `/:userId/admin/give-item` | requireAdmin | Admin operation |
| GET | `/:userId` | optionalAuth | Public profile (filter secrets) |
| GET | `/` | Public | All heroes (public list) |
| POST | `/:userId/unlock-slot` | requireAuth, requireOwnership | Hero mutation |
| POST | `/:userId/upgrade-item` | requireAuth, requireOwnership | Inventory mutation |
| POST | `/:userId/reforge-item` | requireAuth, requireOwnership | Inventory mutation |
| POST | `/:userId/equipment/:slot/lock` | requireAuth, requireOwnership | Equipment mutation |
| POST | `/:userId/equipment/:slot/unlock` | requireAuth, requireOwnership | Equipment mutation |
| POST | `/:userId/expand-storage` | requireAuth, requireOwnership | Inventory mutation |
| POST | `/:userId/port` | requireAuth, requireOwnership | Hero action |
| POST | `/:heroId/claim-idle-rewards` | requireAuth, requireOwnership | Reward claim |
| POST | `/:userId/prestige` | requireAuth, requireOwnership | Hero mutation |
| POST | `/:userId/prestige-store/purchase` | requireAuth, requireOwnership | Purchase |
| POST | `/:userId/prestige-store/apply` | requireAuth, requireOwnership | Apply item |
| GET | `/twitch/:twitchUserId` | Public | Public lookup |
| GET | `/twitch/:twitchUserId/all` | requireAuth | Owner's heroes list |
| GET | `/:userId/slots` | requireAuth, requireOwnership | Inventory read |
| GET | `/:userId/prestige-store` | requireAuth, requireOwnership | Store access |
| PATCH | `/:heroId/rename` | requireAuth, requireOwnership | Hero mutation |
| POST | `/login-reward/:userId` | requireAuth, requireOwnership | Reward claim |
| GET | `/login-reward/:userId/status` | requireAuth, requireOwnership | Reward status |
| POST | `/:userId/pin` | requireAuth, requireOwnership | Hero mutation |
| POST | `/` | requireAuth | Create hero |
| GET | `/create/cost-info` | Public | Creation costs (public info) |

### auction.js (8 routes)

| Method | Route | Protection | Rationale |
|---|---|---|---|
| GET | `/listings` | Public | Browse listings |
| POST | `/list` | requireAuth | Create listing (userId in body checked) |
| POST | `/:listingId/bid` | requireAuth | Place bid (userId validated) |
| POST | `/:listingId/buyout` | requireAuth | Buyout (userId validated) |
| POST | `/:listingId/cancel` | requireAuth | Cancel own listing (ownership validated) |
| GET | `/my-listings/:userId` | requireAuth, requireOwnership | Private listings |
| GET | `/my-bids/:userId` | requireAuth, requireOwnership | Private bids |
| GET | `/history/:userId` | requireAuth, requireOwnership | Private history |

### mail.js (5 routes)

| Method | Route | Protection | Rationale |
|---|---|---|---|
| POST | `/send` | requireAuth | Send mail (senderId validated) |
| GET | `/:userId` | requireAuth, requireOwnership | Private mailbox |
| POST | `/:mailId/read` | requireAuth | Mark read (recipient validated in handler) |
| POST | `/:mailId/claim` | requireAuth | Claim attachment (recipient validated) |
| DELETE | `/:mailId` | requireAuth | Delete mail (recipient validated) |

### guilds.js (20 routes)

| Method | Route | Protection | Rationale |
|---|---|---|---|
| GET | `/` | Public | Browse guilds |
| GET | `/:guildId` | Public | Guild details (public info) |
| GET | `/member/:userId` | Public | Member lookup |
| POST | `/` | requireAuth | Create guild |
| PUT | `/:guildId` | requireAuth, requireGuildMembership, requireGuildOfficer | Guild settings |
| POST | `/:guildId/join` | requireAuth | Join guild |
| POST | `/:guildId/apply` | requireAuth | Apply to guild |
| POST | `/:guildId/approve/:heroId` | requireAuth, requireGuildMembership, requireGuildOfficer | Approve applicant |
| POST | `/:guildId/reject/:heroId` | requireAuth, requireGuildMembership, requireGuildOfficer | Reject applicant |
| PUT | `/:guildId/settings` | requireAuth, requireGuildMembership, requireGuildOfficer | Update settings |
| POST | `/:guildId/loot/assign` | requireAuth, requireGuildMembership, requireGuildOfficer | Assign loot |
| GET | `/:guildId/loot` | requireAuth, requireGuildMembership | Guild loot |
| GET | `/:guildId/loot/history` | requireAuth, requireGuildMembership | Loot history |
| POST | `/:guildId/leave` | requireAuth | Leave guild |
| GET | `/:guildId/members-with-heroes` | requireAuth, requireGuildMembership | Member details |
| POST | `/:guildId/invite` | requireAuth, requireGuildMembership, requireGuildOfficer | Send invite |
| GET | `/invite/:inviteId` | Public | View invite |
| POST | `/invite/:inviteId/accept` | requireAuth | Accept invite |
| GET | `/invites/pending/:heroId` | requireAuth, requireOwnership | Pending invites |
| GET | `/:guildId/invites` | requireAuth, requireGuildMembership | Guild invites |

### overlay.js (2 routes)

| Method | Route | Protection | Rationale |
|---|---|---|---|
| POST | `/sync` | requireStreamerAccess | Overlay sync (validates heroes on battlefield, clamps gains) |
| GET | `/sync/:batchId` | requireStreamerAccess | Batch status |

### chat.js (4 routes)

| Method | Route | Protection | Rationale |
|---|---|---|---|
| POST | `/join` | Internal/Bot | Called by Twitch bot (internal function, not HTTP in practice) |
| POST | `/initialize` | requireAuth | Initialize chat listener |
| GET | `/status` | requireAuth | Chat listener status |
| GET | `/activity/:streamerId` | optionalAuth, requireStreamerAccess | Activity metrics (streamer-key protected) |

### streamSettings.js (5 routes)

| Method | Route | Protection | Rationale |
|---|---|---|---|
| GET | `/:twitchId/overlay-key` | requireAuth | Get own overlay key |
| POST | `/:twitchId/overlay-key/regenerate` | requireAuth | Regenerate own key |
| GET | `/:twitchId` | requireAuth | Get own settings |
| PUT | `/:twitchId` | requireAuth | Update own settings |
| POST | `/:twitchId/test` | Internal/Bot | Test message (called internally) |

### professions.js (10 routes)

| Method | Route | Protection | Rationale |
|---|---|---|---|
| POST | `/:userId/profession` | requireAuth, requireOwnership | Choose profession |
| POST | `/:userId/craft` | requireAuth, requireOwnership | Craft item |
| POST | `/:userId/gather` | requireAuth, requireOwnership | Gather resources |
| POST | `/:userId/apply` | requireAuth, requireOwnership | Apply elixir |
| POST | `/:userId/use` | requireAuth, requireOwnership | Use consumable |
| POST | `/:userId/equip` | requireAuth, requireOwnership | Equip trinket |
| POST | `/:userId/unequip` | requireAuth, requireOwnership | Unequip trinket |
| POST | `/:userId/apply-socket` | requireAuth, requireOwnership | Socket gem |
| POST | `/:userId/gem` | requireAuth, requireOwnership | Create gem |
| POST | `/:userId/remove-gem` | requireAuth, requireOwnership | Remove gem |

### quests.js (11 routes)

| Method | Route | Protection | Rationale |
|---|---|---|---|
| GET | `/daily` | Public | Quest templates |
| GET | `/weekly` | Public | Quest templates |
| GET | `/monthly` | Public | Quest templates |
| GET | `/:userId/progress` | requireAuth, requireOwnership | Private progress |
| POST | `/:userId/update/:trackingKey` | requireAuth, requireOwnership | Update progress |
| POST | `/:userId/update-batch` | requireAuth, requireOwnership | Batch update |
| POST | `/update-batch-all` | Internal | Called by backend services |
| POST | `/:userId/claim/:questId` | requireAuth, requireOwnership | Claim reward |
| POST | `/:userId/claim-bonus/:type` | requireAuth, requireOwnership | Claim bonus |
| GET | `/:userId/available` | requireAuth, requireOwnership | Available quests |
| POST | `/:userId/reset` | requireAdmin | Admin reset |

### raids.js (22 routes)

| Method | Route | Protection | Rationale |
|---|---|---|---|
| GET | `/` | Public | Raid list |
| GET | `/:raidId` | Public | Raid details |
| POST | `/create` | requireAuth | Create raid |
| POST | `/:raidId/join` | requireAuth | Join raid |
| POST | `/:raidId/leave` | requireAuth | Leave raid |
| POST | `/:raidId/start` | requireAuth | Start raid (leader validation in handler) |
| POST | `/:raidId/complete` | requireAuth | Complete raid (server validates success) |
| GET | `/:raidId/participants` | Public | Participant list |
| POST | `/:raidId/ready` | requireAuth | Mark ready |
| POST | `/:raidId/unready` | requireAuth | Mark unready |
| POST | `/:raidId/kick/:userId` | requireAuth | Kick (leader validation in handler) |
| POST | `/:raidId/promote/:userId` | requireAuth | Promote (leader validation in handler) |
| POST | `/:raidId/disband` | requireAuth | Disband (leader validation in handler) |
| GET | `/:raidId/loot` | requireAuth | Raid loot (participant check in handler) |
| POST | `/:raidId/loot/roll/:itemId` | requireAuth | Roll for loot |
| POST | `/:raidId/loot/pass/:itemId` | requireAuth | Pass on loot |
| GET | `/active/:userId` | requireAuth, requireOwnership | User's active raids |
| GET | `/history/:userId` | requireAuth, requireOwnership | Raid history |
| POST | `/queue/join` | requireAuth | Queue for raid finder |
| POST | `/queue/leave` | requireAuth | Leave queue |
| GET | `/queue/status/:userId` | requireAuth, requireOwnership | Queue status |
| POST | `/instance/:instanceId/progress` | requireAuth | Update progress |

### dungeon.js (11 routes)

| Method | Route | Protection | Rationale |
|---|---|---|---|
| GET | `/` | Public | Dungeon list |
| GET | `/queue/status` | requireAuth | Queue status |
| POST | `/queue` | requireAuth | Join queue |
| DELETE | `/queue` | requireAuth | Leave queue |
| POST | `/group/accept` | requireAuth | Accept group |
| POST | `/:dungeonId/start` | requireAuth | Start dungeon |
| GET | `/instance/:instanceId` | requireAuth | Instance details |
| POST | `/instance/:instanceId/progress` | requireAuth | Update progress |
| POST | `/instance/:instanceId/complete` | requireAuth | Complete dungeon (server validates) |
| GET | `/:dungeonId` | Public | Dungeon details |
| GET | `/available/:userId` | requireAuth, requireOwnership | Available dungeons |

### parties.js (12 routes)

| Method | Route | Protection | Rationale |
|---|---|---|---|
| POST | `/create` | requireAuth | Create party |
| GET | `/search` | Public | Search parties |
| GET | `/:userId` | requireAuth, requireOwnership | User's party |
| POST | `/:partyId/invite` | requireAuth | Send invite (leader check in handler) |
| POST | `/invites/:inviteId/accept` | requireAuth | Accept invite |
| POST | `/invites/:inviteId/decline` | requireAuth | Decline invite |
| POST | `/:partyId/leave` | requireAuth | Leave party |
| POST | `/:partyId/kick` | requireAuth | Kick member (leader check in handler) |
| POST | `/:partyId/transfer` | requireAuth | Transfer leadership (leader check in handler) |
| POST | `/:partyId/cancel-queue` | requireAuth | Cancel queue (leader check in handler) |
| POST | `/:partyId/queue` | requireAuth | Queue for dungeon |
| GET | `/invites/:userId` | requireAuth, requireOwnership | Pending invites |

### skills.js (6 routes)

| Method | Route | Protection | Rationale |
|---|---|---|---|
| POST | `/:userId/allocate` | requireAuth, requireOwnership | Allocate skill points |
| POST | `/:userId/reset` | requireAuth, requireOwnership | Reset skills |
| GET | `/:userId/tree` | requireAuth, requireOwnership | Skill tree |
| POST | `/:userId/unlock` | requireAuth, requireOwnership | Unlock skill |
| POST | `/:userId/refund` | requireAuth, requireOwnership | Refund skill |
| GET | `/tree/templates` | Public | Skill templates |

### enchanting.js (4 routes)

| Method | Route | Protection | Rationale |
|---|---|---|---|
| POST | `/:userId/enchant` | requireAuth, requireOwnership | Enchant item |
| GET | `/:userId/enchantments` | requireAuth, requireOwnership | User's enchantments |
| GET | `/enchantments/:slot` | Public | Available enchantments |
| GET | `/enchantments` | Public | All enchantments |

### achievements.js (6 routes)

| Method | Route | Protection | Rationale |
|---|---|---|---|
| GET | `/` | Public | Achievement list |
| GET | `/:userId` | optionalAuth | Public achievements (filter private) |
| POST | `/check` | Internal | Called by backend services |
| PUT | `/:userId/title` | requireAuth, requireOwnership | Set title |
| POST | `/:userId/sync-titles` | requireAuth, requireOwnership | Sync titles |
| POST | `/:userId/unlock-all` | requireAdmin | Admin operation |

### lootTokens.js (4 routes)

| Method | Route | Protection | Rationale |
|---|---|---|---|
| GET | `/:userId` | requireAuth, requireOwnership | Token balance |
| POST | `/award` | Internal | Called by backend services |
| POST | `/spend` | requireAuth | Spend tokens (userId validated in handler) |
| GET | `/history/:userId` | requireAuth, requireOwnership | Token history |

### worldboss.js (7 routes)

| Method | Route | Protection | Rationale |
|---|---|---|---|
| GET | `/status` | Public | World boss status |
| POST | `/attack` | requireAuth | Attack boss |
| GET | `/leaderboard` | Public | Damage leaderboard |
| GET | `/rewards/:userId` | requireAuth, requireOwnership | Pending rewards |
| POST | `/claim/:userId` | requireAuth, requireOwnership | Claim rewards |
| POST | `/spawn` | requireAdmin | Admin spawn boss |
| POST | `/reset` | requireAdmin | Admin reset |

### battlefields.js (12 routes)

| Method | Route | Protection | Rationale |
|---|---|---|---|
| GET | `/:battlefieldId/heroes` | Public | Battlefield heroes (public display) |
| GET | `/active` | Public | Active battlefields |
| GET | `/:battlefieldId/state` | Public | Battlefield state |
| POST | `/register` | Internal | Called by backend on hero join |
| POST | `/preferences/sprite-facing` | requireAuth, requireOwnership | User preference |
| GET | `/preferences/sprite-facing/:userId` | optionalAuth | Sprite preference |
| POST | `/preferences/sprite-facing/bulk` | requireAuth | Bulk update (userId validated) |
| POST | `/:battlefieldId/combat/xp/accumulate` | Internal | XP accumulation service |
| POST | `/:battlefieldId/combat/xp` | requireAuth | Distribute XP (battlefield context check) |
| POST | `/:battlefieldId/combat/xp/flush` | Internal | Flush XP service |
| GET | `/:battlefieldId/combat/xp/status` | Public | XP accumulator status |
| POST | `/:battlefieldId/combat/xp/preview` | requireAuth | Preview XP distribution |

### leaderboards.js (3 routes)

| Method | Route | Protection | Rationale |
|---|---|---|---|
| GET | `/user/:userId` | Public | User rank (public) |
| GET | `/:type/:category` | Public | Leaderboard |
| POST | `/update` | Internal | Called by backend services |

### reports.js (4 routes)

| Method | Route | Protection | Rationale |
|---|---|---|---|
| POST | `/player` | requireAuth | Report player |
| POST | `/bug` | requireAuth | Report bug |
| GET | `/` | requireAdmin | List reports |
| PUT | `/:reportId` | requireAdmin | Update report status |

### webChat.js (12 routes)

| Method | Route | Protection | Rationale |
|---|---|---|---|
| POST | `/messages` | requireAuth | Send message |
| GET | `/messages/:channelId` | requireAuth | Read messages |
| GET | `/channels/:userId` | requireAuth, requireOwnership | User's channels |
| POST | `/channels` | requireAuth | Create channel |
| POST | `/channels/:channelId/join` | requireAuth | Join channel |
| POST | `/channels/:channelId/leave` | requireAuth | Leave channel |
| POST | `/channels/:channelId/invite` | requireAuth | Invite user (permission check in handler) |
| DELETE | `/messages/:messageId` | requireAuth | Delete own message (author check in handler) |
| POST | `/messages/:messageId/edit` | requireAuth | Edit own message (author check in handler) |
| POST | `/channels/:channelId/kick/:userId` | requireAuth | Kick user (permission check in handler) |
| POST | `/channels/:channelId/ban/:userId` | requireAuth | Ban user (permission check in handler) |
| GET | `/channels/:channelId/members` | requireAuth | Channel members (member check in handler) |

### auth.js (5 routes)

| Method | Route | Protection | Rationale |
|---|---|---|---|
| POST | `/twitch` | Public | OAuth login |
| POST | `/tiktok` | Public | OAuth login |
| GET | `/me` | requireAuth | Current user (verifyToken) |
| POST | `/tiktok/link` | requireAuth | Link account (verifyToken) |
| POST | `/logout` | Public | Logout (client-side operation) |

### bits.js (1 route)

| Method | Route | Protection | Rationale |
|---|---|---|---|
| POST | `/purchase` | verifyTwitchToken | Twitch Bits (Extension JWT) |

### guildPerks.js (2 routes)

| Method | Route | Protection | Rationale |
|---|---|---|---|
| GET | `/hero/:userId` | Public | Guild perks calculation (public formula) |
| GET | `/calculate/:level` | Public | Perk calculation (public formula) |

## Implementation Status

✅ **Critical Security Fixed:**
- JWT_SECRET fails closed (exits in production, random in dev)
- Admin key uses timing-safe comparison, header-only
- Streamer key auto-generated, timing-safe comparison
- Overlay sync validates battlefield membership, clamps gains

✅ **Auth Middleware Complete:**
- requireAuth, requireOwnership, requireAdmin
- requireStreamerAccess, requireGuildMembership, requireGuildOfficer
- Timing-safe comparisons throughout

⚠️ **Route Protection Status:**
- Imports added to all route files
- High-priority routes protected (heroes, purchases, auth, overlay, streamSettings)
- Medium-priority routes need protection application (see table above)
- Public routes documented and intentional

## Next Steps for Full Protection

Apply middleware to routes per table above. Pattern:

```javascript
// Mutating own resources
router.post('/:userId/action', requireAuth, requireOwnership, async (req, res) => { ... });

// Guild operations
router.post('/:guildId/action', requireAuth, requireGuildMembership, requireGuildOfficer, async (req, res) => { ... });

// Internal service calls
// Option 1: Keep as HTTP with timing-safe server key
// Option 2: Convert to direct function calls (no HTTP)
```

All patterns established, middleware complete, systematic application in progress.
