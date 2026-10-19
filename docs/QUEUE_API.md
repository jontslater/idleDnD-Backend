# Battlefield queue API (chat + portal)

## Idle loot (server rolls)

**Canonical:** `POST /api/battlefields/:battlefieldId/loot/roll`  
**Auth:** `X-Streamer-Key` (same as overlay sync)

**Body**

```json
{
  "kills": [
    { "heroId": "hero-doc-id", "enemyLevel": 42, "kind": "normal" }
  ]
}
```

- `kind`: `normal` | `elite` (boss kinds `raidBoss`, `dungeonBoss`, `worldboss` are rejected — raid/dungeon loot only from instance completion).
- Drop rate caps match idle plan (~8% normal, per-hero per-minute limits).

`POST /api/overlay/loot-roll` remains as a deprecated alias (same payload plus `streamerId` or `battlefieldId`).

`POST /api/overlay/sync` may include `kills[]` in the same batch as `deltas[]` (one rate-limit tick per batch, many heroes allowed).

---

Chat (`!dungeon` / `!raid`, `!qdungeon` / `!qraid`, `!qleave`, `!qstatus`, `!qstart`, `!qcancel`) and these REST routes share the same `battlefieldQueues` documents and `queueService` logic.

## Queue keys → content IDs

| Type | Queue key | `contentId` (dungeonId / raidId) |
|------|-----------|----------------------------------|
| dungeon | `normal` | `ancient_catacombs` |
| dungeon | `heroic` | `demon_ruins` |
| dungeon | `mythic` | `demon_ruins` |
| raid | `elder_dragon_*`, `corrupted_temple`, `bandit_stronghold` | same id as key |

Unknown keys are rejected at create time.

## Queue document (`battlefieldQueues/{battlefieldId}`)

`battlefieldId` is `twitch:{streamerTwitchId}`.

| Field | Type | Notes |
|-------|------|--------|
| `code` | string | 4-letter join code |
| `name` | string | Display name for UI/chat (e.g. `Elder Dragon's Lair (Normal)`, `Normal Dungeon`) |
| `type` | `'dungeon' \| 'raid'` | |
| `queueKey` | string | e.g. `normal`, `elder_dragon_normal` |
| `contentId` | string | Real `dungeonId` / `raidId` |
| `status` | `'open' \| 'ready' \| 'launching'` | |
| `isReady` | boolean | All roles filled |
| `launchAt` | Timestamp \| null | Set when ready; sweeper launches when due |
| `participants` | array | See join response |
| `streamerId` | string | Twitch user id |
| `battlefieldId` | string | `twitch:{streamerId}` |

## GET `/api/queues/:twitchId`

**Response**

```json
{
  "queue": {
    "id": "twitch:12345",
    "queueId": "dungeon_normal_1690000000000",
    "battlefieldId": "twitch:12345",
    "code": "ABCD",
    "...": "..."
  }
}
```

- **`id`** — Firestore document id (`battlefieldQueues/{id}`), always `twitch:{streamerTwitchId}`. Use this for join/leave URLs.
- **`queueId`** — Logical id stored on the document (`dungeon_normal_<timestamp>`). Also accepted as `:queueId` on join/leave.

`launchAt` / `expiresAt` are epoch ms in JSON.

## POST `/api/queues`

**Auth:** `Authorization: Bearer <jwt>` (streamer’s Twitch id) **or** `X-Streamer-Key`.

**Body**

```json
{
  "type": "dungeon",
  "queueKey": "normal",
  "twitchId": "12345"
}
```

`twitchId` required for JWT when creating for a channel (must match token). Streamer-key auth uses the key’s channel.

**Response `201`**

```json
{
  "success": true,
  "queue": { },
  "message": "🏰 ... Room Code: ABCD"
}
```

## POST `/api/queues/:queueId/join`

**Auth:** JWT required.

**Body**

```json
{
  "heroId": "hero-doc-id"
}
```

`:queueId` may be either:

- Firestore doc id: `twitch:{streamerTwitchId}` (same as `queue.id` from GET), or
- Stored field `queue.queueId` (e.g. `dungeon_normal_1690000000000`).

The authenticated user's Twitch id is taken from the JWT only (never from the body).

**Response `200`**

```json
{
  "success": true,
  "queue": { },
  "message": "...",
  "isReady": false
}
```

## POST `/api/queues/:queueId/leave`

**Auth:** JWT required (leaves queue for `twitchUserId` on token).

**Response `200`**

```json
{
  "success": true,
  "queue": { },
  "message": "..."
}
```

## Hero progress & inventory (browser-source-unified)

These replace blocked `PUT /api/heroes/:userId` fields for adventure/inventory flows.

| Route | Auth | Body |
|-------|------|------|
| `POST /api/heroes/:userId/progress-sync` | Bearer (hero owner) | `currentWave`, `highestWave`, `winStreak`, `difficultyPercent` (40–125), optional `adventureState` |
| `POST /api/heroes/:userId/inventory/sell` | Bearer (hero owner) | `{ "itemIds": ["id1", "id2"] }` — server vendor prices, max 50 ids |
| `POST /api/overlay/sync` | Streamer key / owner | XP & gold batches (see `docs/BALANCE.md`) |

Equip gear with `POST /api/professions/:userId/equip` and `{ slot, itemId }` (item must be in inventory; stats are server-side).

## Instance status

Launched instances use `status: "in-progress"` with `battlefieldId`, `participantIds` (Twitch user ids), and real `dungeonId` / `raidId`. Heroes keep `currentBattlefieldId` on the streamer battlefield and get `activeInstance`.

### Firestore indexes (overlay queries)

If the overlay listens with `battlefieldId == X` and `status in [...]`, deploy composite indexes on `dungeonInstances` and `raidInstances` for `(battlefieldId, status)` — see `firestore.indexes.json` in this repo.

## Scheduled guild raids

Planned future feature — see `docs/MISSING_BACKEND_ROUTES.md`. Existing `/api/raids/schedule` and `/api/raids/upcoming` remain for dormant guild scheduling.
