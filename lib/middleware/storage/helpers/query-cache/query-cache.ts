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
 * All modules operate on a single QueryCacheInternals instance.
 */
import type {
    CacheEntry,
    CacheOptions,
    InvalidateOptions,
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
}

// ── Singleton ─────────────────────────────────────────────────────────
export const QueryCache = new QueryCacheClass();
export default QueryCache;
