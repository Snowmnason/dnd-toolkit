'use client';

import { QueryCache } from '@/lib/storage';
import { logger } from '@/lib/utils';
import { NetworkDetection } from '@/system/Network';
import { useEffect, useRef, useState } from 'react';

/**
 * Revalidation strategy type for cache invalidation
 * - 'immediate': Show loading state, wait for fresh data (blocks UI during refetch)
 * - 'background': Return stale data immediately, refetch in background (SWR)
 * - 'keep-stale': Keep stale data without auto-refetch (manual refetch only)
 */
export type RevalidationStrategy = 'immediate' | 'background' | 'keep-stale';

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
  /**
   * Cache priority strategy (default: 'balanced')
   * - 'balanced': Use cache if exists, revalidate if stale (SWR)
   * - 'cacheFirst': Strongly prefer cache; only revalidate on explicit refetch
   * - 'networkFirst': Always try to fetch; use cache as fallback on error
   * - 'offlineFirst': On offline, prefer cache even if very stale; don't force revalidation
   */
  cachePriority?: 'balanced' | 'cacheFirst' | 'networkFirst' | 'offlineFirst';
  /**
   * Revalidation strategy when cache is invalidated or becomes stale (default: 'immediate')
   */
  revalidationStrategy?: RevalidationStrategy;
  /**
   * Optional condition that must return true before auto-revalidation proceeds
   * If condition returns false, revalidation is skipped (keep-stale behavior)
   * Manual refetch() ignores this condition and always refetches
   *
   * @example
   * ```typescript
   * // Only auto-revalidate if network is online
   * revalidationCondition: async () => NetworkDetection.isOnline()
   * ```
   */
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
 * Fetch function type - takes a key and returns data
 */
type FetchFn<T> = (key: string) => Promise<T>;

/**
 * SWR (Stale-While-Revalidate) hook for data fetching with cache
 *
 * @example
 * ```ts
 * const { data, isLoading, error, refetch } = useQuery(
 *   'worlds:user:123',
 *   async (key) => {
 *     const worlds = await worldsDB.getWorldsForUser('123');
 *     return worlds;
 *   },
 *   { tags: ['worlds', 'user:123'] }
 * );
 * ```
 *
 * @note staleTime, cacheTime, tags, onSuccess, and onError changes do NOT trigger refetch.
 * Changes to these options apply to the next revalidation. If you need immediate effect:
 * - Call refetch() manually
 * - Memoize callbacks with useCallback() to maintain stable reference
 * - Change the key to force re-initialization
 */
