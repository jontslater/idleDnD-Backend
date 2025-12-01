# Deploy Firestore Indexes

This guide explains how to deploy the Firestore composite indexes required for the unified browser source auto-switching feature.

## Prerequisites

1. Firebase CLI installed: `npm install -g firebase-tools`
2. Logged into Firebase: `firebase login`
3. Firebase project initialized (if not already): `firebase init firestore`

## Method 1: Deploy via Firebase CLI (Recommended)

1. Navigate to the backend directory:
   ```bash
   cd E:\IdleDnD-Backend
   ```

2. Deploy the indexes:
   ```bash
   npm run deploy-indexes
   ```
   
   Or directly:
   ```bash
   firebase deploy --only firestore:indexes
   ```

3. Wait for the indexes to build (can take a few minutes). You'll see output like:
   ```
   ✔  Deployed indexes successfully.
   ```

## Method 2: Create via Firebase Console

If you prefer to create indexes manually:

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Select your project
3. Navigate to **Firestore Database** > **Indexes** tab
4. Click **Create Index**
5. Configure the index:
   - **Collection ID**: `raidInstances`
   - **Fields to index**:
     - Field: `participantIds`, Type: **Array**
     - Field: `status`, Type: **Ascending**
   - Click **Create**

6. Repeat for `dungeonInstances` (if dungeons are implemented):
   - **Collection ID**: `dungeonInstances`
   - **Fields to index**:
     - Field: `participantIds`, Type: **Array**
     - Field: `status`, Type: **Ascending**

## Method 3: Automatic Creation (When Query Runs)

Firebase will automatically prompt you to create the index when the query first runs:

1. When you first use the unified browser source, you'll see an error in the console
2. The error will include a link to create the index
3. Click the link and Firebase will create it for you

## Verify Index Status

1. Go to Firebase Console > Firestore Database > Indexes
2. Look for indexes with:
   - Collection: `raidInstances` or `dungeonInstances`
   - Fields: `participantIds` (Array), `status` (Ascending)
3. Status should show:
   - **Building** - Still being created (wait a few minutes)
   - **Enabled** - Ready to use ✅
   - **Error** - Needs attention (check error message)

## Troubleshooting

### Index Not Building
- Check that `participantIds` field exists in your raid instances
- Verify the field is an array of strings (not objects)
- Ensure you have the correct Firebase project selected

### Query Still Failing
- Wait for index to finish building (can take 5-10 minutes)
- Check browser console for specific error messages
- Verify the query matches the index exactly

### Firebase CLI Not Found
```bash
npm install -g firebase-tools
firebase login
```

## Index Configuration

The indexes are defined in `firestore.indexes.json`:

```json
{
  "indexes": [
    {
      "collectionGroup": "raidInstances",
      "queryScope": "COLLECTION",
      "fields": [
        {
          "fieldPath": "participantIds",
          "arrayConfig": "CONTAINS"
        },
        {
          "fieldPath": "status",
          "order": "ASCENDING"
        }
      ]
    }
  ]
}
```

This allows efficient querying for active raids where a user is a participant.



