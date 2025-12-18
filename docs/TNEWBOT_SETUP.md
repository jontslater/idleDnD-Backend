# TNEWBOT Setup Guide

This guide explains how to set up TNEWBOT so that command responses appear from the bot account instead of the streamer's account.

## Overview

When viewers use commands like `!join`, `!stats`, `!attack`, etc., the responses currently appear as if they're coming from the streamer. By setting up TNEWBOT, all command responses will appear from the bot account instead, making it clear that these are automated game responses.

## Prerequisites

- A Twitch account to use as the bot (can be a new account or existing)
- Access to your backend `.env` file
- Ability to restart your backend server

## Step-by-Step Setup

### Step 1: Create a Twitch Bot Account (If Needed)

If you don't already have a bot account:

1. Go to https://www.twitch.tv/signup
2. Create a new account (e.g., "TNEWBOT" or "IdleDnDBot")
3. Complete the signup process
4. **Important:** This will be a separate account from your personal/streamer account

**Note:** You can use an existing account, but it's recommended to use a dedicated bot account for clarity.

### Step 2: Get the OAuth Token

1. Go to https://twitchapps.com/tmi/
2. Click the **"Connect"** or **"Authorize"** button
3. Log in with your **bot account** (not your personal account)
4. Authorize the application when prompted
5. After authorization, you'll see your OAuth token displayed
6. Copy the entire token - it will look like: `oauth:xxxxxxxxxxxxxxxxxxxxxxxxxxxxxx`
   - **Important:** Make sure to copy the `oauth:` prefix as well!

### Step 3: Add Credentials to .env File

1. Open your `.env` file in `E:\IdleDnD-Backend\.env`
2. Add the following lines (or update if they already exist):

```env
# TNEWBOT Credentials (for command responses - messages will appear from TNEWBOT instead of streamer)
# Get OAuth token from: https://twitchapps.com/tmi/
TNEWBOT_USERNAME=your_bot_username_here
TNEWBOT_OAUTH_TOKEN=oauth:your_oauth_token_here
```

3. Replace the placeholders:
   - `your_bot_username_here` → Your bot's Twitch username (lowercase, no spaces)
   - `your_oauth_token_here` → The OAuth token you copied (keep the `oauth:` prefix)

**Example:**
```env
TNEWBOT_USERNAME=tnewbot
TNEWBOT_OAUTH_TOKEN=oauth:abc123xyz456789def012ghi345jkl678
```

### Step 4: Restart Backend Server

1. Stop your backend server (if running)
2. Start it again: `npm run dev` or your usual start command
3. Check the console logs for connection messages

### Step 5: Verify Setup

Look for these log messages in your backend console:

**Success messages:**
```
📡 Initializing Twitch event handlers...
✅ Successfully connected to Twitch IRC for TNEWBOT
[TNEWBOT] ✅ Joined channel #channelname
```

**If you see errors:**
- `❌ Failed to connect to Twitch` → Check your credentials
- `⚠️ Bot client not connected` → Verify the token is correct
- `Authentication failure` → Token may be invalid or expired

## How It Works

1. **On Startup:** The backend initializes the TNEWBOT client using the credentials from your `.env` file
2. **When Streamers Connect:** When a streamer logs in via OAuth, TNEWBOT automatically joins their channel
3. **Command Processing:** When viewers use commands, responses are sent via TNEWBOT instead of the streamer's account
4. **Automatic Channel Joining:** TNEWBOT automatically joins channels as needed - no manual configuration required

## Token Expiration

**Good News:** Tokens from twitchapps.com/tmi/ typically **do NOT expire automatically**. They remain valid until:
- You change the bot account's password
- You manually revoke the token
- Twitch invalidates it for security reasons

**If your token expires:**
1. Go back to https://twitchapps.com/tmi/
2. Click "Connect" again
3. Authorize the app
4. Copy the new token
5. Update your `.env` file
6. Restart your backend server

## Troubleshooting

### Commands Still Appearing from Streamer

**Problem:** Responses still show as coming from the streamer instead of TNEWBOT.

**Solutions:**
1. Verify TNEWBOT credentials are in `.env` file
2. Check that the backend server was restarted after adding credentials
3. Look for error messages in backend console logs
4. Verify the OAuth token includes the `oauth:` prefix
5. Check that the bot username is correct (lowercase, no spaces)

### Bot Not Connecting

**Problem:** Backend logs show "Bot client not connected" or connection errors.

**Solutions:**
1. Verify `TNEWBOT_USERNAME` and `TNEWBOT_OAUTH_TOKEN` are set correctly
2. Check that the OAuth token is valid (try regenerating it)
3. Ensure the token starts with `oauth:`
4. Verify the bot account exists and is accessible
5. Check for typos in the username (must be lowercase)

### Bot Not Joining Channels

**Problem:** TNEWBOT doesn't automatically join channels when streamers connect.

**Solutions:**
1. This should happen automatically - check backend logs for join messages
2. Verify the bot client is connected (see "Bot Not Connecting" above)
3. Check that streamers are logging in via OAuth (not just using bot fallback)

### "No available client" Errors

**Problem:** Backend logs show "No available Twitch client to send message".

**Solutions:**
1. Ensure TNEWBOT credentials are configured
2. Verify the bot client connected successfully on startup
3. Check that the bot has joined the channel (should be automatic)
4. Look for earlier connection errors in the logs

## Optional: Initial Channels

If you want TNEWBOT to join specific channels on startup (before streamers log in), you can add:

```env
# Optional: Initial channels for TNEWBOT to join on startup (comma-separated, lowercase, no #)
TWITCH_CHANNELS=tehchno,theneverendingwar
```

**Note:** This is optional - TNEWBOT will automatically join channels when streamers connect via OAuth.

## Security Notes

- **Never commit your `.env` file to Git** - it's already in `.gitignore`
- **Keep your OAuth token private** - don't share it publicly
- **Use a dedicated bot account** - don't use your personal streamer account
- **Don't change the bot account password** - this will invalidate the token

## Additional Resources

- Twitch Token Generator: https://twitchapps.com/tmi/
- Twitch IRC Documentation: https://dev.twitch.tv/docs/irc/
- Twitch OAuth Documentation: https://dev.twitch.tv/docs/authentication/

## Summary

1. ✅ Create/get a Twitch bot account
2. ✅ Get OAuth token from https://twitchapps.com/tmi/
3. ✅ Add `TNEWBOT_USERNAME` and `TNEWBOT_OAUTH_TOKEN` to `.env`
4. ✅ Restart backend server
5. ✅ Verify connection in logs
6. ✅ Test commands in chat - responses should come from TNEWBOT!

Once set up, all command responses will automatically appear from TNEWBOT instead of the streamer, making it clear to viewers that these are game responses.


