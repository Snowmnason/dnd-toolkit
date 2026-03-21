import { logger } from "@/lib/utils";
import { FastCache } from "@/system/Storage/";

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
// Helper Functions
// ==========================================

/**
 * Escape special regex characters in a string to prevent ReDoS attacks
 */
function escapeRegexChars(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ==========================================
// Types
// ==========================================

/**
 * Revalidation strategy type for cache invalidation
 * - 'immediate': Show loading state, wait for fresh data (blocks UI during refetch)
 * - 'background': Return stale data immediately, refetch in background (SWR)
 * - 'keep-stale': Keep stale data without auto-refetch (manual refetch only)
 */
export type RevalidationStrategy = 'immediate' | 'background' | 'keep-stale';

/**
 * Options for cache invalidation operations
 */
export interface InvalidateOptions {
  /** Revalidation strategy (documents intent; actual behavior controlled by useQuery hooks) */
  strategy?: RevalidationStrategy;
}

export interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  staleTime: number; // How long until stale (ms)
  cacheTime: number; // How long to keep in cache (ms)
  tags?: string[]; // Tags for invalidation
  version?: number; // Version number for race condition prevention
}

export interface CacheOptions {
  staleTime?: number; // Default: 2 hours
  cacheTime?: number; // Default: 4 hours
  tags?: string[]; // Tags for invalidation
}

export interface QueryCacheConfig {
  defaultStaleTime: number; // 2 hours
  defaultCacheTime: number; // 4 hours
  maxEntries: number; // Prevent unbounded growth
}

type CacheSubscriber = (key: string, data: any) => void;

// ==========================================
// Configuration
// ==========================================

const DEFAULT_CONFIG: QueryCacheConfig = {
  defaultStaleTime: 2 * 60 * 60 * 1000, // 2 hours
  defaultCacheTime: 4 * 60 * 60 * 1000, // 4 hours
  maxEntries: 500, // Max 500 cached queries
};

// ==========================================
// Query Cache Class
// ==========================================

