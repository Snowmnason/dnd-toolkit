/**
 * Shared types for storage and cache operations
 * Centralized here to prevent drift between modules
 */

// ======================================================
// Revalidation & Invalidation Strategy Types
// ======================================================

/**
 * Revalidation strategy type for cache invalidation
 * - 'immediate': Show loading state, wait for fresh data (blocks UI during refetch)
 * - 'background': Return stale data immediately, refetch in background (SWR)
 * - 'keep-stale': Keep stale data without auto-refetch (manual refetch only)
 */
export type RevalidationStrategy = 'immediate' | 'background' | 'keep-stale';

/**
 * Cache priority strategy for data fetching
 * - 'balanced': Use cache if exists, revalidate if stale (SWR) — default
 * - 'cacheFirst': Strongly prefer cache; only revalidate on explicit refetch
 * - 'networkFirst': Always try to fetch fresh data; use cache as fallback on error
 * - 'offlineFirst': On offline, prefer cache even if very stale; don't force revalidation
 */
export type CachePriority = 'balanced' | 'cacheFirst' | 'networkFirst' | 'offlineFirst';

/**
 * Options for cache invalidation operations
 */
export interface InvalidateOptions {
  /** Revalidation strategy (documents intent; actual behavior controlled by useQuery hooks) */
  strategy?: RevalidationStrategy;
}

// ======================================================
// Query Cache Configuration & Entry Types
// ======================================================

/**
 * A single entry in the query cache
 */
export interface CacheEntry<T = any> {
  /** Cached data */
  data: T;
  /** Timestamp when entry was created (milliseconds since epoch) */
  timestamp: number;
  /** How long until this entry becomes stale (milliseconds) */
  staleTime: number;
  /** How long to keep this entry in cache before garbage collection (milliseconds) */
  cacheTime: number;
  /** Tags for smart invalidation (e.g., 'worlds', 'user:123') */
  tags?: string[];
  /** Version number for race condition prevention during invalidation */
  version?: number;
  /** Persistence level: 'persist' (survives logout) or 'volatile' (cleared on logout) */
  persistenceLevel?: 'persist' | 'volatile';
}

/**
 * Options when storing data in the cache
 */
export interface CacheOptions {
  /** How long until the entry becomes stale, in milliseconds (default: 2 hours) */
  staleTime?: number;
  /** How long to keep the entry in cache, in milliseconds (default: 4 hours) */
  cacheTime?: number;
  /** Tags for smart invalidation */
  tags?: string[];
}

/**
 * Configuration for the QueryCache
 */
export interface QueryCacheConfig {
  /** Default stale time in milliseconds (2 hours) */
  defaultStaleTime: number;
  /** Default cache time in milliseconds (4 hours) */
  defaultCacheTime: number;
  /** Maximum number of entries in cache before pruning (prevent unbounded growth) */
  maxEntries: number;
  /** Maximum total cache size in bytes before LRU eviction (default: 100MB) */
  maxBytes?: number;
  /** Pattern-based persistence level mapping (key pattern → 'persist' | 'volatile') */
  persistenceLevelMap?: Record<string, 'persist' | 'volatile'>;
}

// ======================================================
// useQuery Hook Types
// ======================================================

/**
 * Options for useQuery hook
 */
export interface UseQueryOptions {
  /** Cache stale time in seconds (default: 7200s = 2 hours) */
  staleTime?: number;
  /** Cache time in seconds (default: 14400s = 4 hours) */
  cacheTime?: number;
  /** Whether to revalidate in background when stale (default: true) */
  revalidateOnFocus?: boolean;
  /** Manually disable this query (default: false) */
  disabled?: boolean;
  /** Tags for smart cache invalidation */
  tags?: string[];
  /** Called when data is fetched successfully */
  onSuccess?: (data: unknown) => void;
  /** Called when error occurs */
  onError?: (error: Error) => void;
  /** Cache priority strategy (default: 'balanced') */
  cachePriority?: CachePriority;
  /** Revalidation strategy when cache is invalidated or becomes stale (default: 'immediate') */
  revalidationStrategy?: RevalidationStrategy;
  /** Optional condition that must return true before auto-revalidation proceeds */
  revalidationCondition?: () => Promise<boolean>;
}

/**
 * State returned by useQuery hook
 */
export interface UseQueryState<T> {
  /** Current cached data (or undefined if not yet loaded) */
  data: T | undefined;
  /** Whether first load is in progress */
  isLoading: boolean;
  /** Whether background revalidation is in progress */
  isRevalidating: boolean;
  /** Current error, if any */
  error: Error | undefined;
  /** Manually refetch data */
  refetch: () => Promise<void>;
  /** Manually invalidate this query */
  invalidate: () => Promise<void>;
}

/**
 * Fetch function type - takes a cache key and returns data
 */
export type FetchFn<T> = (key: string) => Promise<T>;
