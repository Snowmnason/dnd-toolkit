import { useAdaptivePayloadCacheInvalidation } from '@/hooks/network/useAdaptivePayloadCacheInvalidation';
import { useQuery } from '@/hooks/storage';
import { worldsDB } from '@/lib/database/worlds';
import { getAdaptiveQueryParams, getQualityAwareCacheKey } from '@/lib/network';

/**
 * Hook for fetching worlds with SWR pattern
 * Returns both owned and member worlds for current user
 * 
 * Supports adaptive payload sizing based on network quality.
 * Cache keys include quality tier (4g/3g/2g/offline) to store variants separately.
 *
 * @example
 * ```tsx
 * // Get all worlds (default behavior)
 * const { worlds, isLoading, error, refetch } = useWorldsQuery();
 *
 * // Get paginated worlds
 * const { worlds, total, isLoading, error, refetch } = useWorldsQuery({ page: 1, limit: 10 });
 *
 * if (isLoading) return <Loading />;
 * if (error) return <Error error={error} onRetry={refetch} />;
 *
 * return (
 *   <ScrollView>
 *     {worlds?.map(world => <WorldCard key={world.world_id} world={world} />)}
 *     {total && <Text>Total: {total}</Text>}
 *   </ScrollView>
 * );
 * ```
 */
export function useWorldsQuery(options: { page?: number; limit?: number } = {}) {
  const { page, limit } = options;
  const isPaginated = page !== undefined && limit !== undefined;

  // Set up cache invalidation on network quality changes
  // This hook watches NetworkDetection and refetches when quality changes
  useAdaptivePayloadCacheInvalidation({
    tagsToInvalidate: ['worlds'],
    skipInitialCheck: true,
  });

  // Build quality-aware cache key
  // Same worlds:list but quality tier appended (e.g., 'worlds:list:4g' vs 'worlds:list:2g')
  const baseCacheKey = isPaginated ? `worlds:list:${page}:${limit}` : 'worlds:list';
  const queryKey = getQualityAwareCacheKey({
    baseCacheKey,
    cacheTagsToInvalidate: ['worlds'],
  });

  // Get adaptive params for this quality level
  // Note: Currently worldsDB methods don't use params, but this prepares for future API integration
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const adaptiveParams = getAdaptiveQueryParams();

  const queryFn = isPaginated
    ? () => worldsDB.getMyWorldsPaginated(undefined, { page, limit })
    : async () => {
        const worlds = await worldsDB.getMyWorlds();
        return { items: worlds, total: worlds.length };
      };

  const { data, error, isLoading, isValidating, refetch, invalidate } = useQuery(
    queryKey,
    queryFn,
    {
      staleTime: 2 * 60 * 60 * 1000, // 2 hours
      cacheTime: 4 * 60 * 60 * 1000, // 4 hours
      tags: ['worlds'],
    },
  );

  // Data is always in paginated format now
  const worlds = data?.items ?? [];
  const total = data?.total ?? 0;

  return {
    worlds,
    total,
    isLoading,
    isValidating,
    error: error?.message ?? null,
    refetch,
    invalidate,
  };
}