class QueryCacheClass {
  private config: QueryCacheConfig = DEFAULT_CONFIG;
  private inMemoryCache: Map<string, CacheEntry> = new Map();
  private subscribers: Map<string, Set<CacheSubscriber>> = new Map();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  private globalVersion: number = 0;
  private pendingRequests: Map<string, Promise<any>> = new Map();

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
        const retrieved = await FastCache.getJSON<CacheEntry<T>>(storageKey);
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
        logger.category('storage').debug(`Cache expired for key: ${key}`);
        await this.remove(key);
        return null;
      }

      return entry.data;
    } catch (error) {
      logger.category('storage').error(`Error reading cache for ${key}:`, error);
      return null;
    }
  }

  /**
   * Set cached data for a query key
   *
   * @param key - Cache key
   * @param data - Data to cache
   * @param options - Cache options (staleTime, cacheTime, tags, version)
   * @param requestVersion - Optional version from when request started.
   *                         If provided and is less than current globalVersion,
   *                         the set is rejected (invalidation occurred during request)
   */
  async set<T>(
    key: string,
    data: T,
    options: CacheOptions = {},
    requestVersion?: number,
  ): Promise<void> {
    try {
      // Race condition prevention: Check if invalidation happened during request
      if (requestVersion !== undefined && requestVersion < this.globalVersion) {
        logger.category('storage').debug(`Stale version for ${key}, discarding result`, {
          requestVersion,
          currentVersion: this.globalVersion,
        });
        return; // Don't cache stale data
      }

      const entry: CacheEntry<T> = {
        data,
        timestamp: Date.now(),
        staleTime: options.staleTime ?? this.config.defaultStaleTime,
        cacheTime: options.cacheTime ?? this.config.defaultCacheTime,
        tags: options.tags,
        version: this.globalVersion,
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

      logger.category('storage').debug(`Cached data for key: ${key}`, {
        tags: entry.tags,
        staleTime: entry.staleTime,
        version: entry.version,
      });
    } catch (error) {
      logger.category('storage').error(`Error setting cache for ${key}:`, error);
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
   * Fetch with deduplication - prevents duplicate API calls for the same key
   * If a request for this key is already in progress, returns the existing promise
   */
  async fetchWithDedupe<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    if (this.pendingRequests.has(key)) {
      logger.category('storage').debug(`Deduplicating request for key: ${key}`);
      return this.pendingRequests.get(key)!;
    }

    const promise = fetcher().finally(() => {
      this.pendingRequests.delete(key);
    });

    this.pendingRequests.set(key, promise);
    return promise;
  }

  /**
   * Apply optimistic update to cache and return revert function
   * Used for instant UI feedback before mutations complete
   *
   * @param updater - Function that transforms cached data
   * @param options - Optional filters to target specific cache entries
   * @param options.tags - Only update entries with these tags
   * @param options.keyPattern - Only update entries matching this pattern
   */
  applyOptimisticUpdate(
    updater: (prev: any) => any,
    options?: { tags?: string[]; keyPattern?: RegExp },
  ): () => void {
    const affectedKeys: string[] = [];
    const previousValues: Map<string, any> = new Map();

    for (const [key, entry] of this.inMemoryCache.entries()) {
      // Filter by tags if specified
      if (options?.tags && entry.tags) {
        const hasMatchingTag = entry.tags.some((tag) =>
          options.tags!.includes(tag),
        );
        if (!hasMatchingTag) continue;
      }

      // Filter by key pattern if specified
      if (options?.keyPattern && !options.keyPattern.test(key)) {
        continue;
      }

      const newValue = updater(entry.data);
      if (newValue !== entry.data) {
        affectedKeys.push(key);
        previousValues.set(key, entry.data);

        // Apply optimistic update
        const optimisticEntry: CacheEntry = {
          ...entry,
          data: newValue,
          timestamp: Date.now(), // Update timestamp to prevent immediate staleness
        };

        this.inMemoryCache.set(key, optimisticEntry);
        this.notifySubscribers(key, newValue);

        logger.category('storage').debug(`Applied optimistic update for key: ${key}`);
      }
    }

    // Return revert function
    return () => {
      for (const key of affectedKeys) {
        const previousValue = previousValues.get(key);
        if (previousValue !== undefined) {
          const entry = this.inMemoryCache.get(key);
          if (entry) {
            const revertedEntry: CacheEntry = {
              ...entry,
              data: previousValue,
            };
            this.inMemoryCache.set(key, revertedEntry);
            this.notifySubscribers(key, previousValue);
            logger.category('storage').debug(`Reverted optimistic update for key: ${key}`);
          }
        }
      }
    };
  }

  /**
   * Remove a specific cache entry
   */
  async remove(key: string): Promise<void> {
    try {
      this.inMemoryCache.delete(key);
      const storageKey = this.toCacheKey(key);
      await FastCache.removeItem(storageKey);
      logger.category('storage').debug(`Removed cache for key: ${key}`);
    } catch (error) {
      logger.category('storage').error(`Error removing cache for ${key}:`, error);
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
        keys.map((key) => FastCache.removeItem(this.toCacheKey(key))),
      );

      logger.category('storage').info("Cleared all query cache");
    } catch (error) {
      logger.category('storage').error("Error clearing cache:", error);
    }
  }

  // ==========================================
  // Invalidation Operations
  // ==========================================

  /**
   * Get the current global version number
   * Used by queries to detect if invalidation occurred during their request
   */
  getCurrentVersion(): number {
    return this.globalVersion;
  }

  /**
   * Invalidate cache entries by tags
   * Example: invalidateByTags(['worlds', 'user:123'])
   *
   * @param tags - Tags to invalidate
   * @param options - Optional configuration (strategy for revalidation intent)
   *
   * Side effect: Increments global version to prevent stale writes
   * from in-flight requests
   */
  async invalidateByTags(
    tags: string[],
    options?: InvalidateOptions,
  ): Promise<void> {
    try {
      // Bump version to invalidate in-flight requests
      this.globalVersion++;

      const keysToInvalidate: string[] = [];

      for (const [key, entry] of this.inMemoryCache.entries()) {
        if (entry.tags && entry.tags.some((tag) => tags.includes(tag))) {
          keysToInvalidate.push(key);
        }
      }

      await Promise.all(keysToInvalidate.map((key) => this.remove(key)));

      logger.category('storage').info(
        `Invalidated ${keysToInvalidate.length} entries by tags`,
        {
          tags,
          strategy: options?.strategy || 'immediate',
          newVersion: this.globalVersion,
        },
      );
    } catch (error) {
      logger.category('storage').error("Error invalidating by tags:", error);
    }
  }

  /**
   * Invalidate cache entries by pattern (regex or string)
   * Example: invalidate(/^worlds:/) or invalidate('worlds:user:123')
   *
   * @param pattern - Pattern to match (string or regex)
   * @param options - Optional configuration (strategy for revalidation intent)
   *
   * Side effect: Increments global version to prevent stale writes
   * from in-flight requests
   */
  async invalidate(
    pattern: string | RegExp,
    options?: InvalidateOptions,
  ): Promise<void> {
    try {
      // Bump version to invalidate in-flight requests
      this.globalVersion++;

      let regex: RegExp;
      if (typeof pattern === "string") {
        // Escape special regex characters to prevent ReDoS attacks
        const escapedPattern = escapeRegexChars(pattern);
        /* eslint-disable-next-line security/detect-non-literal-regexp */
        regex = new RegExp(`^${escapedPattern}`);
      } else {
        regex = pattern;
      }
      const keysToInvalidate: string[] = [];

      for (const key of this.inMemoryCache.keys()) {
        if (regex.test(key)) {
          keysToInvalidate.push(key);
        }
      }

      await Promise.all(keysToInvalidate.map((key) => this.remove(key)));

      logger.category('storage').info(
        `Invalidated ${keysToInvalidate.length} entries by pattern`,
        {
          pattern: pattern.toString(),
          strategy: options?.strategy || 'immediate',
          newVersion: this.globalVersion,
        },
      );
    } catch (error) {
      logger.category('storage').error("Error invalidating by pattern:", error);
    }
  }

  /**
   * Invalidate cache entries older than a given duration
   * Used during recovery to clear stale data that may be inconsistent
   *
   * @param maxAgeMs - Maximum age in milliseconds (e.g., 2 * 60 * 60 * 1000 for 2 hours)
   * @returns Number of entries invalidated
   */
  async invalidateOlderThan(maxAgeMs: number): Promise<number> {
    try {
      // Bump version to invalidate in-flight requests
      this.globalVersion++;

      const now = Date.now();
      const keysToInvalidate: string[] = [];

      for (const [key, entry] of this.inMemoryCache.entries()) {
        const age = now - entry.timestamp;
        if (age > maxAgeMs) {
          keysToInvalidate.push(key);
        }
      }

      await Promise.all(keysToInvalidate.map((key) => this.remove(key)));

      logger.category('storage').info(
        `Invalidated ${keysToInvalidate.length} entries older than ${maxAgeMs}ms`,
        {
          maxAgeMs,
          newVersion: this.globalVersion,
        },
      );

      return keysToInvalidate.length;
    } catch (error) {
      logger.category('storage').error("Error invalidating old entries:", error);
      return 0;
    }
  }

  /**
   * Invalidate cache entries matching a predicate function
   * Provides fine-grained control over which entries to invalidate
   *
   * Example: Invalidate only entries related to a specific world
   * ```
   * await QueryCache.selectiveInvalidate(
   *   (key, entry) => key.includes(`world:${worldId}`),
   *   { strategy: 'immediate' }
   * );
   * ```
   *
   * Example: Invalidate by tag AND key pattern
   * ```
   * await QueryCache.selectiveInvalidate(
   *   (key, entry) => entry.tags?.includes('users') && key.startsWith('user:'),
   *   { strategy: 'background' }
   * );
   * ```
   *
   * @param predicate - Function that returns true for entries to invalidate
   * @param options - Optional configuration (strategy for revalidation intent)
   * @returns Number of entries invalidated
   *
   * Side effect: Increments global version to prevent stale writes
   * from in-flight requests. Strategy option documents the revalidation
   * intent and is logged; actual revalidation behavior is controlled by
   * the revalidationStrategy option in useQuery hooks.
   */
  async selectiveInvalidate(
    predicate: (key: string, entry: CacheEntry) => boolean,
    options?: InvalidateOptions,
  ): Promise<number> {
    try {
      // Bump version to invalidate in-flight requests
      this.globalVersion++;

      const keysToInvalidate: string[] = [];

      for (const [key, entry] of this.inMemoryCache.entries()) {
        try {
          if (predicate(key, entry)) {
            keysToInvalidate.push(key);
          }
        } catch (err) {
          logger.category('storage').error(
            `Error evaluating predicate for key "${key}":`,
            err,
          );
        }
      }

      await Promise.all(keysToInvalidate.map((key) => this.remove(key)));

      logger.category('storage').info(
        `Invalidated ${keysToInvalidate.length} entries by predicate`,
        {
          count: keysToInvalidate.length,
          strategy: options?.strategy || 'immediate',
          newVersion: this.globalVersion,
        },
      );

      return keysToInvalidate.length;
    } catch (error) {
      logger.category('storage').error("Error invalidating by predicate:", error);
      return 0;
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
      subs.forEach((callback) => callback(key, data));
    }
  }

  // ==========================================
  // Utility Methods
  // ==========================================

  /**
   * Clear all cache entries (for logout scenarios)
   * Removes all entries from both in-memory cache and persistent storage
   */
  async clearAll(): Promise<void> {
    try {
      const keys = Array.from(this.inMemoryCache.keys());
      await Promise.all(keys.map((key) => this.remove(key)));
      this.inMemoryCache.clear();
      this.subscribers.clear();
      logger.category('storage').info("Cleared all cache entries");
    } catch (error) {
        logger.category('storage').error("Error clearing all cache:", error);
    }
  }

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
      // eslint-disable-next-line security/detect-object-injection
      const keyToRemove = entries[i][0];
      await this.remove(keyToRemove);
    }

    logger.category('storage').debug(`Evicted ${toRemove} oldest cache entries`);
  }

  /**
   * Periodic cleanup of expired entries
   */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) return;

    this.cleanupTimer = setInterval(
      () => {
        this.cleanupExpired();
      },
      60 * 60 * 1000,
    ); // Every hour

    if (typeof this.cleanupTimer === "object" && "unref" in this.cleanupTimer) {
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

    await Promise.all(keysToRemove.map((key) => this.remove(key)));

    if (keysToRemove.length > 0) {
      logger.category('storage').info(`Cleaned up ${keysToRemove.length} expired cache entries`);
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
