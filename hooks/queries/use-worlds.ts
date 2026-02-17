import { useCallback, useState } from "react";
import { CACHE_CONFIG, CACHE_KEYS, CACHE_TAGS } from "../../lib/cache/keys";
import { useQuery } from "../../lib/cache/use-query";
import { worldsDB, WorldWithAccess } from "../../lib/database/worlds";
import { getQualityAwareCacheKey } from "../../lib/network/adaptive-payload-integration";
import { worldAccessCache } from "../../lib/storage/world-access-cache";
import { logger } from "../../lib/utils/logger";
import { useAdaptivePayloadCacheInvalidation } from "../network/useAdaptivePayloadCacheInvalidation";

/**
 * Hook for managing world data with SWR (Stale-While-Revalidate) pattern
 * 
 * Features:
 * - Returns cached worlds immediately
 * - Background revalidation while stale
 * - Automatic invalidation on mutations
 * - Loading/error handling
 * - Supports adaptive payload sizing based on network quality
 *
 * @param userId - Optional user ID. If not provided, uses current auth user
 * @param onWorldsLoaded - Optional callback when worlds are loaded
 */
export function useWorlds(
  userId?: string,
  onWorldsLoaded?: (worldIds: string[]) => void,
) {
  // Set up cache invalidation on network quality changes
  useAdaptivePayloadCacheInvalidation({
    tagsToInvalidate: ['worlds'],
    skipInitialCheck: true,
  });

  const [selectedWorld, setSelectedWorld] = useState<WorldWithAccess | null>(
    null,
  );

  // Build quality-aware cache key
  const cacheKey = getQualityAwareCacheKey({
    baseCacheKey: CACHE_KEYS.worlds.list(userId || "current"),
    cacheTagsToInvalidate: ['worlds'],
  });

  // Use QueryCache with SWR pattern for worlds fetching
  const {
    data: worlds = [],
    isLoading,
    error,
    refetch,
  } = useQuery<WorldWithAccess[]>(
    cacheKey,
    async () => {
      const userWorlds = await worldsDB.getMyWorlds(userId);

      // Update world access cache for all loaded worlds
      // These worlds are confirmed accessible since they came from the server's getMyWorlds()
      if (userWorlds && userWorlds.length > 0) {
        await Promise.all(
          userWorlds.map((world) =>
            worldAccessCache.updateAccessFlag(world.world_id, true, "add"),
          ),
        );
      }

      // Notify parent if callback provided
      if (onWorldsLoaded) {
        const worldIds = userWorlds?.map((w) => w.world_id) ?? [];
        onWorldsLoaded(worldIds);
      }

      return userWorlds;
    },
    {
      ...CACHE_CONFIG.metadata, // Default: staleTime 2h, cacheTime 4h
      tags: [CACHE_TAGS.worlds, CACHE_TAGS.user(userId || "current")],
      // Query fires immediately, skipCache forces DB fetch on fresh sign-in
      onError: (err) => {
        logger.error("cache", "Error loading worlds:", err);
      },
    },
  );


  // Format error message
  const errorMessage = error
    ? "Failed to load worlds. Please try again."
    : null;

  // Retry function for error recovery (calls refetch)
  const retry = useCallback(() => {
    refetch();
  }, [refetch]);

  return {
    // State
    selectedWorld,
    setSelectedWorld,
    worlds,
    isLoading,
    error: errorMessage,

    // Actions
    retry,
    refetch,
  };
}
