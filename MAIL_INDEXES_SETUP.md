# Mail System Firestore Indexes Setup

The mail system requires Firestore composite indexes for efficient queries. This document explains how to create them.

## Quick Method: Using Firebase Console Links

When the mail system runs and encounters a missing index, it will return an error with a direct link to create the index in the Firebase Console.

### Step 1: Trigger the Index Error

1. Navigate to the Mail tab in the web app
2. The backend will log an error like:
   ```
   Error: 9 FAILED_PRECONDITION: The query requires an index. You can create it here: [LINK]
   ```
3. Or check the browser console/network tab for the error response

### Step 2: Click the Link

The error message includes a link that looks like:
```
https://console.firebase.google.com/v1/r/project/the-never-ending-war/firestore/indexes?create_composite=...
```

1. **Copy the link** from the error message
2. **Open it in your browser**
3. You'll be taken directly to the Firebase Console with the index pre-configured
4. **Click "Create Index"**
5. Wait for the index to build (usually 1-5 minutes)

### Step 3: Repeat for All Indexes

The mail system needs **2 composite indexes**:

#### Index 1: Basic Mail Query
- **Collection**: `mail`
- **Fields**:
  - `recipientId` (Ascending)
  - `deletedAt` (Ascending)
  - `createdAt` (Descending)

#### Index 2: Unread Mail Query
- **Collection**: `mail`
- **Fields**:
  - `recipientId` (Ascending)
  - `deletedAt` (Ascending)
  - `read` (Ascending)
  - `createdAt` (Descending)

**Note**: You can trigger both indexes by:
- Opening mail normally (triggers Index 1)
- Filtering by "Unread" (triggers Index 2)

## Alternative Method: Manual Creation in Firebase Console

If you prefer to create indexes manually:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select project: **the-never-ending-war**
3. Navigate to **Firestore Database** > **Indexes** tab
4. Click **Create Index**
5. Configure each index as described above
6. Click **Create** and wait for build completion

## Alternative Method: Firebase CLI

If you have Firebase CLI set up:

```bash
cd E:\IdleDnD-Backend
firebase deploy --only firestore:indexes
```

## Current Status

✅ `firebase.json` - Created
✅ `.firebaserc` - Created (project: the-never-ending-war)
✅ `firestore.indexes.json` - Contains all required indexes

The backend has a **fallback mechanism** that works without indexes (sorts in memory), but indexes are recommended for better performance.

## Verification

After creating indexes:

1. Check Firebase Console > Firestore > Indexes tab
2. Verify both mail indexes show as **Enabled**
3. Try using the mail system - it should work without errors
4. Check backend logs - no index errors should appear

## Notes

- Indexes can take 1-5 minutes to build
- The system works without indexes (uses in-memory sorting as fallback)
- Indexes improve query performance significantly
- Once built, indexes persist and don't need to be recreated


