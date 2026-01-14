import { FastCache } from '../storage';
import { logger } from '../utils/logger';

/**
 * Query Cache: Centralized cache with invalidation patterns
 * 
 * Features:
 * - Stale-While-Revalidate (SWR) pattern
 * - Tag-based invalidation (invalidate related queries)
 * - Pattern-based invalidation (invalidate by regex)
 * - Automatic staleness detection
 * - Subscriber notifications for cache updates
 */

// ==========================================
// Types
// ==========================================

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  staleTime: number; // How long until stale (ms)
  cacheTime: number; // How long to keep in cache (ms)
  tags?: string[]; // Tags for invalidation
}

export interface CacheOptions {
  staleTime?: number; // Default: 2 hours
  cacheTime?: number; // Default: 4 hours
  tags?: string[];    // Tags for invalidation
}

export interface QueryCacheConfig {
  defaultStaleTime: number; // 2 hours
  defaultCacheTime: number; // 4 hours
  maxEntries: number;       // Prevent unbounded growth
}

type CacheSubscriber = (key: string, data: any) => void;

// ==========================================
// Configuration
// ==========================================

const DEFAULT_CONFIG: QueryCacheConfig = {
  defaultStaleTime: 2 * 60 * 60 * 1000,  // 2 hours
  defaultCacheTime: 4 * 60 * 60 * 1000,  // 4 hours
  maxEntries: 500,                        // Max 500 cached queries
};

// ==========================================
// Query Cache Class
// ==========================================

