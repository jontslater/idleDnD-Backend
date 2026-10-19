# Balance & economy (backend)

Authoritative formulas live in `src/data/balance.js`. The same data is exported to `data/balance.json` and served at **`GET /api/balance`** (public, cacheable 5 minutes).

## Level curve

- `g(L) = 1 + 0.10 × (L − 1)`
- **XP to next level:** `floor(60 × g(L) × L^1.13)` — Jonathan pace (~175 idle hours to level 100 at ~240 kills/hour).
- Hero combat stats are **derived** from role, class ratios, level, and gear (`deriveHeroCombatStats`). Level-up no longer increments stored `attack` / `defense` / `maxHp`.

## Combat

| Topic | Rule |
|--------|------|
| Swing timer | 2.0s per actor |
| Damage variance | `U(0.9, 1.1)` |
| Armor DR | `min(0.75, armor / (armor + 400 × g(L_attacker)))` |
| Crit | ×1.5 damage/heal, **35%** cap (gear + base) |
| Heal | `spellPower × 3.0 × chatMult` (×1.5 on crit) |
| HP regen | Between fights only; full heal over 3s (`hpRegen` in balance payload) |

### Role base stats (× `g(L)` + gear budget)

See `roleBaseStats` in `GET /api/balance`. Gear full-set budget: `0.40 × R × base(role) × g(ilvl)` with rarity `R` (common 1.0 … mythic 2.25).

### Enemies (× `g(L)`)

| Kind | HP | ATK | Armor | Notes |
|------|-----|-----|-------|--------|
| normal | 900 | 40 | 150 | |
| elite | ×3 HP, ×1.3 ATK, ×1.2 armor | | |
| dungeon boss | ×8 HP, ×2.6 ATK, ×1.3 armor | AoE 0.5×ATK / 12s |
| raid boss | ×24 HP × (party/5), ×3.2 ATK, ×1.5 armor | AoE 0.6×ATK / 10s; **enrage at 6:00** (+10% ATK every 10s) |

Raid boss stats on `GET /api/raids/:raidId?partyLevel=&partySize=` are scaled via `scaleRaidBoss`.

## Chat boost

- Active window: **10 minutes** (`CHAT_BOOST.activeWindowMs`).
- Damage/heal: `1 + min(0.20, 0.02 × activeChatters)`.
- Loot rarity weight: `+0.5%` per chatter, cap **+5%**.
- WebSocket `chatter_count_update` includes `chatMult`, `chatBoostPercent`, `lootRarityBonus`.

## XP sources

| Source | Formula |
|--------|---------|
| Idle kill (normal) | `12 × g(L)` per kill (`combatKillBaseXp`) |
| Elite | ×3 |
| Boss | ×10 |
| Dungeon clear | 15 minutes of idle XP at hero level |
| Raid clear | 45 minutes of idle XP at hero level |
| Daily quest (design target) | 20 minutes of idle XP at hero level |

Battlefield XP distribution uses `combatKillBaseXp` server-side (client `baseXP` is replaced). Overlay sync clamps XP per batch to **3×** expected XP per minute (`maxXpGainPerMinute`).

## Loot

- **Normal kill drop chance:** 8% (`KILL_DROP_CHANCES.normal` in `lootConfig.js`, mirrored in balance `loot`).
- **Elite:** 25%.
- Rarity tables: `DROP_RATES` in `lootConfig.js` (exported on `/api/balance`).

## Level bands & queues

`levelBands` in balance JSON lists dungeon/raid bands up to 100. `queueRequirements.js` exposes `resolveMinItemLevelForRaid` and `minItemLevel` on select raids (e.g. Corrupted Temple 25, Elder Dragon Heroic 55).

---

## Monetization (no pay-to-win)

### Founder packs — cosmetic only

Founder packs grant display entitlements only (`buildFounderPackCosmeticUpdate` in `src/utils/monetization.js`). No bonus tokens, gold, XP, loot, or combat stats.

### Premium tokens (Stripe token packs)

- Packs grant **tokens only** — no gold (`src/data/tokenPacks.js`, Stripe webhook in `src/index.js`).
- **Cosmetic-only spends** — catalog in `src/utils/tokenCosmetics.js`, purchase via `POST /api/heroes/:userId/purchase/cosmetic-tokens`.

### Blocked premium token sinks (HTTP 410, code `TOKEN_SINK_COSMETIC_ONLY`)

| Sink | Route / module |
|------|----------------|
| Token gear shop | `POST /api/heroes/:userId/purchase/tokens` |
| Hero slot unlock | `POST /api/heroes/:userId/unlock-slot` |
| Bank expand with tokens | `POST /api/heroes/:userId/expand-storage` (`currency=tokens`) |
| Auction house (token currency) | `POST /api/auction/list` (`currency=tokens`) |
| Skill respec with tokens | Admin `resetSkills` — no token deduction |

Gold remains the gameplay currency for gear upgrades, gold shop items, and bank expansion.

### Twitch Bits

XP boost / token bundle Bits rewards return **410** (no gameplay grant). Gear Bits delivery unchanged.

### Idle `!claim`

Flat **2.5 tokens/hour** for all players; founder tier does not change the rate.

---

## Tests

- `tests/balance.test.js` — curve, DR cap, chat cap, XP hours, loot 8%, API payload.
- `tests/monetization.test.js` — founder neutrality, token pack no gold, cosmetic sink policy.

Regenerate JSON after formula edits: `npm run export-balance`.
