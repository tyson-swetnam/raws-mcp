import logger from '../logger.js';
import config from '../config.js';

/**
 * In-memory cache with TTL (Time To Live) support
 * Different cache TTLs based on data volatility:
 * - Current observations: 5 minutes (RAWS updates every 15-60 min)
 * - Station metadata: 1 hour (rarely changes)
 * - Historical data: 24 hours (archival, doesn't change)
 * - NWS alerts: 5 minutes (time-sensitive)
 */
export class Cache {
  constructor() {
    this.store = new Map();
    this.maxSize = config.cacheMaxSize;
    this.defaultTTL = config.cacheTTL * 1000; // Convert to milliseconds

    // Start cleanup interval
    this.cleanupInterval = setInterval(
      () => this._cleanup(),
      config.cacheCleanupInterval * 1000
    );

    logger.info('Cache initialized', {
      maxSize: this.maxSize,
      defaultTTL: this.defaultTTL,
      cleanupInterval: config.cacheCleanupInterval
    });
  }

  /**
   * Get value from cache
   * @param {string} key - Cache key
   * @returns {any|null} Cached value or null if not found/expired
   */
  get(key) {
    const entry = this.store.get(key);

    if (!entry) {
      logger.debug('Cache miss', { key });
      return null;
    }

    // Check if expired
    if (Date.now() > entry.expiresAt) {
      logger.debug('Cache expired', { key });
      this.store.delete(key);
      return null;
    }

    logger.debug('Cache hit', { key, age: Date.now() - entry.createdAt });
    entry.hits++;
    entry.lastAccessed = Date.now();
    return entry.value;
  }

  /**
   * Set value in cache with optional TTL
   * @param {string} key - Cache key
   * @param {any} value - Value to cache
   * @param {number} ttl - Time to live in milliseconds (optional)
   */
  set(key, value, ttl = null) {
    // Enforce max size with LRU eviction
    if (this.store.size >= this.maxSize && !this.store.has(key)) {
      this._evictLRU();
    }

    const now = Date.now();
    const entry = {
      value,
      createdAt: now,
      lastAccessed: now,
      expiresAt: now + (ttl || this.defaultTTL),
      hits: 0
    };

    this.store.set(key, entry);
    logger.debug('Cache set', {
      key,
      ttl: ttl || this.defaultTTL,
      size: this.store.size
    });
  }

  /**
   * Check if key exists and is not expired
   * @param {string} key - Cache key
   * @returns {boolean}
   */
  has(key) {
    const entry = this.store.get(key);
    if (!entry) return false;
    if (Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return false;
    }
    return true;
  }

  /**
   * Delete entry from cache
   * @param {string} key - Cache key
   */
  delete(key) {
    const deleted = this.store.delete(key);
    if (deleted) {
      logger.debug('Cache delete', { key });
    }
    return deleted;
  }

  /**
   * Clear all cache entries
   */
  clear() {
    const size = this.store.size;
    this.store.clear();
    logger.info('Cache cleared', { entriesRemoved: size });
  }

  /**
   * Get cache statistics
   * @returns {Object} Cache statistics
   */
  getStats() {
    const entries = Array.from(this.store.values());
    const now = Date.now();

    return {
      size: this.store.size,
      maxSize: this.maxSize,
      totalHits: entries.reduce((sum, e) => sum + e.hits, 0),
      activeEntries: entries.filter(e => now < e.expiresAt).length,
      expiredEntries: entries.filter(e => now >= e.expiresAt).length
    };
  }

  /**
   * Clean up expired entries
   * @private
   */
  _cleanup() {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.store.entries()) {
      if (now > entry.expiresAt) {
        this.store.delete(key);
        removed++;
      }
    }

    if (removed > 0) {
      logger.debug('Cache cleanup', {
        removed,
        remaining: this.store.size
      });
    }
  }

  /**
   * Evict least recently used entry
   * @private
   */
  _evictLRU() {
    let oldestKey = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.store.entries()) {
      if (entry.lastAccessed < oldestTime) {
        oldestTime = entry.lastAccessed;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.store.delete(oldestKey);
      logger.debug('Cache LRU eviction', { key: oldestKey });
    }
  }

  /**
   * Destroy cache and cleanup interval
   */
  destroy() {
    clearInterval(this.cleanupInterval);
    this.clear();
    logger.info('Cache destroyed');
  }
}

// Create singleton instance
const cache = new Cache();

export default cache;
