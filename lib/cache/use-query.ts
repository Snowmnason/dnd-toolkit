'use client';

import { useEffect, useRef, useState } from 'react';
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

          // Check if stale
          const isStale = await QueryCache.isStale(key);
          if (isStale && revalidateOnFocus) {
            // Stale - revalidate in background
            setIsValidating(true);
            await revalidate();
          } else {
            setIsValidating(false);
            setIsLoading(false);
          }
        } else {
          // No cached data - fetch immediately
          setIsValidating(true);
          await revalidate();
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
    // Excluded: staleTime, cacheTime, tags, onSuccess, onError
    // - staleTime/cacheTime/tags: Changes don't require refetch; apply to next revalidation
    // - onSuccess/onError: Often redefined on render; memoize with useCallback if stable reference needed
    // If you need immediate effect on these changes, call refetch() manually or change the key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, disabled, revalidateOnFocus]);

  return {
    data,
    isLoading,
    isValidating,
    error,
    refetch,
    invalidate,
  };
}
