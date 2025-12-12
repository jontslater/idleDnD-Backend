# Auction House Test Script

Comprehensive test suite for auction house functionality.

## Usage

```bash
# Optional: Set API URL (defaults to http://localhost:3001)
export API_URL="http://localhost:3001"

# Run tests (automatically finds heroes for "theneverendingwar" and "tehchno")
npm run test-auction-house
```

The script automatically looks up hero IDs for:
- **Seller**: `theneverendingwar`
- **Buyer**: `tehchno`

If you need to test with different heroes, modify the `TEST_SELLER_USERNAME` and `TEST_BUYER_USERNAME` constants in the script.

## Tests Performed

### 1. Create Listing
- ✅ Creates a listing with an item from seller's inventory
- ✅ Verifies listing fee is deducted (WoW-style: % of vendor price based on duration)
- ✅ Verifies item(s) are removed from seller's inventory
- ✅ Supports both single items and stacked items (quantity > 1)

### 2. Place Bid
- ✅ Places a bid on an active listing
- ✅ Verifies currency is deducted from bidder
- ✅ Verifies previous highest bidder is refunded (if exists)
- ✅ Verifies listing's highest bid and bid count are updated

### 3. Buyout
- ✅ Executes buyout for an active listing
- ✅ Verifies buyer currency is deducted
- ✅ Verifies seller receives payment (minus 5% transaction fee)
- ✅ Verifies all bidders are refunded
- ✅ Verifies item(s) are added to buyer's inventory
- ✅ Verifies listing status is set to "sold"
- ✅ Handles stacked items correctly (quantity > 1)

### 4. Cancel Listing
- ✅ Cancels an active listing
- ✅ Verifies item is returned to seller's inventory
- ✅ Verifies listing fee is NOT refunded (WoW-style mechanic)
- ✅ Verifies listing status is set to "cancelled"

## What Gets Verified

### Item Transfers
- Items are correctly removed from seller inventory when listing is created
- Items are correctly added to buyer inventory when buyout completes
- Items are correctly returned to seller inventory when listing is cancelled
- Stacked items (quantity > 1) are handled correctly

### Payment Transfers
- Listing fees are correctly calculated and deducted (15% for 12h, 30% for 24h, 60% for 48h)
- Bids correctly deduct currency from bidder
- Previous bidders are refunded when outbid or on buyout
- Buyout correctly transfers payment to seller (minus 5% transaction fee)
- Listing fees are NOT refunded on cancellation (as per WoW mechanics)

### Listing Status
- Listings are created with "active" status
- Listings are marked as "sold" after buyout
- Listings are marked as "cancelled" after cancellation
- Bid information is correctly tracked

## Notes

- The script requires two different hero IDs (seller and buyer) to test full functionality
- If you only have one hero, some tests will be skipped
- Make sure both heroes have sufficient currency and inventory items for testing
- The script uses the actual API endpoints, so make sure your backend server is running







