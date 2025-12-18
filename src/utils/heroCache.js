/**
 * Hero Data Cache Utility
 * 
 * In-memory cache for hero data to reduce Firestore reads.
 * This is the biggest optimization for read reduction (10-20x improvement).
 */

class HeroCache {
  constructor(options = {}) {
    this.cache = new Map(); // Map<heroId, {data, expiresAt}>
    this.ttl = options.ttl || 60 * 1000; // 60 seconds default
    this.maxSize = options.maxSize || 1000; // Max cached heroes
  }

  /**
   * Get hero from cache or return null
   * @param {string} heroId - Hero document ID
   * @returns {Object|null} Cached hero data or null
   */
  get(heroId) {
    const cached = this.cache.get(heroId);
    if (!cached) {
      return null;
    }

    // Check if expired
    if (Date.now() > cached.expiresAt) {
      this.cache.delete(heroId);
      return null;
    }

    return cached.data;
  }

  /**
   * Set hero in cache
   * @param {string} heroId - Hero document ID
   * @param {Object} heroData - Hero data to cache
   */
  set(heroId, heroData) {
    // Evict oldest entries if cache is full
    if (this.cache.size >= this.maxSize) {
      // Remove oldest entry (first in Map)
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(heroId, {
      data: heroData,
      expiresAt: Date.now() + this.ttl
    });
  }

  /**
   * Invalidate cache for a hero (remove from cache)
   * @param {string} heroId - Hero document ID
   */
  invalidate(heroId) {
    this.cache.delete(heroId);
  }

  /**
   * Clear all cached heroes
   */
  clear() {
    this.cache.clear();
  }

  /**
   * Get cache stats
   * @returns {Object} Cache statistics
   */
  getStats() {
    const now = Date.now();
    let valid = 0;
    let expired = 0;

    for (const [key, value] of this.cache.entries()) {
      if (now > value.expiresAt) {
        expired++;
        this.cache.delete(key);
      } else {
        valid++;
      }
    }

    return {
      total: this.cache.size,
      valid,
      expired,
      maxSize: this.maxSize
    };
  }
}

// Singleton instance
let heroCacheInstance = null;

/**
 * Get or create the singleton HeroCache instance
 */
export function getHeroCache() {
  if (!heroCacheInstance) {
    heroCacheInstance = new HeroCache({
      ttl: parseInt(process.env.HERO_CACHE_TTL_MS || '60000', 10), // 60 seconds default
      maxSize: parseInt(process.env.HERO_CACHE_MAX_SIZE || '1000', 10)
    });
  }
  return heroCacheInstance;
}

/**
 * Cache hero by Twitch User ID (for lookups by twitchUserId)
 */
class HeroByTwitchIdCache {
  constructor(options = {}) {
    this.cache = new Map(); // Map<twitchUserId, {heroId, expiresAt}>
    this.ttl = options.ttl || 60 * 1000; // 60 seconds default
    this.maxSize = options.maxSize || 500; // Max cached mappings
  }

  get(twitchUserId) {
    const cached = this.cache.get(twitchUserId);
    if (!cached) {
      return null;
    }

    if (Date.now() > cached.expiresAt) {
      this.cache.delete(twitchUserId);
      return null;
    }

    return cached.heroId;
  }

  set(twitchUserId, heroId) {
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(twitchUserId, {
      heroId,
      expiresAt: Date.now() + this.ttl
    });
  }

  invalidate(twitchUserId) {
    this.cache.delete(twitchUserId);
  }

  clear() {
    this.cache.clear();
  }
}

let heroByTwitchIdCacheInstance = null;

export function getHeroByTwitchIdCache() {
  if (!heroByTwitchIdCacheInstance) {
    heroByTwitchIdCacheInstance = new HeroByTwitchIdCache({
      ttl: parseInt(process.env.HERO_CACHE_TTL_MS || '60000', 10),
      maxSize: parseInt(process.env.HERO_CACHE_MAX_SIZE || '500', 10)
    });
  }
  return heroByTwitchIdCacheInstance;
}

export { HeroCache, HeroByTwitchIdCache };

