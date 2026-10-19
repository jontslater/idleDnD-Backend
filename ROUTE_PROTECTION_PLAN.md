# Route Protection Implementation Plan

## Protection Strategy

### Auth Patterns:
1. **requireAuth + requireOwnership** - User mutating their own hero/resources
2. **requireAuth + requireGuildMembership** - Guild member operations  
3. **requireAuth + requireGuildOfficer** - Guild admin operations
4. **requireStreamerAccess** - Overlay/streamer-key protected
5. **requireAdmin** - Admin/test operations
6. **optionalAuth** - Public but can personalize with auth
7. **No auth (public)** - Truly public data with no secrets

### Files to Protect (Priority Order):

**HIGH PRIORITY** (Handles money, tokens, inventory):
- purchases.js - Stripe payments, token packs
- heroes.js - Inventory, gold, tokens, equipment
- auction.js - Gold/item trading
- mail.js - Item/gold transfers
- lootTokens.js - Token economy

**MEDIUM PRIORITY** (Game progress):
- guilds.js - Guild operations, bank
- professions.js - Crafting, elixirs
- quests.js - Quest progress
- raids.js - Raid rewards
- dungeon.js - Dungeon rewards
- parties.js - Party formation
- skills.js - Skill points

**LOW PRIORITY** (Mostly reads or internal):
- battlefields.js - Combat state (some routes internal)
- achievements.js - Achievement tracking
- enchanting.js - Enchanting
- worldboss.js - World boss state
- leaderboards.js - Public leaderboards
- reports.js - Reports
- webChat.js - Web chat

**ALREADY PROTECTED**:
- auth.js - Auth routes (already have verifyToken where needed)
- overlay.js - Protected with requireStreamerAccess
- chat.js - activity endpoint protected
- streamSettings.js - Protected with requireAuth
