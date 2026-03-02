'use client';

import React, { useCallback, useRef, useState } from 'react';
import { QueryCache } from '../../lib/storage/cache/query-cache';
import { logger } from '../../lib/utils/logger';

/**
 * Options for useMutation hook
 */
export interface UseMutationOptions<TData, TError = Error> {
  /** Called when mutation succeeds */
  onSuccess?: (data: TData) => void;
  /** Called when mutation fails */
  onError?: (error: TError) => void;
  /** Tags to invalidate after successful mutation */
  invalidateTags?: string[];
  /** Patterns to invalidate after successful mutation */
  invalidatePatterns?: (string | RegExp)[];
  /** Optimistic update function - receives variables and should return updater function */
  optimisticUpdate?: (variables: unknown) => ((prev: any) => any) | undefined;
  /** Tags to target for optimistic updates (improves performance by filtering cache entries) */
  optimisticTags?: string[];
  /** Key pattern to target for optimistic updates (regex to match specific cache keys) */
  optimisticKeyPattern?: RegExp;
}

/**
 * State returned by useMutation hook
 */
export interface UseMutationState<TData, TError = Error> {
  /** Current mutation result */
  data: TData | undefined;
  /** Whether mutation is in progress */
  isLoading: boolean;
  /** Current error, if any */
  error: TError | undefined;
  /** Execute the mutation */
  mutate: (variables: unknown) => Promise<TData>;
  /** Reset mutation state */
  reset: () => void;
}

/**
 * Mutation function type - takes variables and returns data
 */
type MutationFn<TData> = (variables: unknown) => Promise<TData>;

/**
 * Hook for mutations with cache invalidation
 *
 * @example
 * ```ts
 * const { mutate, isLoading, error } = useMutation(
 *   async (data) => {
 *     const updated = await worldsDB.updateWorld(data);
 *     return updated;
 *   },
 *   { invalidateTags: ['worlds'] }
 * );
 *
 * const handleUpdate = async () => {
 *   const result = await mutate({ id: '123', name: 'New Name' });
 * };
 * ```
 */
export function useMutation<TData = unknown, TError = Error>(
  mutationFn: MutationFn<TData>,
  options: UseMutationOptions<TData, TError> = {},
): UseMutationState<TData, TError> {
  const {
    onSuccess,
    onError,
    invalidateTags = [],
    invalidatePatterns = [],
    optimisticUpdate,
    optimisticTags,
    optimisticKeyPattern,
  } = options;

  const [data, setData] = useState<TData | undefined>(undefined);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<TError | undefined>(undefined);

  // Track if mounted
  const isMountedRef = useRef(true);

  const mutate = useCallback(
    async (variables: unknown): Promise<TData> => {
      setIsLoading(true);
      setError(undefined);

      // Apply optimistic update if provided
      let optimisticRevert: (() => void) | undefined;
      if (optimisticUpdate) {
        const updater = optimisticUpdate(variables);
        if (updater) {
          optimisticRevert = QueryCache.applyOptimisticUpdate(updater, {
            tags: optimisticTags,
            keyPattern: optimisticKeyPattern,
          });
        }
      }

      try {
        const result = await mutationFn(variables);

        if (!isMountedRef.current) return result;

        setData(result);
        setError(undefined);

        // Invalidate cache by tags
        if (invalidateTags.length > 0) {
          await QueryCache.invalidateByTags(invalidateTags);
        }

        // Invalidate cache by patterns
        for (const pattern of invalidatePatterns) {
          await QueryCache.invalidate(pattern);
        }

        onSuccess?.(result);
        return result;
      } catch (err) {
        // Revert optimistic update on failure
        if (optimisticRevert) {
          optimisticRevert();
        }

        if (!isMountedRef.current) throw err;

        const error = (err instanceof Error ? err : new Error(String(err))) as TError;
        setError(error);
        onError?.(error);
        logger.category('storage').error('[useMutation] Mutation failed:', err);
        throw error;
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    },
    [mutationFn, invalidateTags, invalidatePatterns, onSuccess, onError, optimisticUpdate, optimisticTags, optimisticKeyPattern],
  );

  const reset = useCallback(() => {
    setData(undefined);
    setError(undefined);
    setIsLoading(false);
  }, []);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  return {
    data,
    isLoading,
    error,
    mutate,
    reset,
  };
}
