# Balance & economy (backend)

This document will expand as the shared `balance.js` module lands. **Monetization policy** is authoritative today.

## Monetization (no pay-to-win)

### Founder packs — cosmetic only

Founder packs (Bronze / Silver / Gold / Platinum) grant **display entitlements only**:

- `founderPackTier` and `founderPackTierLevel` (Founders Hall, chat badge tier)
- `founderBadge` and `cosmetics.nameColor` (tier-based chat color)
- `unlockedTitles` includes **Founder**; `activeTitle` may be set to Founder if none selected

They do **not** grant:

- Premium tokens or gold on purchase completion
- Bonus idle token rates on `!claim`
- XP, loot drop rate, or combat stat multipliers

Implementation: `src/utils/monetization.js` (`buildFounderPackCosmeticUpdate`, `getPaidGameplayRewardMultiplier`).

Stripe `purchases` documents may still store historical fields such as `premiumCurrency` from older product copy; that value is **not** applied to heroes after completion.

### Token packs (Stripe)

Token packs remain explicit **currency products** (tokens + gold bundled at checkout). That is the product being sold, not a hidden combat multiplier. Purchase records and webhooks are unchanged.

### Twitch Bits

- **Gear** purchases: direct item delivery (unchanged).
- **Consumable perks** that granted XP boosts or token bundles via Bits are **disabled** server-side (no gameplay grant). Use the in-game token shop or quests for progression currency.

### Where gameplay rewards are computed

| Reward | Module | Founder-aware? |
|--------|--------|----------------|
| Idle `!claim` tokens | `monetization.js` → `commandHandler.js` | No — flat `IDLE_TOKENS_PER_HOUR` |
| Battlefield XP split | `xpDistributionService.js` | No — `getPaidGameplayRewardMultiplier` |
| Overlay gold/XP sync | `overlay.js` clamps only | No founder multiplier |
| Loot tables | `lootConfig.js` | No founder weighting |

### Founder gold bonus (removed)

Previously, some clients applied a **+10% to +50% gold** multiplier by founder tier. The backend does not apply this; founder ownership must not change `goldGained` or XP in sync/distribution paths.
