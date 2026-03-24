/**
 * Query Cache — Centralized cache with invalidation patterns
 *
 * Modular architecture:
 * - internals.ts          Shared state, config, LRU eviction, helpers
 * - query-cache-core.ts   get, set, isStale, dedupe, optimistic updates, subscriptions
 * - query-cache-invalidation.ts   invalidate by tags / pattern / predicate / age
 * - query-cache-persistence.ts    persistence-level resolution, clear by level / pattern
 * - query-cache-stats.ts          stats snapshots, manual eviction
 *
 * Advanced Patterns (via Orchestrator):
 * - cascading invalidation (parent → child dependencies)
 * - conditional invalidation (predicate-based filtering)
 * - transactional invalidation (atomic with rollback)
 * - deferred invalidation (scheduled with debouncing)
 * - LRU capacity management (automatic eviction)
 *
 * All modules operate on a single QueryCacheInternals instance.
 */
import type {
  CacheEntry,
  CacheOptions,
  CacheSnapshot,
  ConditionalPredicate,
  InvalidateOptions,
  TransactionContext,
  TransactionResult,
} from "@/type-definitions";
import { QueryCacheInternals, type CacheSubscriber } from "./internals";

import {
  cacheApplyOptimisticUpdate,
  cacheClear,
  cacheClearAll,
  cacheFetchWithDedupe,
  cacheGet,
  cacheIsStale,
  cacheSet,
  cacheSubscribe,
} from "./query-cache-core";

import {
  cacheGetCurrentVersion,
  cacheInvalidate,
  cacheInvalidateByTags,
  cacheInvalidateOlderThan,
  cacheSelectiveInvalidate,
} from "./query-cache-invalidation";

import {
  cacheClearByPattern,
  cacheClearByPersistence,
  cacheClearByPersistenceLevel,
  resolvePersistenceLevel,
} from "./query-cache-persistence";

import {
  evictOldestN as statsEvictOldestN,
  getCacheStats as statsGetCacheStats,
  getEvictionStats as statsGetEvictionStats,
  getStats as statsGetStats,
} from "./query-cache-stats";

import { logger } from "@/lib/utils";

// ==========================================
// Cache Invalidation Orchestrator Integration
// ==========================================
// Lazy import to avoid circular dependencies; orchestrator is initialized
// during kernel bootstrap (system/Kernel/phases/storage-phase.ts)
const getOrchestrator = async () => {
  const { cacheInvalidationOrchestrator } = await import(
    "@/system/Storage"
  );
  return cacheInvalidationOrchestrator;
};

// ==========================================
// Composed QueryCache Class
// ==========================================

class QueryCacheClass {
  private readonly ctx: QueryCacheInternals;

  constructor() {
    this.ctx = new QueryCacheInternals();
  }

  // ── Core Operations ────────────────────────────────────────────────

  async get<T>(key: string): Promise<T | null> {
    return cacheGet<T>(this.ctx, key);
  }

  async set<T>(
    key: string,
    data: T,
    options: CacheOptions = {},
    requestVersion?: number,
  ): Promise<void> {
    return cacheSet(
      this.ctx, key, data, options, requestVersion,
      (k) => resolvePersistenceLevel(this.ctx, k),
    );
  }

  async isStale(key: string): Promise<boolean> {
    return cacheIsStale(this.ctx, key);
  }

