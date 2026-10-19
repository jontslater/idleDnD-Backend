# Backend deploy (The Never Ending War)

## Firestore security

Deploy rules before pointing clients at production:

```bash
firebase deploy --only firestore:rules
```

`firestore.rules` denies **all** client reads/writes on `heroes`, `users`, `twitchCredentials`, purchases, mail, and auction data. Streamers must not read OAuth tokens from hero documents; tokens live only in `twitchCredentials` (encrypted server-side).

## Environment

| Variable | Purpose |
|----------|---------|
| `JWT_SECRET` | Player session JWT |
| `TWITCH_CREDENTIALS_KEY` | AES key for `twitchCredentials` (falls back to `JWT_SECRET`) |
| `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` | Checkout + webhook |
| `TWITCH_EXTENSION_SECRET` | Base64 secret for Bits extension JWT |
| `ALLOWED_ORIGINS` | Comma-separated CORS origins (**required in production**) |
| `INTERNAL_API_KEY` | Internal routes + admin tooling |
| `NODE_ENV=production` | Enables CORS fail-closed when `ALLOWED_ORIGINS` unset |

## Migrations (run manually)

```bash
node scripts/migrate-strip-twitch-hero-tokens.js --dry-run
node scripts/migrate-strip-twitch-hero-tokens.js --apply

node scripts/migrate-balance-v2.js --dry-run
node scripts/migrate-balance-v2.js --apply

node scripts/migrate-gear-v2.js --dry-run
node scripts/migrate-gear-v2.js --apply
```

## Canonical idle loot API

Server-rolled world/idle drops: **`POST /api/battlefields/:battlefieldId/loot/roll`** (streamer overlay key). See `docs/QUEUE_API.md`.
