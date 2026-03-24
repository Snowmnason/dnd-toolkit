import { getAppConfig } from "@/config";
import { logger } from "@/lib/utils";
import { FastCache } from "@/system/Storage/";
import { LRUEviction, measureEntrySize } from "@/system/Storage/cache-invalidation/lru-eviction";
import type {
  CacheEntry,
  QueryCacheConfig,
} from "@/type-definitions";

/**
 * Escape special regex characters in a string to prevent ReDoS attacks
 */
export function escapeRegexChars(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export type CacheSubscriber = (key: string, data: any) => void;

const DEFAULT_CONFIG: QueryCacheConfig = {
  defaultStaleTime: 2 * 60 * 60 * 1000, // 2 hours
  defaultCacheTime: 4 * 60 * 60 * 1000, // 4 hours
  maxEntries: 500,
  maxBytes: 100 * 1024 * 1024, // 100MB
};

function loadQueryCacheConfig(): QueryCacheConfig {
  const config: QueryCacheConfig = { ...DEFAULT_CONFIG };

  try {
    const appConfig = getAppConfig();
    if (appConfig.cachePersistenceMap) {
      // Sanitize: only keep entries whose values are the known persistence literals.
      // Config files may include metadata keys (e.g. 'description') that are not
      // valid persistence levels and would corrupt resolvePersistenceLevel() output.
      const sanitized: Record<string, 'persist' | 'volatile'> = {};
      for (const [k, v] of Object.entries(appConfig.cachePersistenceMap)) {
        if (v === 'persist' || v === 'volatile') {
          // Use Object.assign to avoid dynamic property injection pattern
          Object.assign(sanitized, { [k]: v });
        } else {
          logger.category('storage').warn(
            `[QueryCache] Ignoring invalid cachePersistenceMap entry: "${k}" = "${String(v)}" (expected 'persist' | 'volatile')`,
          );
        }
      }

      if (Object.keys(sanitized).length > 0) {
        config.persistenceLevelMap = sanitized;
      }
    }
  } catch (error) {
    logger.category('storage').debug(
      'Could not load persistence map from app config, using defaults',
      error,
    );
  }

  return config;
}

/**
 * Shared internal state container for all QueryCache modules.
 *
 * Each module file (core, invalidation, persistence, stats) receives
 * this single object so they can operate on the same cache maps,
 * LRU tracker, subscribers, and config without circular imports.
 */
export class QueryCacheInternals {
  readonly config: QueryCacheConfig;
  readonly inMemoryCache: Map<string, CacheEntry> = new Map();
  readonly lruTracker: LRUEviction = new LRUEviction();
  readonly subscribers: Map<string, Set<CacheSubscriber>> = new Map();
  readonly pendingRequests: Map<string, Promise<any>> = new Map();
  globalVersion: number = 0;
  evictionsTotal: number = 0;
  totalEntriesEvicted: number = 0;
  lastEvictionTime: number | null = null;
  lastEvictionCount: number = 0;
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    this.config = loadQueryCacheConfig();
    this.startCleanupTimer();
  }

  // ==========================================
  // Shared helpers used by multiple modules
  // ==========================================

  /** Convert query key to storage key */
  toCacheKey(key: string): string {
    return `query_cache_${key}`;
  }

  /** Remove a single cache entry from all stores */
  async removeEntry(key: string): Promise<void> {
    try {
      this.inMemoryCache.delete(key);
      this.lruTracker.untrackEntry(key);
      const storageKey = this.toCacheKey(key);
      await FastCache.removeItem(storageKey);
      logger.category('storage').debug(`Removed cache for key: ${key}`);
    } catch (error) {
      logger.category('storage').error(`Error removing cache for ${key}:`, error);
    }
  }

  /** Remove multiple entries by key list */
  async removeEntries(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    await Promise.all(keys.map((key) => this.removeEntry(key)));
  }

  /**
   * Find all cache keys whose entries satisfy a predicate.
   * Catches per-entry predicate errors so one bad entry doesn't break the scan.
   */
  findMatchingKeys(
    predicate: (key: string, entry: CacheEntry) => boolean,
  ): string[] {
    const matched: string[] = [];
    for (const [key, entry] of this.inMemoryCache.entries()) {
      try {
        if (predicate(key, entry)) {
          matched.push(key);
        }
      } catch (err) {
        logger.category('storage').error(
          `Error evaluating predicate for key "${key}":`,
          err,
        );
      }
    }
    return matched;
  }

  /** Notify all subscribers when a key's data updates */
  notifySubscribers(key: string, data: any): void {
    const subs = this.subscribers.get(key);
    if (subs) {
      subs.forEach((callback) => callback(key, data));
    }
  }

  /**
   * Track an entry's size for LRU eviction.
   * @param key Cache key
   * @param entry Cache entry (used for measurement if precomputedSize not provided)
   * @param precomputedSize If the caller already measured the entry, pass it to avoid re-serializing
   */
  trackEntrySize(key: string, entry: CacheEntry, precomputedSize?: number): number {
    const sizeBytes = precomputedSize ?? measureEntrySize(entry);
    this.lruTracker.trackEntry(key, sizeBytes);
    return sizeBytes;
  }

  /**
   * Evict LRU entries when cache exceeds size/count limits.
   * Called internally after set() operations.
   */
  async evictLRU(): Promise<void> {
    const stats = this.lruTracker.getStats();
    const keysToEvict: string[] = [];

    if (this.config.maxBytes && stats.totalSizeBytes > this.config.maxBytes) {
      // Size-based eviction: target 90% of max
      let currentSize = stats.totalSizeBytes;
      const targetSize = this.config.maxBytes * 0.9;

      for (const [key] of this.lruTracker.getOldestN(this.inMemoryCache.size)) {
        if (currentSize <= targetSize) break;

        if (this.inMemoryCache.has(key)) {
          const sizeFreed = this.lruTracker.getEntryMetadata(key)?.sizeBytes || 0;
          keysToEvict.push(key);
          currentSize -= sizeFreed;
        }
      }

      logger.category('storage').debug(
        `LRU eviction by size: ${keysToEvict.length} entries | ${stats.totalSizeBytes} bytes → target ${targetSize} bytes`,
      );
    } else if (this.inMemoryCache.size > this.config.maxEntries) {
      // Count-based eviction: evict 10% oldest
      const toEvict = Math.ceil(this.inMemoryCache.size * 0.1);
      for (const [key] of this.lruTracker.getOldestN(toEvict)) {
        keysToEvict.push(key);
      }

      logger.category('storage').debug(
        `LRU eviction by count: ${keysToEvict.length} entries removed (${this.inMemoryCache.size} → ${this.inMemoryCache.size - keysToEvict.length})`,
      );
    }

    if (keysToEvict.length > 0) {
      await this.removeEntries(keysToEvict);
      this.evictionsTotal++;
      this.totalEntriesEvicted += keysToEvict.length;
      this.lastEvictionTime = Date.now();
      this.lastEvictionCount = keysToEvict.length;
    }
  }

  /** Check if size/entry limits are exceeded */
  isOverLimit(): boolean {
    return (
      (!!this.config.maxBytes && this.lruTracker.getTotalSizeBytes() > this.config.maxBytes) ||
      this.inMemoryCache.size > this.config.maxEntries
    );
  }

  // ==========================================
  // Periodic cleanup
  // ==========================================

  private startCleanupTimer(): void {
    if (this.cleanupTimer) return;

    this.cleanupTimer = setInterval(
      () => { this.cleanupExpired(); },
      60 * 60 * 1000, // Every hour
    );

    if (typeof this.cleanupTimer === "object" && "unref" in this.cleanupTimer) {
      (this.cleanupTimer as any).unref();
    }
  }

  private async cleanupExpired(): Promise<void> {
    const now = Date.now();
    const expired = this.findMatchingKeys(
      (_key, entry) => (now - entry.timestamp) > entry.cacheTime,
    );

    await this.removeEntries(expired);

    if (expired.length > 0) {
      logger.category('storage').info(`Cleaned up ${expired.length} expired cache entries`);
    }
  }
}
