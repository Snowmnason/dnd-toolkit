import { QueryCache } from "@/lib/middleware/storage/helpers/query-cache";
import { logger } from "@/lib/utils";

/**
 * Request Cache Integration
 *
 * Provides cache-first read and post-fetch persistence for API requests.
 * Wraps QueryCache with request-specific logic:
 * - Check cache before network (return fresh, revalidate stale)
 * - Persist successful results after fetch
 * - Version-aware writes to prevent race conditions
 *
 * Does NOT own the cache — delegates to QueryCache for actual storage.
 */

// ─── Types ─────────────────────────────────────────────────────────

export interface CacheReadResult<T> {
  /** Whether data was found in cache */
  hit: boolean;
  /** Cached data (undefined if miss) */
  data?: T;
  /** Whether cache data is stale and should be revalidated */
  stale: boolean;
}

export interface CacheWriteOptions {
  /** Stale time in ms (how long before data is considered stale) */
  staleTime?: number;
  /** Cache time in ms (how long before data is evicted entirely) */
  cacheTime?: number;
  /** Tags for cache invalidation (e.g., ['worlds', 'user:123']) */
  tags?: string[];
}

// ─── Cache Operations ──────────────────────────────────────────────

export const RequestCache = {
  /**
   * Check cache for a key before making a network request.
   *
   * Returns:
   * - `{ hit: true, stale: false, data }` → Use cached data, skip fetch
   * - `{ hit: true, stale: true, data }` → Return cached data, revalidate in background
   * - `{ hit: false, stale: false }` → No cache, must fetch
   *
   * @param key Cache key (typically the enriched request URL/key)
   */
  async read<T>(key: string): Promise<CacheReadResult<T>> {
    try {
      const cached = await QueryCache.get<T>(key);

      if (cached !== undefined && cached !== null) {
        const isStale = await QueryCache.isStale(key);

        if (!isStale) {
          logger.category('api').debug("Cache hit (fresh):", { key });
          return { hit: true, stale: false, data: cached };
        }

        logger.category('api').debug("Cache hit (stale, will revalidate):", { key });
        return { hit: true, stale: true, data: cached };
      }

      return { hit: false, stale: false };
    } catch (error) {
      logger.category('api').warn("Cache read error:", { key, error });
      // On read failure, treat as cache miss
      return { hit: false, stale: false };
    }
  },

  /**
   * Persist a successful fetch result to cache.
   * Uses version tracking to prevent race conditions (stale writes from
   * slower requests don't overwrite fresher data).
   *
   * @param key Cache key
   * @param data Data to persist
   * @param options Cache options (staleTime, cacheTime, tags)
   */
  async write<T>(key: string, data: T, options?: CacheWriteOptions): Promise<void> {
    try {
      // Capture version at write time for race condition prevention
      const versionAtStart = QueryCache.getCurrentVersion();

      await QueryCache.set(
        key,
        data,
        {
          staleTime: options?.staleTime,
          cacheTime: options?.cacheTime,
          tags: options?.tags,
        },
        versionAtStart,
      );

      logger.category('api').debug("Persisted to cache:", { key });
    } catch (error) {
      logger.category('api').warn("Cache write failed:", { key, error });
      // Don't throw — cache persistence failure shouldn't break the request
    }
  },

  /**
   * Wrap a fetch promise with cache persistence.
   * On success: writes result to cache, returns result.
   * On failure: rethrows error (don't cache errors).
   *
   * @param key Cache key
   * @param promise The fetch promise to wrap
   * @param options Cache options (staleTime, cacheTime, tags)
   * @returns The original promise result
   */
  wrapWithPersistence<T>(
    key: string,
    promise: Promise<T>,
    options?: CacheWriteOptions,
  ): Promise<T> {
    return promise.then(
      async (result: T) => {
        await this.write(key, result, options);
        return result;
      },
      (error) => {
        // On error, just rethrow — don't cache errors
        throw error;
      },
    );
  },
};
