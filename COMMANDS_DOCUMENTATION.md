# Commands Documentation

## Commands Available via Twitch Chat

### General Commands (No Hero Required)
- `!join [class]` or `!join [number]` - Join the battlefield with a new hero or existing hero
- `!classes` - List all available classes
- `!help` or `!commands` - Show available commands
- `!heroes` - List all your characters

### Combat Commands (Requires Hero in Battlefield)
- `!attack` or `!a` - Attack the current enemy
- `!heal` or `!h` - Heal yourself or a party member (healers only)
- `!cast [spell]` - Cast a spell
- `!defend` - Enter defensive stance
- `!dispel` - Remove debuffs

### Information Commands (Requires Hero in Battlefield)
- `!stats` or `!s` - Show your character stats
- `!gear` or `!g` - Show your equipment
- `!skills` - Show your skills
- `!quest` or `!quests` - Show quest information
- `!leaderboard` or `!rank` - Show leaderboard

### Shop & Economy Commands (Requires Hero in Battlefield)
- `!shop` - Open the shop
- `!buy [item]` - Buy an item from the shop
- `!use [item]` - Use an item
- `!claim` - Claim rewards
- `!tokens` - Check your token balance

### Utility Commands (Requires Hero in Battlefield)
- `!leave` - Leave the battlefield
- `!rejoin` or `!rejoin [number]` - Rejoin the battlefield
- `!switch [class]` - Switch to a different class
- `!auto` - Toggle auto-combat
- `!rest` - Rest to restore HP/mana

### Profession Commands (Requires Hero in Battlefield)
- `!profession` - Show profession information
- `!gather` or `!herbs` - Gather herbs
- `!recipes` - Show crafting recipes
- `!craft [item]` - Craft an item
- `!elixirs` - Show elixir recipes

### Admin Commands (Streamer Only)
- `!level [amount]` - Grant levels
- `!grantlegendary` or `!grantlegendaries` - Grant legendary items
- `!push` or `!pushfirebase` - Push data to Firebase
- `!sync` or `!syncfirebase` - Sync data with Firebase

## Commands Available via Twitch Extension
- Extension purchases are handled via `handleExtensionPurchase` in `twitch-events.js`
- Extension commands route through the same command handler as chat commands

## API Endpoints for Dungeons
- `POST /api/dungeons/queue` - Join dungeon queue
- `GET /api/dungeons/queue/status?userId=...` - Get queue status
- `POST /api/dungeons/:dungeonId/start` - Start a dungeon instance
- `GET /api/dungeons/instance/:instanceId` - Get dungeon instance
- `POST /api/dungeons/instance/:instanceId/progress` - Update dungeon progress
- `POST /api/dungeons/instance/:instanceId/complete` - Complete dungeon
- `GET /api/dungeons/available/:userId` - Get available dungeons

## API Endpoints for Raids
- `POST /api/raids/:raidId/signup` - Sign up for a raid
- `POST /api/raids/queue/:raidId/join` - Join raid queue
- `POST /api/raids/queue/:raidId/leave` - Leave raid queue
- `GET /api/raids/queue/:raidId` - Get raid queue status
- `POST /api/raids/:raidId/start` - Start a raid instance
- `GET /api/raids/instance/:instanceId` - Get raid instance
- `POST /api/raids/instance/:instanceId/progress` - Update raid progress
- `POST /api/raids/instance/:instanceId/complete` - Complete raid
- `GET /api/raids/available/:userId` - Get available raids
- `POST /api/raids/instance/:instanceId/command` - Send command in raid
- `POST /api/raids/instance/:instanceId/chat` - Send chat message in raid



