import { useQuery } from '@/lib/cache';
import { worldsDB } from '@/lib/database/worlds';

/**
 * Hook for fetching worlds with SWR pattern
 * Returns both owned and member worlds for current user
 *
 * @example
 * ```tsx
 * const { worlds, isLoading, error, refetch } = useWorldsQuery();
 *
 * if (isLoading) return <Loading />;
 * if (error) return <Error error={error} onRetry={refetch} />;
 *
 * return (
 *   <ScrollView>
 *     {worlds?.map(world => <WorldCard key={world.world_id} world={world} />)}
 *   </ScrollView>
 * );
 * ```
 */
export function useWorldsQuery() {
  const { data, error, isLoading, isValidating, refetch, invalidate } = useQuery(
    'worlds:list',
    () => worldsDB.getMyWorlds(),
    {
      staleTime: 2 * 60 * 60 * 1000, // 2 hours
      cacheTime: 4 * 60 * 60 * 1000, // 4 hours
      tags: ['worlds'],
    },
  );

  return {
    worlds: data ?? [],
    isLoading,
    isValidating,
    error: error?.message ?? null,
    refetch,
    invalidate,
  };
}
