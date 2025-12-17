/**
 * Battlefield Query Cache Utility
 * 
 * Caches battlefield hero lists to reduce duplicate Firestore queries.
 */

class BattlefieldCache {
  constructor(options = {}) {
    this.cache = new Map(); // Map<battlefieldId, {heroes, expiresAt}>
    this.ttl = options.ttl || 30 * 1000; // 30 seconds default (battlefields change frequently)
    this.maxSize = options.maxSize || 100; // Max cached battlefields
  }

  /**
   * Get heroes for a battlefield from cache
   * @param {string} battlefieldId - Battlefield ID
   * @returns {Array|null} Cached heroes array or null
   */
  get(battlefieldId) {
    const cached = this.cache.get(battlefieldId);
    if (!cached) {
      return null;
    }

    // Check if expired
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(battlefieldId);
      return null;
    }

    return cached.heroes;
  }

  /**
   * Set heroes for a battlefield in cache
   * @param {string} battlefieldId - Battlefield ID
   * @param {Array} heroes - Heroes array to cache
   */
  set(battlefieldId, heroes) {
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(battlefieldId, {
      heroes,
      expiresAt: Date.now() + this.ttl
    });
  }

  /**
   * Invalidate cache for a battlefield (remove from cache)
   * @param {string} battlefieldId - Battlefield ID
   */
  invalidate(battlefieldId) {
    this.cache.delete(battlefieldId);
  }

  /**
   * Clear all cached battlefields
   */
  clear() {
    this.cache.clear();
  }
}

// Singleton instance
let battlefieldCacheInstance = null;

/**
 * Get or create the singleton BattlefieldCache instance
 */
export function getBattlefieldCache() {
  if (!battlefieldCacheInstance) {
    battlefieldCacheInstance = new BattlefieldCache({
      ttl: parseInt(process.env.BATTLEFIELD_CACHE_TTL_MS || '30000', 10), // 30 seconds default
      maxSize: parseInt(process.env.BATTLEFIELD_CACHE_MAX_SIZE || '100', 10)
    });
  }
  return battlefieldCacheInstance;
}

export { BattlefieldCache };

