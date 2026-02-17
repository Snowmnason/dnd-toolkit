'use client';

import { useEffect, useRef, useState } from 'react';
import { NetworkDetection } from '../network';
import { logger } from '../utils/logger';
import { QueryCache } from './query-cache';

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
  isValidating: boolean;
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
  } = options;

  // Convert staleTime and cacheTime from seconds to milliseconds for QueryCache
  const staleTimeMs = staleTime * 1000;
  const cacheTimeMs = cacheTime * 1000;

  const [data, setData] = useState<T | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [isValidating, setIsValidating] = useState(false);
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
      setIsValidating(true);
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
      logger.error(`[useQuery] Fetch failed for key "${key}":`, error);
    } finally {
      if (isMountedRef.current) {
        setIsValidating(false);
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
              setIsValidating(true);
              setIsLoading(false);
              await revalidate();
              break;

            case 'cacheFirst':
              // cacheFirst: Only revalidate on explicit refetch, not automatically
              setIsValidating(false);
              setIsLoading(false);
              break;

            case 'offlineFirst':
              // offlineFirst: If offline, don't force revalidation even if stale
              if (isOfflineRef.current) {
                setIsValidating(false);
                setIsLoading(false);
              } else if (isStale && revalidateOnFocus) {
                // Online: revalidate if stale (SWR)
                setIsValidating(true);
                await revalidate();
              } else {
                setIsValidating(false);
                setIsLoading(false);
              }
              break;

            case 'balanced':
            default:
              // balanced (default): Revalidate if stale (SWR)
              if (isStale) {
                if (revalidateOnFocus) {
                  setIsValidating(true);
                  await revalidate();
                } else {
                  setIsValidating(false);
                  setIsLoading(false);
                }
              } else {
                // Not stale - use cache as-is
                setIsValidating(false);
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
              setIsValidating(true);
              await revalidate();
              break;

            case 'offlineFirst':
              // offlineFirst: If offline with no cache, keep showing loading/empty
              // until comes online or explicit refetch
              if (isOfflineRef.current) {
                setIsValidating(false);
                setIsLoading(false);
              } else {
                setIsValidating(true);
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
        logger.error(`[useQuery] Initial load failed for key "${key}":`, error);
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
          logger.debug('cache', `Offline detected for key: ${key}; using cache-only mode`);
        } else {
          logger.debug('cache', `Online detected for key: ${key}; may need revalidation`);
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
    isValidating,
    error,
    refetch,
    invalidate,
  };
}
