import { logger } from "@/lib/utils";
import { FastCache } from "@/system/Storage/";
import type {
  CacheEntry,
  CacheOptions,
} from "@/type-definitions";
import {
  decode as decodeCompression,
  encode as encodeCompression,
  type CompressionEncodeOptions,
} from "../../compression/compression-middleware";
import { measureEntrySize } from "../lru-eviction";
import type { CacheSubscriber, QueryCacheInternals } from "./internals";

/**
 * Core cache operations: get, set, isStale, fetchWithDedupe,
 * applyOptimisticUpdate, remove, clear, clearAll, subscribe.
 *
 * All methods operate on the shared QueryCacheInternals instance.
 */

// ==========================================
// Core Read/Write
// ==========================================

/** Get cached data for a query key. Returns null if not found or expired. */
export async function cacheGet<T>(
  ctx: QueryCacheInternals,
  key: string,
): Promise<T | null> {
  try {
    let entry = ctx.inMemoryCache.get(key) as CacheEntry<T> | undefined;

    if (!entry) {
      const storageKey = ctx.toCacheKey(key);
      let rawData = await FastCache.getJSON<CacheEntry<T>>(storageKey);
      
      if (rawData) {
        // **Decompression: Decompress data retrieved from persistent storage**
        try {
          const decompressed = await decodeCompression(rawData);
          if (decompressed) {
            rawData = decompressed;
          }
        } catch (compressionError) {
          // If the entry looks compressed (has version/algorithm fields) but
          // decompression failed, the raw data is a corrupted CompressedEntry
          // wrapper — not the original data. Discard it instead of returning garbage.
          if (rawData && typeof rawData === 'object' && 'version' in rawData && 'algorithm' in rawData) {
            logger
              .category('storage')
              .warn(
                `Compression decode failed for ${key}, discarding corrupted compressed entry: ${compressionError instanceof Error ? compressionError.message : String(compressionError)}`,
              );
            rawData = null;
          } else {
            // Not a compressed entry format — safe to use as-is
            logger
              .category('storage')
              .warn(
                `Compression decode failed for ${key}, using raw value: ${compressionError instanceof Error ? compressionError.message : String(compressionError)}`,
              );
          }
        }
        
        if (rawData) {
          entry = rawData;
          ctx.inMemoryCache.set(key, entry);
        }
      }
    }

    if (!entry) return null;

    const age = Date.now() - entry.timestamp;
    if (age > entry.cacheTime) {
      logger.category('storage').debug(`Cache expired for key: ${key}`);
      await ctx.removeEntry(key);
      return null;
    }

    ctx.lruTracker.updateAccessTime(key);
    return entry.data;
  } catch (error) {
    logger.category('storage').error(`Error reading cache for ${key}:`, error);
    return null;
  }
}

/**
 * Set cached data for a query key.
 *
 * @param resolvePersistence - injected from persistence module to avoid circular dep
 */
export async function cacheSet<T>(
  ctx: QueryCacheInternals,
  key: string,
  data: T,
  options: CacheOptions = {},
  requestVersion: number | undefined,
  resolvePersistence: (key: string) => 'persist' | 'volatile',
): Promise<void> {
  try {
    if (requestVersion !== undefined && requestVersion < ctx.globalVersion) {
      logger.category('storage').debug(`Stale version for ${key}, discarding result`, {
        requestVersion,
        currentVersion: ctx.globalVersion,
      });
      return;
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      staleTime: options.staleTime ?? ctx.config.defaultStaleTime,
      cacheTime: options.cacheTime ?? ctx.config.defaultCacheTime,
      tags: options.tags,
      version: ctx.globalVersion,
      persistenceLevel: resolvePersistence(key),
    };

    ctx.inMemoryCache.set(key, entry);

    // Measure once, pass to LRU tracker to avoid double-serialization
    const entrySize = measureEntrySize(entry);
    ctx.trackEntrySize(key, entry, entrySize);

    const storageKey = ctx.toCacheKey(key);
    
    // **Compression: Encode (compress) before persisting**
    let valueToStore = entry;
    try {
      const compressionOptions: CompressionEncodeOptions = { key };
      valueToStore = await encodeCompression(entry, compressionOptions);
    } catch (compressionError) {
      // Log warning but don't fail the operation; continue with uncompressed value
      logger
        .category('storage')
        .warn(
          `Compression encode failed for ${key}, persisting uncompressed: ${compressionError instanceof Error ? compressionError.message : String(compressionError)}`,
        );
      // Use original entry if compression fails
      valueToStore = entry;
    }
    
    await FastCache.setJSON(storageKey, valueToStore);

    if (ctx.isOverLimit()) {
      await ctx.evictLRU();
    }

    ctx.notifySubscribers(key, data);

    logger.category('storage').debug(`Cached data for key: ${key}`, {
      tags: entry.tags,
      staleTime: entry.staleTime,
      version: entry.version,
      sizeBytes: entrySize,
    });
  } catch (error) {
    logger.category('storage').error(`Error setting cache for ${key}:`, error);
  }
}