class QueryCacheClass {
  private config: QueryCacheConfig = DEFAULT_CONFIG;
  private inMemoryCache: Map<string, CacheEntry> = new Map();
  private subscribers: Map<string, Set<CacheSubscriber>> = new Map();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.startCleanupTimer();
  }

  // ==========================================
  // Core Operations
  // ==========================================

  /**
   * Get cached data for a query key
   * Returns null if not found or expired
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      // Check in-memory cache first (fast)
      let entry = this.inMemoryCache.get(key) as CacheEntry<T> | undefined;

      // If not in memory, try FastCache
      if (!entry) {
        const storageKey = this.toCacheKey(key);
        entry = await FastCache.getJSON<CacheEntry<T>>(storageKey);
        if (retrieved) {
          entry = retrieved;
          // Restore to in-memory cache
          this.inMemoryCache.set(key, entry);
        }
      }

      if (!entry) {
        return null;
      }

      // Check if cache is expired (beyond cacheTime)
      const age = Date.now() - entry.timestamp;
      if (age > entry.cacheTime) {
        logger.debug('cache', `Cache expired for key: ${key}`);
        await this.remove(key);
        return null;
      }

      return entry.data;
    } catch (error) {
      logger.error('cache', `Error reading cache for ${key}:`, error);
      return null;
    }
  }

  /**
   * Set cached data for a query key
   */
  async set<T>(key: string, data: T, options: CacheOptions = {}): Promise<void> {
    try {
      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        staleTime: options.staleTime ?? this.config.defaultStaleTime,
        cacheTime: options.cacheTime ?? this.config.defaultCacheTime,
        tags: options.tags,
      };

      // Store in memory
      this.inMemoryCache.set(key, entry);

      // Persist to FastCache (unencrypted, fast)
      const storageKey = this.toCacheKey(key);
      await FastCache.setJSON(storageKey, entry);

      // Enforce max entries limit
      if (this.inMemoryCache.size > this.config.maxEntries) {
        await this.evictOldest();
      }

      // Notify subscribers
      this.notifySubscribers(key, data);

      logger.debug('cache', `Cached data for key: ${key}`, {
        tags: entry.tags,
        staleTime: entry.staleTime,
      });
    } catch (error) {
      logger.error('cache', `Error setting cache for ${key}:`, error);
    }
  }

  /**
   * Check if cached data is stale (but not expired)
   * Returns true if data should be revalidated
   */
  async isStale(key: string): Promise<boolean> {
    const entry = this.inMemoryCache.get(key);
    if (!entry) return true; // Not cached = stale

    const age = Date.now() - entry.timestamp;
    return age > entry.staleTime;
  }

  /**
   * Remove a specific cache entry
   */
  async remove(key: string): Promise<void> {
    try {
      this.inMemoryCache.delete(key);
      const storageKey = this.toCacheKey(key);
      await FastCache.removeItem(storageKey);
      logger.debug('cache', `Removed cache for key: ${key}`);
    } catch (error) {
      logger.error('cache', `Error removing cache for ${key}:`, error);
    }
  }

  /**
   * Clear all cache entries
   */
  async clear(): Promise<void> {
    try {
      const keys = Array.from(this.inMemoryCache.keys());
      this.inMemoryCache.clear();
      
      // Remove from FastCache
      await Promise.all(
        keys.map(key => FastCache.removeItem(this.toCacheKey(key)))
      );
      
      logger.info('cache', 'Cleared all query cache');
    } catch (error) {
      logger.error('cache', 'Error clearing cache:', error);
    }
  }

  // ==========================================
  // Invalidation Operations
  // ==========================================

  /**
   * Invalidate cache entries by tags
   * Example: invalidateByTags(['worlds', 'user:123'])
   */
  async invalidateByTags(tags: string[]): Promise<void> {
    try {
      const keysToInvalidate: string[] = [];

      for (const [key, entry] of this.inMemoryCache.entries()) {
        if (entry.tags && entry.tags.some(tag => tags.includes(tag))) {
          keysToInvalidate.push(key);
        }
      }

      await Promise.all(keysToInvalidate.map(key => this.remove(key)));

      logger.info('cache', `Invalidated ${keysToInvalidate.length} entries by tags`, { tags });
    } catch (error) {
      logger.error('cache', 'Error invalidating by tags:', error);
    }
  }

  /**
   * Invalidate cache entries by pattern (regex or string)
   * Example: invalidate(/^worlds:/) or invalidate('worlds:user:123')
   */
  async invalidate(pattern: string | RegExp): Promise<void> {
    try {
      let regex: RegExp;
      if (typeof pattern === 'string') {
        regex = new RegExp(`^${pattern}`);
      } else {
        regex = pattern;
      }
      const keysToInvalidate: string[] = [];

      for (const key of this.inMemoryCache.keys()) {
        if (regex.test(key)) {
          keysToInvalidate.push(key);
        }
      }

      await Promise.all(keysToInvalidate.map(key => this.remove(key)));

      logger.info('cache', `Invalidated ${keysToInvalidate.length} entries by pattern`, {
        pattern: pattern.toString(),
      });
    } catch (error) {
      logger.error('cache', 'Error invalidating by pattern:', error);
    }
  }

  // ==========================================
  // Subscription System (For Refetches)
  // ==========================================

  /**
   * Subscribe to cache updates for a specific key
   * Used by hooks to trigger re-renders when cache updates
   */
  subscribe(key: string, callback: CacheSubscriber): () => void {
    if (!this.subscribers.has(key)) {
      this.subscribers.set(key, new Set());
    }
    this.subscribers.get(key)!.add(callback);

    // Return unsubscribe function
    return () => {
      const subs = this.subscribers.get(key);
      if (subs) {
        subs.delete(callback);
        if (subs.size === 0) {
          this.subscribers.delete(key);
        }
      }
    };
  }

  /**
   * Notify all subscribers for a key that data has updated
   */
  private notifySubscribers(key: string, data: any): void {
    const subs = this.subscribers.get(key);
    if (subs) {
      subs.forEach(callback => callback(key, data));
    }
  }

  // ==========================================
  // Utility Methods
  // ==========================================

  /**
   * Convert query key to storage key
   */
  private toCacheKey(key: string): string {
    return `query_cache_${key}`;
  }

  /**
   * Evict oldest cache entries when limit is reached
   */
  private async evictOldest(): Promise<void> {
    const entries = Array.from(this.inMemoryCache.entries());
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

    const toRemove = Math.ceil(entries.length * 0.1); // Remove 10% oldest
    for (let i = 0; i < toRemove; i++) {
      const keyToRemove = entries[i][0];
      await this.remove(keyToRemove);
    }

    logger.debug('cache', `Evicted ${toRemove} oldest cache entries`);
  }

  /**
   * Periodic cleanup of expired entries
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) return;

    this.cleanupTimer = setInterval(() => {
      this.cleanupExpired();
    }, 60 * 60 * 1000); // Every hour

    if (typeof this.cleanupTimer === 'object' && 'unref' in this.cleanupTimer) {
      (this.cleanupTimer as any).unref();
    }
  }

  private async cleanupExpired(): Promise<void> {
    const now = Date.now();
    const keysToRemove: string[] = [];

    for (const [key, entry] of this.inMemoryCache.entries()) {
      const age = now - entry.timestamp;
      if (age > entry.cacheTime) {
        keysToRemove.push(key);
      }
    }

    await Promise.all(keysToRemove.map(key => this.remove(key)));

    if (keysToRemove.length > 0) {
      logger.info('cache', `Cleaned up ${keysToRemove.length} expired cache entries`);
    }
  }

  /**
   * Get debugging stats
   */
  getStats() {
    return {
      cacheSize: this.inMemoryCache.size,
      subscribers: this.subscribers.size,
      keys: Array.from(this.inMemoryCache.keys()),
    };
  }
}

// Export singleton instance
export const QueryCache = new QueryCacheClass();
export default QueryCache;
