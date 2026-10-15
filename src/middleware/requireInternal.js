/**
 * Internal API Authentication Middleware
 * For routes that should only be called by backend services, not HTTP clients
 * Uses INTERNAL_API_KEY environment variable with timing-safe comparison
 */

import crypto from 'crypto';

/**
 * Verify internal API key for backend-to-backend routes
 * Requires X-Internal-Key header matching INTERNAL_API_KEY env var
 */
export const requireInternal = (req, res, next) => {
  const internalKey = req.headers['x-internal-key'];
  const expectedKey = process.env.INTERNAL_API_KEY;
  
  if (!expectedKey) {
    return res.status(503).json({ 
      error: 'Internal API disabled (INTERNAL_API_KEY not configured)' 
    });
  }
  
  if (!internalKey) {
    return res.status(401).json({ error: 'Internal API authentication required' });
  }
  
  // Timing-safe comparison to prevent timing attacks
  try {
    const isValid = crypto.timingSafeEqual(
      Buffer.from(internalKey),
      Buffer.from(expectedKey)
    );
    
    if (!isValid) {
      return res.status(403).json({ error: 'Invalid internal API credentials' });
    }
  } catch (error) {
    // Length mismatch or other error
    return res.status(403).json({ error: 'Invalid internal API credentials' });
  }
  
  next();
};