/** Check if cached data is stale (but not expired). */
export function cacheIsStale(ctx: QueryCacheInternals, key: string): boolean {
  const entry = ctx.inMemoryCache.get(key);
  if (!entry) return true;

  const age = Date.now() - entry.timestamp;
  return age > entry.staleTime;
}

/**
 * Fetch with deduplication — prevents duplicate API calls for the same key.
 * If a request for this key is already in progress, returns the existing promise.
 */
export function cacheFetchWithDedupe<T>(
  ctx: QueryCacheInternals,
  key: string,
  fetcher: () => Promise<T>,
): Promise<T> {
  if (ctx.pendingRequests.has(key)) {
    logger.category('storage').debug(`Deduplicating request for key: ${key}`);
    return ctx.pendingRequests.get(key)!;
  }

  const promise = fetcher().finally(() => {
    ctx.pendingRequests.delete(key);
  });

  ctx.pendingRequests.set(key, promise);
  return promise;
}

// ==========================================
// Optimistic Updates
// ==========================================

/**
 * Apply optimistic update to cache and return a revert function.
 * Used for instant UI feedback before mutations complete.
 */
export function cacheApplyOptimisticUpdate(
  ctx: QueryCacheInternals,
  updater: (prev: any) => any,
  options?: { tags?: string[]; keyPattern?: RegExp },
): () => void {
  const affectedKeys: string[] = [];
  const previousValues = new Map<string, any>();

  for (const [key, entry] of ctx.inMemoryCache.entries()) {
    if (options?.tags && entry.tags) {
      const hasTag = entry.tags.some((tag) => options.tags!.includes(tag));
      if (!hasTag) continue;
    }

    if (options?.keyPattern && !options.keyPattern.test(key)) {
      continue;
    }

    const newValue = updater(entry.data);
    if (newValue !== entry.data) {
      affectedKeys.push(key);
      previousValues.set(key, entry.data);

      const optimisticEntry: CacheEntry = {
        ...entry,
        data: newValue,
        timestamp: Date.now(),
      };

      ctx.inMemoryCache.set(key, optimisticEntry);
      ctx.notifySubscribers(key, newValue);
      logger.category('storage').debug(`Applied optimistic update for key: ${key}`);
    }
  }

  return () => {
    for (const key of affectedKeys) {
      const previousValue = previousValues.get(key);
      if (previousValue !== undefined) {
        const entry = ctx.inMemoryCache.get(key);
        if (entry) {
          const revertedEntry: CacheEntry = { ...entry, data: previousValue };
          ctx.inMemoryCache.set(key, revertedEntry);
          ctx.notifySubscribers(key, previousValue);
          logger.category('storage').debug(`Reverted optimistic update for key: ${key}`);
        }
      }
    }
  };
}

// ==========================================
// Bulk Remove
// ==========================================

/** Clear all cache entries (fast path — clears maps) */
export async function cacheClear(ctx: QueryCacheInternals): Promise<void> {
  try {
    const keys = Array.from(ctx.inMemoryCache.keys());
    ctx.inMemoryCache.clear();
    ctx.lruTracker.clear();

    await Promise.all(
      keys.map((key) => FastCache.removeItem(ctx.toCacheKey(key))),
    );

    logger.category('storage').info("Cleared all query cache");
  } catch (error) {
    logger.category('storage').error("Error clearing cache:", error);
  }
}

/** Clear all entries including subscribers (for logout scenarios) */
export async function cacheClearAll(ctx: QueryCacheInternals): Promise<void> {
  try {
    const keys = Array.from(ctx.inMemoryCache.keys());
    await ctx.removeEntries(keys);
    ctx.inMemoryCache.clear();
    ctx.lruTracker.clear();
    ctx.subscribers.clear();
    logger.category('storage').info("Cleared all cache entries");
  } catch (error) {
    logger.category('storage').error("Error clearing all cache:", error);
  }
}

// ==========================================
// Subscriptions
// ==========================================

/** Subscribe to cache updates for a specific key */
export function cacheSubscribe(
  ctx: QueryCacheInternals,
  key: string,
  callback: CacheSubscriber,
): () => void {
  if (!ctx.subscribers.has(key)) {
    ctx.subscribers.set(key, new Set());
  }
  ctx.subscribers.get(key)!.add(callback);

  return () => {
    const subs = ctx.subscribers.get(key);
    if (subs) {
      subs.delete(callback);
      if (subs.size === 0) {
        ctx.subscribers.delete(key);
      }
    }
  };
}
