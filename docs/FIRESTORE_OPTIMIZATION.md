# Firestore Quota Optimization Guide

## Current Status
- **Plan**: Blaze (Pay-as-you-go)
- **Issue**: Still hitting quota exceeded errors
- **Likely Cause**: Rate limits (per second) rather than daily quotas

## Blaze Plan Limits
- **Reads**: 10,000/second (per database)
- **Writes**: 10,000/second (per database)
- **Deletes**: 10,000/second (per database)
- **Daily**: Unlimited (pay-as-you-go)

## Optimizations Implemented

### 1. Removed Unnecessary `updatedAt` Timestamps
- **Impact**: Reduces writes by ~30-40%
- **Files Modified**:
  - `src/routes/heroes.js` - Removed from frequent updates
  - `src/routes/auth.js` - Removed from login updates
  - `src/routes/quests.js` - Removed from quest progress updates
  - `src/routes/professions.js` - Removed from profession updates

### 2. Increased Periodic Update Intervals
- **Periodic Chat Updates**: 5 minutes → 15 minutes
- **Quest Reset Checks**: 1 hour (unchanged)
- **Write Batcher**: 5 seconds → 10 seconds

### 3. Added In-Memory Caching
- **Quest Cache**: 5-minute TTL for daily/weekly/monthly quests
- **Streamer Settings Cache**: 10-minute TTL
- **Username Cache**: 10-minute TTL

### 4. Graceful Quota Error Handling
- **Auth Route**: Allows login even if hero lookup fails
- **Hero Lookup**: Returns 404 or empty array instead of 500
- **Quest Service**: Returns cached data when quota exceeded

### 5. Write Batching Utility
- **Location**: `src/utils/writeBatcher.js`
- **Features**:
  - Batches multiple writes into single operations
  - Debounces writes (10-second default interval)
  - Max 20 writes per batch
  - Automatic flushing

### 6. Quota Retry Logic
- **Location**: `src/utils/quotaRetry.js`
- **Features**:
  - Exponential backoff (1s → 2s → 4s → 8s)
  - Max 3 retries
  - Automatic retry on quota errors
  - Can be applied to any Firestore operation

## If Still Hitting Quota Errors

### Immediate Actions:
1. **Verify Billing**: Ensure Firebase project is linked to active billing account
   - Go to: [Google Cloud Console](https://console.cloud.google.com/billing)
   - Check: Firebase project → Settings → Billing

2. **Check Rate Limits**: Monitor per-second operations
   - Go to: Firebase Console → Firestore → Usage
   - Look for: Spikes in reads/writes per second

3. **Wait for Quota Reset**: 
   - Rate limits reset immediately (per second)
   - Daily quotas reset at midnight Pacific Time
   - If you just upgraded to Blaze, wait 5-10 minutes for billing to activate

### Further Optimizations (If Needed):

1. **Disable Periodic Updates Temporarily**:
   ```bash
   # Set environment variable
   CHAT_UPDATE_INTERVAL_MINUTES=60  # Increase to 1 hour
   ```

2. **Increase Write Batcher Interval**:
   ```bash
   WRITE_BATCH_INTERVAL_MS=30000  # 30 seconds
   WRITE_BATCH_SIZE=50  # Larger batches
   ```

3. **Add More Aggressive Caching**:
   - Increase cache TTLs
   - Cache hero data in memory
   - Cache quest progress locally

4. **Reduce Real-Time Listeners**:
   - Check for `.onSnapshot()` calls
   - Replace with polling if possible
   - Use WebSockets instead of Firestore listeners

## Monitoring

### Check Current Usage:
```bash
# Firebase Console → Firestore → Usage
# Look for:
# - Reads per second
# - Writes per second
# - Daily totals
```

### Enable Detailed Logging:
```bash
# Add to .env
DEBUG_FIRESTORE=true
```

## Cost Estimate (Blaze Plan)
- **Reads**: $0.06 per 100,000 reads
- **Writes**: $0.18 per 100,000 writes
- **Deletes**: $0.02 per 100,000 deletes

**Example Monthly Cost** (if hitting free tier limits):
- 50k reads/day = $0.90/month
- 20k writes/day = $1.08/month
- **Total**: ~$2/month

## Next Steps
1. Monitor usage for 24 hours after optimizations
2. If still hitting limits, increase intervals further
3. Consider implementing Redis cache for frequently accessed data
4. Review all `.get()` and `.where()` queries for optimization opportunities