  async fetchWithDedupe<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
    return cacheFetchWithDedupe(this.ctx, key, fetcher);
  }

  applyOptimisticUpdate(
    updater: (prev: any) => any,
    options?: { tags?: string[]; keyPattern?: RegExp },
  ): () => void {
    return cacheApplyOptimisticUpdate(this.ctx, updater, options);
  }

  async remove(key: string): Promise<void> {
    return this.ctx.removeEntry(key);
  }

  async clear(): Promise<void> {
    return cacheClear(this.ctx);
  }

  async clearAll(): Promise<void> {
    return cacheClearAll(this.ctx);
  }

  // ── Subscriptions ──────────────────────────────────────────────────

  subscribe(key: string, callback: CacheSubscriber): () => void {
    return cacheSubscribe(this.ctx, key, callback);
  }

  // ── Invalidation ──────────────────────────────────────────────────

  getCurrentVersion(): number {
    return cacheGetCurrentVersion(this.ctx);
  }

  async invalidateByTags(
    tags: string[],
    options?: InvalidateOptions,
  ): Promise<void> {
    return cacheInvalidateByTags(this.ctx, tags, options);
  }

  async invalidate(
    pattern: string | RegExp,
    options?: InvalidateOptions,
  ): Promise<void> {
    return cacheInvalidate(this.ctx, pattern, options);
  }

  async invalidateOlderThan(maxAgeMs: number): Promise<number> {
    return cacheInvalidateOlderThan(this.ctx, maxAgeMs);
  }

  async selectiveInvalidate(
    predicate: (key: string, entry: CacheEntry) => boolean,
    options?: InvalidateOptions,
  ): Promise<number> {
    return cacheSelectiveInvalidate(this.ctx, predicate, options);
  }

  // ── Persistence Level ─────────────────────────────────────────────

  async clearByPersistenceLevel(level: 'persist' | 'volatile'): Promise<number> {
    return cacheClearByPersistenceLevel(this.ctx, level);
  }

  async clearByPersistence(predicate: (entry: CacheEntry) => boolean): Promise<number> {
    return cacheClearByPersistence(this.ctx, predicate);
  }

  async clearByPattern(
    pattern: RegExp,
    persistenceLevel?: 'persist' | 'volatile',
  ): Promise<number> {
    return cacheClearByPattern(this.ctx, pattern, persistenceLevel);
  }

  // ── Stats & Eviction ──────────────────────────────────────────────

  getCacheStats() {
    return statsGetCacheStats(this.ctx);
  }

  getEvictionStats() {
    return statsGetEvictionStats(this.ctx);
  }

  async evictOldestN(count: number): Promise<number> {
    return statsEvictOldestN(this.ctx, count);
  }

  getStats() {
    return statsGetStats(this.ctx);
  }

  // ── Advanced Invalidation Patterns ────────────────────────────────

  /**
   * Register a cascade dependency pattern.
   * When parentPattern is invalidated, all childPatterns are automatically invalidated.
   *
   * @example
   * QueryCache.registerCascade('world:123', ['world:123:members', 'world:123:items']);
   * QueryCache.invalidate('world:123'); // Cascades to members & items
   */
  async registerCascade(parentPattern: string, childPatterns: string[]): Promise<void> {
    const orchestrator = await getOrchestrator();
    orchestrator.registerCascade(parentPattern, childPatterns);
  }

  /**
   * Get cascade dependencies for a key (debugging/monitoring).
   * @returns Array of child patterns that will be invalidated
   */
  async getCascadeDependencies(key: string): Promise<string[]> {
    const orchestrator = await getOrchestrator();
    return orchestrator.getCascadeDependencies(key);
  }

  /**
   * Conditionally invalidate cache entries matching a pattern and predicate.
   *
   * @example
   * await QueryCache.invalidateIfMatches(
   *   'world:*',
   *   (key, entry) => entry.version < currentVersion
   * );
   */
  async invalidateIfMatches(
    pattern: string,
    predicate: ConditionalPredicate
  ) {
    const orchestrator = await getOrchestrator();
    
    // Default: use QueryCache's own stats and invalidation
    const getCacheStats = () => {
      return {
        entries: Array.from(this.ctx.inMemoryCache.entries()).map(([key, entry]) => ({ key, entry }))
      };
    };
    
    const delegate = async (keys: string[]) => {
      let count = 0;
      for (const key of keys) {
        await this.invalidate(key);
        count++;
      }
      return { invalidatedCount: count, errors: [] };
    };

    return orchestrator.invalidateIfMatches(pattern, predicate, getCacheStats, delegate);
  }

  /**
   * Execute a transactional cache invalidation with atomic rollback semantics.
   * Either all queued invalidations succeed, or cache is restored to pre-transaction state.
   *
   * @example
   * await QueryCache.transaction(async (tx) => {
   *   tx.invalidate('world:123');
   *   tx.invalidateMany(['members:world:123', 'items:world:123']);
   * });
   */
  async transaction(
    operation: (tx: TransactionContext) => Promise<void>
  ): Promise<TransactionResult> {
    const orchestrator = await getOrchestrator();

    // Use QueryCache's own snapshot/restore
    const defaultConfig = {
      getSnapshot: () => ({
        // Create a snapshot of current cache state
        entries: Object.fromEntries(this.ctx.inMemoryCache),
        size: 0,
        timestamp: Date.now(),
      }),
      executeInvalidations: async (keys: string[]) => {
        let count = 0;
        const errors: { key: string; error: Error }[] = [];
        for (const key of keys) {
          try {
            await this.invalidate(key);
            count++;
          } catch (error) {
            errors.push({ key, error: error instanceof Error ? error : new Error(String(error)) });
          }
        }
        return { invalidatedCount: count, errors };
      },
      restoreSnapshot: async (snapshot: CacheSnapshot) => {
        // Restore by clearing and re-setting entries
        await this.clearAll();
        for (const [key, value] of Object.entries(snapshot.entries)) {
          try {
            // Assuming value is CacheEntry<any>
            if (value && typeof value === 'object' && 'data' in value) {
              const entry = value as CacheEntry<any>;
              await this.set(key, entry.data, {
                staleTime: entry.staleTime,
                cacheTime: entry.cacheTime,
                tags: entry.tags,
              });
            }
          } catch (error) {
            // Log but don't throw - best effort restore
            logger.category('storage').warn(`Failed to restore cache entry ${key}`, error);
          }
        }
      },
    };

    return orchestrator.transaction(operation, defaultConfig);
  }

  /**
   * Schedule a deferred (delayed) cache invalidation.
   * Useful for debouncing rapid updates (e.g., user typing).
   *
   * @example
   * const { cancelFn } = await QueryCache.invalidateAfter(500, ['search:*']);
   * cancelFn(); // Cancel before delay expires
   */
  async invalidateAfter(
    delayMs: number,
    patterns: string[],
    executor?: (patterns: string[]) => Promise<{ invalidatedCount: number; errors: { pattern: string; error: Error }[] }>
  ) {
    const orchestrator = await getOrchestrator();

    // Default: invalidate via pattern
    const execute = executor || (async (pats: string[]) => {
      let count = 0;
      for (const pat of pats) {
        await this.invalidate(pat);
        count++;
      }
      return { invalidatedCount: count, errors: [] };
    });

    return orchestrator.invalidateAfter(delayMs, patterns, execute);
  }

  /**
   * Get LRU eviction statistics for capacity monitoring.
   * @returns LRU tracking stats (total size, entry counts, etc.)
   */
  async getLRUStats() {
    const orchestrator = await getOrchestrator();
    return orchestrator.getLRUStats();
  }

  /**
   * Get LRU capacity statistics.
   * @returns Capacity info (total size, hard limit, soft limit, approaching flag)
   */
  async getLRUCapacityStats() {
    const orchestrator = await getOrchestrator();
    return orchestrator.getLRUCapacityStats();
  }

  /**
   * Check if LRU is approaching capacity limit.
   * @returns true if totalSize >= soft limit threshold
   */
  async isApproachingCapacity(): Promise<boolean> {
    const orchestrator = await getOrchestrator();
    return orchestrator.isApproachingCapacity();
  }
}

// ── Singleton ─────────────────────────────────────────────────────────
export const QueryCache = new QueryCacheClass();
export default QueryCache;
