# Backend Scripts

Utility scripts for managing Firebase data.

## sync-heroes.js

Syncs hero data from the Electron app save file to Firebase.

### Usage

```bash
# Basic sync (skips existing heroes)
node scripts/sync-heroes.js E:\IdleDnD\save-data.json

# Overwrite existing heroes
node scripts/sync-heroes.js E:\IdleDnD\save-data.json --overwrite

# Create a test hero for development
node scripts/sync-heroes.js --test
```

### Save File Format

The script supports multiple JSON formats:

**Format 1: Array of heroes**
```json
[
  {
    "name": "Hero1",
    "twitchUserId": "user123",
    "role": "berserker",
    "level": 5,
    ...
  },
  {
    "name": "Hero2",
    ...
  }
]
```

**Format 2: Object with heroes key**
```json
{
  "heroes": [
    { "name": "Hero1", ... },
    { "name": "Hero2", ... }
  ]
}
```

**Format 3: Object with user IDs as keys**
```json
{
  "user123": {
    "name": "Hero1",
    "twitchUserId": "user123",
    ...
  },
  "user456": {
    "name": "Hero2",
    ...
  }
}
```

### Features

- ✅ Validates required fields (twitchUserId)
- ✅ Transforms data to match Firebase schema
- ✅ Checks for existing heroes before creating
- ✅ Optional overwrite mode
- ✅ Detailed progress logging
- ✅ Sync summary statistics
- ✅ Test hero creation for development

### Notes

- Heroes are matched by `twitchUserId` to prevent duplicates
- By default, existing heroes are skipped (use `--overwrite` to update them)
- Missing optional fields are filled with sensible defaults
- Heroes without `twitchUserId` are skipped with a warning

