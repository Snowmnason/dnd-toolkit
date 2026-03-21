```ts
/**
 * Example: useWorldsQuery with Adaptive Payload Integration
 * 
 * This file demonstrates how to integrate the adaptive payload system into
 * an existing query hook. It shows the three key integration points:
 * 1. Quality-aware cache key
 * 2. Quality-aware fetcher (optional params/field selection based on quality)
 * 3. Cache invalidation on quality change
 * 
 * USAGE PATTERN:
 * - Replace the base cache key with getQualityAwareCacheKey()
 * - Update the fetcher to include quality-aware parameters when making requests
 * - Call useAdaptivePayloadCacheInvalidation in the hook or parent component
 * 
 * WHEN APPLIED TO REAL HOOKS:
 * - DO NOT rename the function (keeps existing API backward compatible)
 * - DO call useAdaptivePayloadCacheInvalidation in the component using this hook
 * - DO update staleTime logic to use getStaleTimeForQuality() if needed
 * 
 * @see lib/network/adaptive-payload-integration.ts for helper functions
 * @see hooks/network/useAdaptivePayloadCacheInvalidation.ts for cache invalidation
 */

import { useAdaptivePayloadCacheInvalidation } from '@/hooks/network/useAdaptivePayloadCacheInvalidation';
import { useQuery } from '@/lib/cache';
import { worldsDB } from '@/lib/database/worlds';
import { getQualityAwareCacheKey, getStaleTimeForQuality } from '@/lib/network/adaptive-payload-integration';

/**
 * Example 1: Basic integration with quality-aware cache key
 * 
 * The quality is automatically detected and included in the cache key,
 * so worlds loaded on 4G will be cached separately from 2G loads.
 */
export function useWorldsQueryAdaptive_BasicKeyOnly(
  options: { page?: number; limit?: number } = {}
) {
  const { page, limit } = options;
  const isPaginated = page !== undefined && limit !== undefined;

  // Generate quality-aware cache key
  // e.g., 'worlds:list' -> 'worlds:list:4g' (on 4G) or 'worlds:list:2g' (on 2G)
  const baseCacheKey = isPaginated ? `worlds:list:${page}:${limit}` : 'worlds:list';
  const queryKey = getQualityAwareCacheKey({
    baseCacheKey,
    cacheTagsToInvalidate: ['worlds']
  });

  const queryFn = isPaginated
    ? () => worldsDB.getMyWorldsPaginated(undefined, { page, limit })
    : async () => {
        const worlds = await worldsDB.getMyWorlds();
        return { items: worlds, total: worlds.length };
      };

  const { data, error, isLoading, isRevalidating, refetch, invalidate } = useQuery(
    queryKey,
    queryFn,
    {
      staleTime: 2 * 60 * 60 * 1000, // 2 hours (can be dynamic with getStaleTimeForQuality)
      cacheTime: 4 * 60 * 60 * 1000,
      tags: ['worlds'],
    },
  );

  const worlds = data?.items ?? [];
  const total = data?.total ?? 0;

  return {
    worlds,
    total,
    isLoading,
    isRevalidating,
    error: error?.message ?? null,
    refetch,
    invalidate,
  };
}

/**
 * Example 2: Advanced integration with quality-aware parameters
 * 
 * This example shows how to pass quality-aware parameters to the fetcher.
 * Useful for REST API calls that support adaptive payloads (image quality, field selection, etc.).
 */
export function useWorldsQueryAdaptive_WithParams(
  options: { page?: number; limit?: number } = {}
) {
  const { page, limit } = options;
  const isPaginated = page !== undefined && limit !== undefined;

  const baseCacheKey = isPaginated ? `worlds:list:${page}:${limit}` : 'worlds:list';
  const queryKey = getQualityAwareCacheKey({
    baseCacheKey,
    cacheTagsToInvalidate: ['worlds']
  });

  const queryFn = isPaginated
    ? () => worldsDB.getMyWorldsPaginated(undefined, { page, limit })
    : async () => {
        // For REST API integration: getAdaptiveQueryParams() would provide:
        // { imageQuality: 'sd', excludeMaps: true, summaryOnly: false, ... }
        // These would be passed as query params: GET /api/worlds?imageQuality=sd&excludeMaps=true
        const worlds = await worldsDB.getMyWorlds();
        return { items: worlds, total: worlds.length };
      };

  // Invalidate cache when network quality changes
  // This hook watches NetworkDetection and refetches automatically
  useAdaptivePayloadCacheInvalidation({
    tagsToInvalidate: ['worlds'],
    skipInitialCheck: true,
  });

  const { data, error, isLoading, isRevalidating, refetch, invalidate } = useQuery(
    queryKey,
    queryFn,
    {
      // Use dynamic stale time based on quality
      // Returns: 2min for 4G, 5min for 3G, 15min for 2G, infinity for offline
      staleTime: getStaleTimeForQuality(queryKey),
      cacheTime: 4 * 60 * 60 * 1000,
      tags: ['worlds'],
    },
  );

  const worlds = data?.items ?? [];
  const total = data?.total ?? 0;

  return {
    worlds,
    total,
    isLoading,
    isRevalidating,
    error: error?.message ?? null,
    refetch,
    invalidate,
  };
}

/**
 * Example 3: Component-level integration
 * 
 * If you prefer not to call useAdaptivePayloadCacheInvalidation in the hook itself,
 * you can call it in the component that uses the hook. This is useful for shared hooks
 * that might be used in multiple contexts.
 */
export function useWorldsQueryAdaptive_ComponentLevel(
  options: { page?: number; limit?: number } = {}
) {
  const { page, limit } = options;
  const isPaginated = page !== undefined && limit !== undefined;

  const baseCacheKey = isPaginated ? `worlds:list:${page}:${limit}` : 'worlds:list';
  const queryKey = getQualityAwareCacheKey({
    baseCacheKey,
    cacheTagsToInvalidate: ['worlds']
  });

  const queryFn = isPaginated
    ? () => worldsDB.getMyWorldsPaginated(undefined, { page, limit })
    : async () => {
        const worlds = await worldsDB.getMyWorlds();
        return { items: worlds, total: worlds.length };
      };

  // NO useAdaptivePayloadCacheInvalidation here

  const { data, error, isLoading, isRevalidating, refetch, invalidate } = useQuery(
    queryKey,
    queryFn,
    {
      staleTime: 2 * 60 * 60 * 1000,
      cacheTime: 4 * 60 * 60 * 1000,
      tags: ['worlds'],
    },
  );

  const worlds = data?.items ?? [];
  const total = data?.total ?? 0;

  return {
    worlds,
    total,
    isLoading,
    isRevalidating,
    error: error?.message ?? null,
    refetch,
    invalidate,
  };
}

/**
 * COMPONENT USAGE (for Example 3):
 * 
 * export function WorldsScreen() {
 *   // Invalidate cache when quality changes
 *   useAdaptivePayloadCacheInvalidation({
 *     tagsToInvalidate: ['worlds'],
 *     skipInitialCheck: true,
 *   });
 * 
 *   // Use the hook
 *   const { worlds, isLoading } = useWorldsQueryAdaptive_ComponentLevel();
 * 
 *   if (isLoading) return <Loading />;
 *   return (
 *     <ScrollView>
 *       {worlds.map(w => <WorldCard key={w.world_id} world={w} />)}
 *     </ScrollView>
 *   );
 * }
 */

/**
 * REAL-WORLD MIGRATION CHECKLIST:
 * 
 * When applying this pattern to actual hooks:
 * 
 * 1. [ ] Identify the base cache key (string or template)
 * 2. [ ] Call getQualityAwareCacheKey() at the start of the hook
 * 3. [ ] Pass the quality-aware key to useQuery()
 * 4. [ ] (Optional) Update fetcher to include quality params via getAdaptiveQueryParams()
 * 5. [ ] (Optional) Set up cache invalidation:
 *        - Option A: Inside the hook with useAdaptivePayloadCacheInvalidation()
 *        - Option B: In the consuming component
 * 6. [ ] Test with NetworkDetection mocked to different quality levels
 * 7. [ ] Verify separate caches for different quality levels
 * 8. [ ] Verify automatic refetch on quality change
 * 
 * NO BREAKING CHANGES:
 * - The hook's return type stays the same
 * - The hook's input options stay the same
 * - Only the internal caching behavior changes (now quality-aware)
 * - External API is fully backward compatible
 */
```