# Integration Hooks for Future Features

This document describes hooks and architecture decisions that enable future features without requiring major refactoring.

## Twitch Bits & Subscriptions Integration

### Current State
- Basic Twitch authentication implemented (`src/routes/auth.js`)
- Hero data structure supports custom fields
- Token-based economy in place

### Integration Points

#### 1. Bits Handler
**Location**: `src/routes/bits.js` (exists, needs expansion)

**Proposed Benefits** (non-pay-to-win):
- **XP Boost**: Temporary XP multiplier (e.g., 1.5x for 1 hour)
- **Cosmetics**: Visual effects, titles, hero skins (no stats)
- **Token Bonus**: Small token grant (equivalent to ~2 hours idle farming)
- **Convenience**: Extra inventory slots, instant travel, etc.

**Hook Pattern**:
```javascript
// In bits.js, after validating Bits transaction
const benefits = {
  xpBoost: { multiplier: 1.5, duration: 3600 }, // 1 hour
  tokens: 5, // Small amount
  cosmetic: 'bits_effect_sparkle'
};

await applyBitsReward(heroId, benefits);
```

**Config**: `src/data/bitsRewards.js` (to be created)
```javascript
export const BITS_REWARDS = {
  100: { xpBoost: { multiplier: 1.3, duration: 1800 }, tokens: 5 },
  500: { xpBoost: { multiplier: 1.5, duration: 3600 }, tokens: 25 },
  1000: { xpBoost: { multiplier: 2.0, duration: 3600 }, tokens: 50, cosmetic: 'bits_legendary' }
};
```

#### 2. Subscription Benefits
**Location**: Add `src/routes/subscriptions.js`

**Proposed Benefits** (non-pay-to-win):
- **Idle Token Rate**: Increase idle tokens/hour by 50% (from 2.5 to 3.75)
- **Priority Queue**: Move to front of dungeon/raid queue (not power, just convenience)
- **Cosmetics**: Exclusive titles, effects, mount skins
- **Extra Character Slot**: +1 hero slot per sub tier

**Hook Pattern**:
```javascript
// Check sub status via Twitch API
const subTier = await getTwitchSubTier(userId, channelId);

// Apply benefits in hero update/claim logic
const idleTokenRate = BASE_IDLE_RATE * (subTier ? 1.5 : 1.0);
```

**Integration Points**:
- `src/services/commandHandler.js` `handleClaimCommand()` - Modify idle token rate
- `src/routes/heroes.js` POST `/unlock-slot` - Allow extra slot for subs
- Hero data: Add `subTier` field (1-3) and `subExpiry` timestamp

#### 3. Database Schema Additions

**Hero Collection** (add fields):
```javascript
{
  // Existing fields...
  
  // Bits/Subs benefits
  subTier: 0,                    // 0 = none, 1-3 = sub tiers
  subExpiry: Timestamp,          // When sub benefits expire
  activeBoosts: {                // Active temporary boosts
    xpBoost: {
      multiplier: 1.5,
      expiresAt: Timestamp,
      source: 'bits_100'          // Track source for analytics
    }
  },
  cosmeticsUnlocked: [           // Array of cosmetic IDs
    'bits_effect_sparkle',
    'sub_title_legendary'
  ],
  bitsSpent: 0,                  // Lifetime bits spent (analytics)
  
  // Future: Battle Pass integration
  battlePassLevel: 0,
  battlePassXP: 0
}
```

**Purchases Collection** (exists, expand):
```javascript
{
  // Existing fields...
  
  purchaseType: 'bits' | 'tokens' | 'founders',
  bitsAmount: 100,               // For bits purchases
  rewardGranted: { ... }         // What was given
}
```

### Design Principles

1. **No Pay-to-Win**: Bits/subs provide convenience and cosmetics, not power
   - XP boosts reduce grind but don't grant gear
   - Tokens from Bits are limited (equivalent to a few hours of play)
   - No direct power purchases (no "buy legendary weapon")

2. **Validate Server-Side**: Never trust client
   - Verify Bits/sub status via Twitch API
   - Check subscription status on every claim/action
   - Log all benefits for audit trail

3. **Graceful Degradation**: Game is fully playable without spending
   - F2P players can earn everything except cosmetics
   - Grind is longer but not impossible
   - Social/guild features accessible to all

4. **Analytics Friendly**: Track conversions and engagement
   - Log all Bits transactions
   - Monitor sub conversion rates
   - A/B test reward amounts

### Implementation Checklist

When implementing Bits/Subs:

- [ ] Create `src/data/bitsRewards.js` with reward tiers
- [ ] Create `src/routes/subscriptions.js` for sub status checks
- [ ] Add Twitch API calls to verify Bits transactions
- [ ] Add Twitch API calls to check subscription status
- [ ] Update hero schema with new fields (via migration script)
- [ ] Modify `handleClaimCommand()` to check sub tier
- [ ] Add benefit application logic to `src/services/benefitsService.js`
- [ ] Add cosmetics rendering to frontend
- [ ] Add analytics events for all purchases
- [ ] Test with Twitch developer sandbox
- [ ] Add admin dashboard to view Bits/sub metrics

### Rate Limiting

Prevent abuse of Bits/sub benefits:

```javascript
// In benefitsService.js
const RATE_LIMITS = {
  bitsReward: {
    maxPerDay: 10,              // Max 10 Bits rewards per day
    minAmount: 100              // Minimum 100 bits per transaction
  },
  xpBoost: {
    maxStacks: 1                // Only 1 XP boost active at a time
  }
};
```

### Testing Hooks

For development/testing without real Bits:

```javascript
// In .env
ENABLE_TEST_BITS=true
TEST_BITS_WEBHOOK_SECRET=test_secret_123

// POST /api/bits/test (dev only)
// Simulates a Bits transaction for testing
```

## Future: Battle Pass System

Structure is ready for seasonal battle passes:
- Track `battlePassXP` and `battlePassLevel` on heroes
- Rewards configured in `src/data/battlePass.js`
- Free and premium tracks
- Integrates with existing quest/achievement systems

## Future: Guild Perks

Existing guild system (`src/routes/guildPerks.js`) can be expanded:
- Guild-wide boosts funded by member contributions
- Guild vs. Guild events
- Shared guild bank/resources

---

**Note**: All integrations must be reviewed for game balance before deployment. Use the drop simulation script (`scripts/simulate-drops.js`) and balance analysis (`scripts/analyze-balance.js`) to verify any economy changes.
