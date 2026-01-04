# User Data Wipe Guide

This guide explains how to completely delete all data for a user (like "dingo dynasty") so they can start fresh.

## Overview

When a user has corrupted data or can't access their portal, a complete data wipe allows them to start over. This involves deleting their data from multiple Firestore collections.

## Collections That Store User Data

When wiping a user, you need to check and delete from these collections:

1. **`heroes`** - All hero documents for the user
2. **`users`** - User settings, slots unlocked, etc.
3. **`purchases`** - Purchase history (optional - may want to keep for records)
4. **Battlefield participation** - Heroes may be referenced in `battlefields` collection (usually cleaned up automatically)

## Step-by-Step: Manual Deletion in Firebase Console

### Step 1: Find the User's Twitch ID

You need to identify the user by their Twitch username or Twitch ID. The Twitch ID can be:
- A string (e.g., `"12345678"`)
- A number (e.g., `12345678`)
- Stored in `twitchUserId` field (new) or `twitchId` field (legacy)

**To find their Twitch ID:**
1. Go to Firebase Console → Firestore Database
2. Open the `heroes` collection
3. Search for their username in the `username` field
4. Note their `twitchUserId` or `twitchId` value

### Step 2: Delete All Heroes

1. In Firebase Console, go to **Firestore Database**
2. Open the **`heroes`** collection
3. Use the filter/search to find all heroes for this user:
   - Filter: `twitchUserId` = `[their Twitch ID]` (try as both string and number)
   - OR filter: `twitchId` = `[their Twitch ID]` (legacy field)
   - OR search: `username` = `"dingo dynasty"` (or their exact username)
4. Select all matching hero documents
5. Click **Delete** (or delete them one by one)

**Important:** Make sure to check both `twitchUserId` and `twitchId` fields, and try both string and numeric formats.

### Step 3: Delete User Document

1. In the **`users`** collection
2. Find the document with ID matching their Twitch ID (try both string and number formats)
3. Delete the document

**Note:** If no user document exists, that's fine - it will be created when they log in again.

### Step 4: (Optional) Delete Purchase History

1. In the **`purchases`** collection
2. Filter by `twitchUserId` or `twitchId` = `[their Twitch ID]`
3. Delete all matching purchase documents

**Note:** You may want to keep purchase history for records, but deleting it ensures a completely fresh start.

### Step 5: Verify Deletion

1. Search all collections again to make sure nothing remains
2. Have the user try logging in again
3. They should be able to create a new hero from scratch

## Using the Admin Wipe Script (Recommended)

Instead of manual deletion, you can use the provided admin script to automate this process.

### Prerequisites

- Access to the backend server
- The user's Twitch username or Twitch ID

### Steps

1. **Find the user's Twitch ID:**
   ```bash
   # You can use the backend API to search for them first
   # Or check Firebase console manually
   ```

2. **Run the wipe script:**
   ```bash
   cd E:\IdleDnD-Backend
   node scripts/wipe-user-data.js [twitchUserId]
   ```

3. **Verify the output:**
   The script will show what was deleted and confirm completion.

## What Happens After Wipe

After deletion:
- ✅ User can log in normally
- ✅ User can create a new hero with `!join`
- ✅ All previous hero data is gone
- ✅ User starts with default slots (3 heroes)
- ✅ No purchase history (if purchases were deleted)
- ✅ No founder pack status (if user document was deleted)

## Troubleshooting

### "User still can't log in"

- Check if there are any remaining documents in `heroes` collection
- Verify the Twitch ID format (string vs number)
- Check for typos in the username or ID
- Look for documents with legacy `twitchId` field

### "Hero still appears"

- Make sure you deleted from both `twitchUserId` and `twitchId` fields
- Check if the hero is in a battlefield (may need to remove from battlefield first)
- Verify you're searching with the correct Twitch ID format

### "Can't find the user"

- Try searching by username instead of Twitch ID
- Check if they might have used a different account
- Verify the exact spelling/capitalization of their username

## Safety Notes

⚠️ **This action is IRREVERSIBLE** - once deleted, the data cannot be recovered.

⚠️ **Double-check the Twitch ID** - make sure you're deleting the right user's data.

⚠️ **Backup first** (optional) - if you want to keep a record, export the documents before deleting.

## Alternative: Partial Reset

If you only want to delete heroes but keep user settings:

1. Delete only from `heroes` collection
2. Keep the `users` document (so they keep their unlocked slots)
3. They can create new heroes, but will retain their slot unlocks



