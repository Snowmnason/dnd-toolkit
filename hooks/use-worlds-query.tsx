import { useQuery } from '@/lib/cache';
import { worldsDB } from '@/lib/database/worlds';

/**
 * Hook for fetching worlds with SWR pattern
 * Returns both owned and member worlds for current user
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

  const queryKey = isPaginated ? `worlds:list:${page}:${limit}` : 'worlds:list';
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
