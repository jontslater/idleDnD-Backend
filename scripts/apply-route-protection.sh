#!/bin/bash
# Batch apply route protection to all files

cd /workspace/src/routes

# purchases.js
echo "Protecting purchases.js..."
sed -i "s|router.post('/founders-pack', async|router.post('/founders-pack', requireAuth, async|" purchases.js
sed -i "s|router.post('/token-pack', async|router.post('/token-pack', requireAuth, async|" purchases.js
sed -i "s|router.post('/create-checkout-session', async|router.post('/create-checkout-session', requireAuth, async|" purchases.js
sed -i "s|router.get('/status/:purchaseId', async|router.get('/status/:purchaseId', requireAuth, async|" purchases.js
sed -i "s|router.get('/history/:userId', async|router.get('/history/:userId', requireAuth, requireOwnership, async|" purchases.js
sed -i "s|router.get('/:purchaseId/details', async|router.get('/:purchaseId/details', requireAuth, async|" purchases.js
sed -i "s|router.post('/set-founder', async|router.post('/set-founder', requireAdmin, async|" purchases.js
sed -i "s|router.post('/remove-founder', async|router.post('/remove-founder', requireAdmin, async|" purchases.js

# mail.js
echo "Protecting mail.js..."
sed -i "s|router.post('/send', async|router.post('/send', requireAuth, async|" mail.js
sed -i "s|router.get('/:userId', async|router.get('/:userId', requireAuth, requireOwnership, async|" mail.js
sed -i "s|router.post('/:mailId/read', async|router.post('/:mailId/read', requireAuth, async|" mail.js
sed -i "s|router.post('/:mailId/claim', async|router.post('/:mailId/claim', requireAuth, async|" mail.js
sed -i "s|router.delete('/:mailId', async|router.delete('/:mailId', async|" mail.js

# auction.js
echo "Protecting auction.js..."
sed -i "s|router.post('/list', async|router.post('/list', requireAuth, async|" auction.js
sed -i "s|router.post('/:listingId/bid', async|router.post('/:listingId/bid', requireAuth, async|" auction.js
sed -i "s|router.post('/:listingId/buyout', async|router.post('/:listingId/buyout', requireAuth, async|" auction.js
sed -i "s|router.post('/:listingId/cancel', async|router.post('/:listingId/cancel', requireAuth, async|" auction.js
sed -i "s|router.get('/my-listings/:userId', async|router.get('/my-listings/:userId', requireAuth, requireOwnership, async|" auction.js
sed -i "s|router.get('/my-bids/:userId', async|router.get('/my-bids/:userId', requireAuth, requireOwnership, async|" auction.js
sed -i "s|router.get('/history/:userId', async|router.get('/history/:userId', requireAuth, requireOwnership, async|" auction.js

echo "Protection script complete - verify with npm test"
