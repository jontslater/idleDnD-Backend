# Firestore Composite Indexes Required

This document lists all required Firestore composite indexes for the application.

## Indexes for Active Instance Listener

The unified browser source uses real-time listeners to detect active raid/dungeon instances. These queries require composite indexes.

### Raid Instances Query

**Collection:** `raidInstances`

**Fields:**
- `participantIds` (array-contains)
- `status` (in)

**Query:** Find active raids where user is a participant
```javascript
query(
  collection(db, 'raidInstances'),
  where('participantIds', 'array-contains', userId),
  where('status', 'in', ['active', 'in-progress'])
)
```

**Index Configuration:**
- Collection ID: `raidInstances`
- Fields to index:
  1. `participantIds` (Array)
  2. `status` (Ascending)

**Note:** `participantIds` is an array of userId strings (e.g., `['user123', 'user456']`) used for efficient querying. The `participants` field contains full participant objects with hero data.

**How to create:**
1. Go to Firebase Console > Firestore Database > Indexes
2. Click "Create Index"
3. Collection ID: `raidInstances`
4. Add field: `participantIds` (Array)
5. Add field: `status` (Ascending)
6. Click "Create"

**OR use Firebase CLI:**
```bash
firebase deploy --only firestore:indexes
```
This will deploy the indexes defined in `firestore.indexes.json`

### Dungeon Instances Query

**Collection:** `dungeonInstances`

**Fields:**
- `participantIds` (array-contains)
- `status` (in)

**Query:** Find active dungeons where user is a participant
```javascript
query(
  collection(db, 'dungeonInstances'),
  where('participantIds', 'array-contains', userId),
  where('status', 'in', ['active', 'in-progress'])
)
```

**Index Configuration:**
- Collection ID: `dungeonInstances`
- Fields to index:
  1. `participantIds` (Array)
  2. `status` (Ascending)

**Note:** `participantIds` is an array of userId strings (e.g., `['user123', 'user456']`) used for efficient querying. The `participants` field contains full participant objects with hero data.

**Note:** This index is only needed if dungeon instances use the same structure as raid instances. If dungeons aren't implemented yet, this can be skipped.

## Automatic Index Creation

Firebase will automatically prompt you to create these indexes when you first run a query that requires them. You can:

1. Click the link in the error message
2. Or manually create them using the steps above

## Production Deployment

When deploying to production, make sure to:

1. Create all required indexes in your production Firebase project
2. Wait for indexes to finish building (can take a few minutes)
3. Test the queries to ensure they work correctly

## Index Status

You can check index status in Firebase Console > Firestore Database > Indexes. Indexes show as:
- **Building** - Still being created
- **Enabled** - Ready to use
- **Error** - Needs attention
