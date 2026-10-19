# Backend routes referenced by TNEWFE overlay but not implemented

The OBS browser source (TNEWFE) calls these endpoints; they **do not exist** on this backend. The frontend should remove or hide these calls until backend support is added.

| Method | Path | Notes |
|--------|------|--------|
| GET | `/api/raids/scheduled/battlefield/:battlefieldId` | Scheduled raids for a battlefield |
| POST | `/api/raids/scheduled/:id/start` | Start a scheduled raid instance |
| POST | `/api/raids/:raidId/simulate` | Raid simulation (portal/dev tooling) |

No implementation is included in PR #9 by design (out of scope).

## Scheduled guild raids (planned — dormant)

Guild-scheduled raids (`POST /api/raids/schedule`, overlay `scheduled/*` paths) are a **future** feature. Backend schedule/upcoming handlers remain but are not wired to the chat `battlefieldQueues` flow. Portal should use [QUEUE_API.md](./QUEUE_API.md) for live streamer queues.

## Implemented queue routes

See [QUEUE_API.md](./QUEUE_API.md) for `GET/POST /api/queues` shapes.
