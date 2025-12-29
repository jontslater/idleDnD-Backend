/**
 * Quota Retry Utility
 * 
 * Handles Firestore quota errors with exponential backoff retry logic.
 * This helps when hitting rate limits (per second) on Blaze plan.
 */

/**
 * Check if an error is a Firestore quota/rate limit error
 */
export function isQuotaError(error) {
  return (
    error.code === 8 ||
    error.code === 'RESOURCE_EXHAUSTED' ||
    error.message?.includes('Quota exceeded') ||
    error.message?.includes('RESOURCE_EXHAUSTED') ||
    error.message?.includes('rate limit') ||
    error.message?.includes('too many requests')
  );
}

/**
 * Retry a function with exponential backoff on quota errors
 * @param {Function} fn - Async function to retry
 * @param {Object} options - Retry options
 * @param {number} options.maxRetries - Maximum number of retries (default: 3)
 * @param {number} options.initialDelay - Initial delay in ms (default: 1000)
 * @param {number} options.maxDelay - Maximum delay in ms (default: 10000)
 * @param {number} options.multiplier - Backoff multiplier (default: 2)
 * @param {Function} options.shouldRetry - Custom function to determine if error should be retried
 * @returns {Promise} Result of the function
 */
export async function retryWithBackoff(fn, options = {}) {
  const {
    maxRetries = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    multiplier = 2,
    shouldRetry = isQuotaError
  } = options;

  let lastError;
  let delay = initialDelay;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;

      // Don't retry if it's not a quota error or we've exhausted retries
      if (!shouldRetry(error) || attempt >= maxRetries) {
        throw error;
      }

      // Log retry attempt
      console.warn(
        `[QuotaRetry] ⚠️ Quota error on attempt ${attempt + 1}/${maxRetries + 1}, ` +
        `retrying in ${delay}ms... (Error: ${error.message || error.code})`
      );

      // Wait with exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));

      // Increase delay for next retry (capped at maxDelay)
      delay = Math.min(delay * multiplier, maxDelay);
    }
  }

  throw lastError;
}

/**
 * Wrap a Firestore operation with quota retry logic
 * @param {Function} operation - Firestore operation to wrap
 * @param {Object} retryOptions - Options for retryWithBackoff
 * @returns {Promise} Result of the operation
 */
export async function withQuotaRetry(operation, retryOptions = {}) {
  return retryWithBackoff(operation, {
    maxRetries: 3,
    initialDelay: 1000, // Start with 1 second
    maxDelay: 5000, // Cap at 5 seconds
    multiplier: 2,
    ...retryOptions
  });
}

/**
 * Batch multiple operations with quota retry
 * If any operation fails with quota error, retry the entire batch
 */
export async function batchWithQuotaRetry(operations, retryOptions = {}) {
  return retryWithBackoff(async () => {
    const results = await Promise.all(operations.map(op => op()));
    return results;
  }, retryOptions);
}





