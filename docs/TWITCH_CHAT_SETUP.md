# Twitch Chat Integration Setup

This document explains how to set up the Twitch chat listener for `!join` commands.

## Overview

The backend now listens to Twitch chat and processes `!join` commands. When a viewer types `!join [class]` in a streamer's chat, the backend will:
1. Create or assign a hero to that streamer's battlefield
2. Broadcast the update via WebSocket to all connected clients
3. The browser source will automatically update to show the new hero

## How It Works Now

**The system now uses streamers' own Twitch tokens when they log in!**

When a streamer logs into the website with Twitch OAuth:
1. Their Twitch access token is stored (encrypted) in Firebase
2. The backend automatically connects to their channel's chat
3. No separate bot account needed for streamers who log in

**Fallback:** If you want to monitor channels for streamers who haven't logged in yet, you can still use a bot account (see below).

## Environment Variables (Optional - Only for Bot Fallback)

If you want to monitor channels for streamers who haven't logged in, add these to your `.env` file:

```env
# Twitch Bot Credentials (OPTIONAL - only for fallback)
TWITCH_USERNAME=your_bot_username
TWITCH_OAUTH_TOKEN=oauth:your_oauth_token_here

# Channels to listen to (comma-separated, lowercase)
TWITCH_CHANNELS=tehchno,theneverendingwar

# Backend API URL (for internal API calls)
API_BASE_URL=http://localhost:3001
```

## Getting Twitch OAuth Token (For Bot Fallback Only)

1. Go to https://twitchapps.com/tmi/
2. Click "Connect" and authorize the app
3. Copy the OAuth token (it will look like `oauth:xxxxxxxxxxxxx`)
4. Add it to your `.env` file as `TWITCH_OAUTH_TOKEN`

**Note:** This is only needed if you want to monitor channels for streamers who haven't logged in yet. Streamers who log in will automatically have their chat monitored using their own tokens.

## How It Works

1. **Automatic Connection**: When a streamer logs into the website with Twitch OAuth:
   - Their Twitch access token is stored in Firebase (encrypted)
   - The backend automatically creates a chat listener for their channel
   - No manual configuration needed!

2. **Command Processing**: When someone types `!join [class]` in a streamer's chat:
   - The backend extracts the viewer's username and ID
   - Determines the streamer's channel (from which channel the message came)
   - Creates or assigns a hero to that streamer's battlefield (`twitch:streamerUsername`)

3. **WebSocket Broadcast**: After processing the join, the backend broadcasts an update to all WebSocket clients connected to that battlefield.

4. **Browser Source Update**: The browser source uses Firebase real-time listeners, so it automatically updates when heroes are added to the battlefield.

## Multiple Streamers

The system supports multiple streamers automatically:
- Each streamer who logs in gets their own chat listener
- Each listener only monitors their own channel
- No conflicts or shared bot account needed

## Testing

1. Start the backend server: `npm run dev`
2. Have tehchno log into the website with Twitch OAuth
3. Check the console for: `✅ Streamer tehchno connected to Twitch IRC at ...`
4. In tehchno's chat, type: `!join berserker`
5. Check the backend console for: `✅ username joined tehchno's battlefield`
6. Check the browser source - the hero should appear automatically

## Troubleshooting

### Bot not connecting
- Check that `TWITCH_USERNAME` and `TWITCH_OAUTH_TOKEN` are set correctly
- Verify the OAuth token is valid (starts with `oauth:`)
- Make sure the bot account has permission to read chat

### Commands not working
- Check that `TWITCH_CHANNELS` includes the channel name (lowercase, no `#`)
- Verify the bot is actually in the channel (check Twitch chat)
- Check backend console for error messages

### Heroes not appearing in browser source
- Verify the hero was created with the correct `currentBattlefieldId` (format: `twitch:streamerUsername`)
- Check Firebase console to see if the hero exists
- Verify the browser source URL includes the correct `streamerUsername` parameter
