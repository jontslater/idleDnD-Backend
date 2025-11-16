# Economy System Design

## Overview
The Never Ending War features a player-driven economy where crafted items have inherent value based on materials, profession level, and market demand.

## Item Valuation Formula

### Base Value Calculation
Each crafted item's base vendor value is calculated from its material costs:

```javascript
function calculateBaseValue(recipe, tier) {
  let baseValue = 100; // Starting value
  
  // Herbalism materials
  if (recipe.cost.herbs) {
    common: 10g per unit
    uncommon: 25g per unit
    rare: 75g per unit
    epic: 200g per unit
  }
  
  // Mining materials
  if (recipe.cost.ore) {
    iron: 15g per unit
    steel: 40g per unit
    mithril: 100g per unit
    adamantite: 250g per unit
  }
  
  // Enchanting materials
  if (recipe.cost.essence) {
    essence: 50g per unit
  }
  
  // Tier multiplier
  baseValue *= tier;
  
  return Math.floor(baseValue);
}
```

### Vendor Pricing
- **Vendor Sell Price:** Base value (instant gold, safe but lower)
- **Vendor Buy Price:** Base value * 2.5 (expensive, convenience fee)

### Auction House Pricing
- **Suggested Minimum:** Base value * 2
- **Suggested Maximum:** Base value * 3
- **Market Price:** Determined by supply/demand dynamics

## Economy Tiers

### Tier 1 Items (Profession Level 1-10)
- **Examples:** Basic Elixir, Iron Plating, Minor Rune
- **Base Value Range:** 100g - 300g
- **Expected Auction Price:** 200g - 900g

### Tier 2 Items (Profession Level 11-25)
- **Examples:** Powerful Elixir, Steel Reinforcement, Greater Rune
- **Base Value Range:** 400g - 800g
- **Expected Auction Price:** 800g - 2,400g

### Tier 3 Items (Profession Level 26-40)
- **Examples:** Superior Elixir, Mithril Upgrade, Epic Enchantment
- **Base Value Range:** 1,000g - 2,500g
- **Expected Auction Price:** 2,000g - 7,500g

### Tier 4 Items (Profession Level 41-50)
- **Examples:** Legendary Flask, Adamantite Upgrade, Mythic Enchantment
- **Base Value Range:** 3,000g - 6,000g
- **Expected Auction Price:** 6,000g - 18,000g

## Auction House (Planned)

### Listing System
```javascript
{
  auctionId: "unique_id",
  itemId: "crafted_item_id",
  sellerId: "hero_id",
  sellerName: "Hero Name",
  recipeKey: "iron_plating",
  tier: 1,
  quantity: 1,
  
  // Pricing
  startingBid: 150g,
  buyoutPrice: 300g,  // Optional instant purchase
  currentBid: 150g,
  currentBidder: null,
  
  // Timing
  listedAt: timestamp,
  expiresAt: timestamp + 48hours,
  
  // Status
  status: "active" | "sold" | "expired" | "cancelled"
}
```

### Auction Features
1. **Bidding:** Players can bid incrementally (minimum 5% increase)
2. **Buyout:** Instant purchase at fixed price
3. **Duration:** 12, 24, or 48 hour auctions
4. **Deposit:** 5% listing fee (returned if sold, lost if expired)
5. **Commission:** 5% auction house cut on successful sales
6. **Search/Filter:** By profession, tier, item type, price range
7. **Watch List:** Bookmark auctions to track

### Dynamic Pricing Recommendations
The system suggests prices based on:
- Recent sales data (last 7 days)
- Current active listings
- Supply vs. demand ratio
- Seasonal events/raid progression

```javascript
function getSuggestedPrice(recipeKey, tier) {
  const recentSales = getRecentSales(recipeKey, tier, 7days);
  const activeListings = getActiveListings(recipeKey, tier);
  
  if (recentSales.length > 0) {
    const avgPrice = average(recentSales.map(s => s.price));
    const supplyDemand = recentSales.length / Math.max(1, activeListings.length);
    
    return {
      low: avgPrice * 0.9 * supplyDemand,
      market: avgPrice * supplyDemand,
      high: avgPrice * 1.1 * supplyDemand
    };
  }
  
  // Fallback to base value calculation
  return calculateSuggestedPrice(baseValue);
}
```

## Gold Sinks (Prevent Inflation)
1. **Auction House Fees:** 5% deposit + 5% commission
2. **Guild Creation:** 1,000g
3. **Profession Changes:** 500g
4. **Repair Costs:** Based on gear tier
5. **Fast Travel:** 50g per use
6. **Bank Slots:** Scaling gold cost
7. **Transmog:** Cosmetic changes cost gold

## Gold Faucets (Gold Generation)
1. **Monster Drops:** Primary source
2. **Quest Rewards:** From Twitch commands
3. **Vendor Sales:** Selling crafted items
4. **Daily Login:** Small bonus
5. **Achievements:** One-time rewards
6. **World Boss Contributions:** Raid rewards

## Trading System
Direct player-to-player trades:
```javascript
{
  tradeId: "unique_id",
  initiator: { heroId, items: [], gold: 0 },
  recipient: { heroId, items: [], gold: 0 },
  status: "pending" | "accepted" | "cancelled",
  expiresAt: timestamp + 5minutes
}
```

### Trade Rules
- Max 8 items per side
- Max 10,000g per trade
- Both players must accept
- 5-minute window before auto-cancel
- Trade log for security

## Gift/Mail System
Send items to offline players:
```javascript
{
  mailId: "unique_id",
  senderId: "hero_id",
  recipientId: "hero_id",
  subject: "Gift from friend!",
  
  attachments: {
    items: [{ itemId, quantity }],
    gold: 100
  },
  
  sentAt: timestamp,
  opened: false,
  expiresAt: timestamp + 30days
}
```

### Mail Rules
- Max 10 items per mail
- Max 1,000g per mail
- 30-day expiration
- C.O.D. (Cash on Delivery) option
- Blocked players can't send mail

## Future Enhancements

### Guild Bank
- Shared storage for guild members
- Permission-based access (officer, member)
- Donation tracking
- Guild repairs from bank funds

### Player Shops
- Personal storefronts
- Custom prices and descriptions
- Shop reputation system
- Featured items/promotions

### Item Rarity Modifiers
As the game evolves, consider:
- **Perfect Craft:** 5% chance for +10% stats bonus → +20% value
- **Signed Items:** Crafter name visible → +10% value
- **Demand Multipliers:** Popular items during raids → +50% value

## API Endpoints (Future)

```
POST /api/auction/create
GET /api/auction/search
POST /api/auction/bid
POST /api/auction/buyout
DELETE /api/auction/cancel

POST /api/trade/initiate
POST /api/trade/accept
POST /api/trade/cancel

POST /api/mail/send
GET /api/mail/inbox
POST /api/mail/collect
```

## Economic Balance Goals
1. **Materials are always valuable** - Never worthless to gather
2. **Crafting is profitable** - Selling beats vendor prices
3. **Gold has value** - Meaningful sinks prevent inflation
4. **Market stability** - No extreme price crashes/spikes
5. **Accessible economy** - New players can participate

---

## Implementation Priority
1. ✅ Base item valuation (Done)
2. ✅ Vendor prices (Done)
3. ⏳ Direct trading / gifting (Current)
4. 🔜 Auction house (Next)
5. 🔜 Mail system
6. 🔜 Guild bank