export function useQuery<T>(
  key: string,
  fetcher: FetchFn<T>,
  options: UseQueryOptions = {},
): UseQueryState<T> {
  const {
    staleTime = 7200,
    cacheTime = 14400,
    revalidateOnFocus = true,
    disabled = false,
    tags = [],
    onSuccess,
    onError,
    cachePriority = 'balanced',
    revalidationStrategy = 'immediate',
    revalidationCondition,
  } = options;

  // Convert staleTime and cacheTime from seconds to milliseconds for QueryCache
  const staleTimeMs = staleTime * 1000;
  const cacheTimeMs = cacheTime * 1000;

  const [data, setData] = useState<T | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [isRevalidating, setIsRevalidating] = useState(false);
  const [error, setError] = useState<Error | undefined>(undefined);

  // Track if mounted to prevent memory leaks
  const isMountedRef = useRef(true);
  // Track if we're doing initial fetch
  const isInitialFetchRef = useRef(true);
  // Track unsubscribe function
  const unsubscribeRef = useRef<(() => void) | null>(null);
  // Track version when request started (for race condition prevention)
  const requestVersionRef = useRef<number>(QueryCache.getCurrentVersion());
  // Track if we're offline (cached at component level)
  const isOfflineRef = useRef<boolean>(false);

  const revalidate = async () => {
    if (disabled) return;

    try {
      setIsRevalidating(true);
      // Capture version at start of request
      const versionAtStart = QueryCache.getCurrentVersion();
      
      const freshData = await QueryCache.fetchWithDedupe(key, () => fetcher(key));

      if (!isMountedRef.current) return;

      // Store in cache with version - if invalidation occurred during fetch,
      // the set will be rejected and data won't be cached
      await QueryCache.set(
        key,
        freshData,
        {
          staleTime: staleTimeMs,
          cacheTime: cacheTimeMs,
          tags,
        },
        versionAtStart // Pass version for race condition prevention
      );

      setData(freshData);
      setError(undefined);
      onSuccess?.(freshData);
    } catch (err) {
      if (!isMountedRef.current) return;

      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
      logger.category('storage').error(`[useQuery] Fetch failed for key "${key}":`, error);
    } finally {
      if (isMountedRef.current) {
        setIsRevalidating(false);
      }
    }
  };

  const invalidate = async () => {
    await QueryCache.remove(key);
    setData(undefined);
    setError(undefined);
    await revalidate();
  };

  const refetch = revalidate;

  // Helper function to handle revalidation based on strategy
  const handleRevalidationStrategy = async (reason: 'fetch' | 'invalidate') => {
    // Check revalidation condition first (if provided)
    if (revalidationCondition) {
      try {
        const shouldRevalidate = await revalidationCondition();
        if (!shouldRevalidate) {
          // Condition returned false - skip auto-revalidation (keep-stale behavior)
          logger.category('storage').debug(`[useQuery] Revalidation condition returned false for key "${key}"; keeping stale data`);
          setIsRevalidating(false);
          setIsLoading(false);
          return;
        }
      } catch (err) {
        // If condition throws, log error but still proceed with revalidation
        logger.category('storage').error(`[useQuery] Revalidation condition error for key "${key}":`, err);
      }
    }

    // Condition passed (or no condition) - proceed with strategy
    switch (revalidationStrategy) {
      case 'immediate':
        // Block UI until fresh data arrives
        setIsRevalidating(true);
        setIsLoading(reason === 'fetch');
        await revalidate();
        break;

      case 'background':
        // Show stale data immediately; fetch in background without blocking
        setIsRevalidating(true);
        setIsLoading(false);
        // Fire and forget - don't await
        revalidate().catch((err) => {
          logger.category('storage').error(`[useQuery] Background revalidation failed for key "${key}":`, err);
        });
        break;

      case 'keep-stale':
        // Don't auto-revalidate; keep showing stale data
        setIsRevalidating(false);
        setIsLoading(false);
        break;
    }
  };

  // Main effect: load data and setup cache subscription
  useEffect(() => {
    isMountedRef.current = true;
    isInitialFetchRef.current = true;
    // Capture version at effect start for race condition prevention
    requestVersionRef.current = QueryCache.getCurrentVersion();

    const loadData = async () => {
      if (disabled) {
        setIsLoading(false);
        return;
      }

      try {
        // Try to get from cache first
        const cachedData = await QueryCache.get<T>(key);

        if (!isMountedRef.current) return;

        if (cachedData !== null) {
          // Have cached data
          setData(cachedData);
          setError(undefined);

          // Determine if we should revalidate based on staleness and cachePriority
          const isStale = await QueryCache.isStale(key);

          switch (cachePriority) {
            case 'networkFirst':
              // networkFirst: Always attempt to fetch fresh data, use cached as fallback
              await handleRevalidationStrategy('fetch');
              break;

            case 'cacheFirst':
              // cacheFirst: Only revalidate on explicit refetch, not automatically
              setIsRevalidating(false);
              setIsLoading(false);
              break;

            case 'offlineFirst':
              // offlineFirst: If offline, don't force revalidation even if stale
              if (isOfflineRef.current) {
                setIsRevalidating(false);
                setIsLoading(false);
              } else if (isStale && revalidateOnFocus) {
                // Online: revalidate if stale (SWR)
                await handleRevalidationStrategy('fetch');
              } else {
                setIsRevalidating(false);
                setIsLoading(false);
              }
              break;

            case 'balanced':
            default:
              // balanced (default): Revalidate if stale (SWR)
              if (isStale) {
                if (revalidateOnFocus) {
                  await handleRevalidationStrategy('fetch');
                } else {
                  setIsRevalidating(false);
                  setIsLoading(false);
                }
              } else {
                // Not stale - use cache as-is
                setIsRevalidating(false);
                setIsLoading(false);
              }
              break;
          }
        } else {
          // No cached data
          switch (cachePriority) {
            case 'networkFirst':
            case 'balanced':
            case 'cacheFirst':
            default:
              // All modes: fetch immediately if no cache exists
              setIsRevalidating(true);
              await revalidate();
              break;

            case 'offlineFirst':
              // offlineFirst: If offline with no cache, keep showing loading/empty
              // until comes online or explicit refetch
              if (isOfflineRef.current) {
                setIsRevalidating(false);
                setIsLoading(false);
              } else {
                setIsRevalidating(true);
                await revalidate();
              }
              break;
          }
        }
      } catch (err) {
        if (!isMountedRef.current) return;

        const error = err instanceof Error ? err : new Error(String(err));
        setError(error);
        onError?.(error);
        logger.category('storage').error(`[useQuery] Initial load failed for key "${key}":`, error);
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
          isInitialFetchRef.current = false;
        }
      }
    };

    // Subscribe to cache updates
    unsubscribeRef.current = QueryCache.subscribe(key, (newData) => {
      if (isMountedRef.current) {
        setData(newData as T);
        setError(undefined);
      }
    });

    loadData();

    return () => {
      isMountedRef.current = false;
      unsubscribeRef.current?.();
    };
    // NOTE: Dependencies intentionally minimal to prevent excessive refetches.
    // Excluded: staleTime, cacheTime, tags, onSuccess, onError, cachePriority
    // - staleTime/cacheTime/tags: Changes don't require refetch; apply to next revalidation
    // - onSuccess/onError: Often redefined on render; memoize with useCallback if stable reference needed
    // - cachePriority: Changes apply to next revalidation cycle
    // If you need immediate effect on these changes, call refetch() manually or change the key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, disabled, revalidateOnFocus]);

  // Track online/offline status for offlineFirst priority using cross-platform NetworkDetection
  // instead of browser-only window.addEventListener (which fails on React Native)
  useEffect(() => {
    // Subscribe to network status changes (handles web, iOS, Android)
    // NetworkDetection provides isOnline and other status properties
    const unsubscribe = NetworkDetection.subscribe((status) => {
      const wasOffline = isOfflineRef.current;
      isOfflineRef.current = !status.isOnline;

      // Log transitions
      if (wasOffline !== isOfflineRef.current) {
        if (isOfflineRef.current) {
          logger.category('storage').debug(`Offline detected for key: ${key}; using cache-only mode`);
        } else {
          logger.category('storage').debug(`Online detected for key: ${key}; may need revalidation`);
          // Note: Automatic revalidation on come-back-online is deferred to next query focus
          // To force revalidation on coming online, call refetch() explicitly
        }
      }
    });

    return () => {
      unsubscribe();
    };
  }, [key]);

  return {
    data,
    isLoading,
    isRevalidating,
    error,
    refetch,
    invalidate,
  };
}
