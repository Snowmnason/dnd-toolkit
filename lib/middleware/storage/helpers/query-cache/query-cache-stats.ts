import { logger } from "@/lib/utils";
import type { QueryCacheInternals } from "./internals";

/**
 * Statistics and manual eviction APIs.
 *
 * Provides read-only stats snapshots and manual eviction
 * for testing, debugging, and recovery scenarios.
 */

// ==========================================
// Cache Stats
// ==========================================

export interface CacheStatsSnapshot {
  totalEntries: number;
  totalBytes: number;
  maxBytes: number;
  maxEntries: number;
  utilizationPercent: number;
  /** Age of oldest entry in milliseconds */
  oldestEntryAge: number;
}

export interface EvictionStatsSnapshot {
  evictionsTotal: number;
  lastEviction: { time: number | null; entriesRemoved: number } | null;
  averageEntriesPerEviction: number;
}

/** Get cache size and utilization statistics */
export function getCacheStats(ctx: QueryCacheInternals): CacheStatsSnapshot {
  const lruStats = ctx.lruTracker.getStats();
  const maxBytes = ctx.config.maxBytes || 0;
  const utilizationPercent = maxBytes > 0 ? (lruStats.totalSizeBytes / maxBytes) * 100 : 0;
  const oldestEntryAge = lruStats.oldestAccessTimeMs
    ? Date.now() - lruStats.oldestAccessTimeMs
    : 0;

  return {
    totalEntries: ctx.inMemoryCache.size,
    totalBytes: lruStats.totalSizeBytes,
    maxBytes,
    maxEntries: ctx.config.maxEntries,
    utilizationPercent,
    oldestEntryAge,
  };
}

/** Get eviction event statistics */
export function getEvictionStats(ctx: QueryCacheInternals): EvictionStatsSnapshot {
  const lastEviction =
    ctx.lastEvictionTime !== null
      ? { time: ctx.lastEvictionTime, entriesRemoved: ctx.lastEvictionCount }
      : null;

  return {
    evictionsTotal: ctx.evictionsTotal,
    lastEviction,
    averageEntriesPerEviction:
      ctx.evictionsTotal > 0 ? ctx.totalEntriesEvicted / ctx.evictionsTotal : 0,
  };
}

/** Get debugging stats (legacy-compatible shape) */
export function getStats(ctx: QueryCacheInternals) {
  const lruStats = ctx.lruTracker.getStats();
  return {
    cacheSize: ctx.inMemoryCache.size,
    cacheSizeBytes: lruStats.totalSizeBytes,
    subscribers: ctx.subscribers.size,
    keys: Array.from(ctx.inMemoryCache.keys()),
    lru: {
      totalSizeBytes: lruStats.totalSizeBytes,
      entryCount: lruStats.entryCount,
      averageSizeBytes: lruStats.averageSizeBytes,
      oldestAccessTimeMs: lruStats.oldestAccessTimeMs,
      newestAccessTimeMs: lruStats.newestAccessTimeMs,
    },
  };
}

// ==========================================
// Manual Eviction
// ==========================================

/**
 * Manually evict the N oldest entries by last access time.
 * Useful for testing or recovery scenarios.
 *
 * @returns Number of entries actually evicted
 */
export async function evictOldestN(
  ctx: QueryCacheInternals,
  count: number,
): Promise<number> {
  try {
    const oldestEntries = ctx.lruTracker.getOldestN(count);
    const keysToEvict = oldestEntries.map(([key]) => key);

    if (keysToEvict.length === 0) {
      logger.category('storage').debug('evictOldestN: No entries to evict');
      return 0;
    }

    await ctx.removeEntries(keysToEvict);

    ctx.evictionsTotal++;
    ctx.totalEntriesEvicted += keysToEvict.length;
    ctx.lastEvictionTime = Date.now();
    ctx.lastEvictionCount = keysToEvict.length;

    logger.category('storage').info(
      `Manually evicted ${keysToEvict.length} oldest entries`,
    );

    return keysToEvict.length;
  } catch (error) {
    logger.category('storage').error('Error evicting oldest entries:', error);
    return 0;
  }
}
