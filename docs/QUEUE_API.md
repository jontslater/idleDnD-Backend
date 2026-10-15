# Battlefield queue API (chat + portal)

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
  "queue": { "...serialized queue or null..." }
}
```

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

`:queueId` is the battlefield queue doc id (`twitch:{streamerTwitchId}`).

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

## Instance status

Launched instances use `status: "in-progress"` with `battlefieldId`, `participantIds`, and real `dungeonId` / `raidId`. Heroes keep `currentBattlefieldId` on the streamer battlefield and get `activeInstance`.

## Scheduled guild raids

Planned future feature — see `docs/MISSING_BACKEND_ROUTES.md`. Existing `/api/raids/schedule` and `/api/raids/upcoming` remain for dormant guild scheduling.
