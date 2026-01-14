import { useCallback, useState } from 'react';
import { useQuery } from '../cache/use-query';
import { worldsDB, WorldWithAccess } from '../database/worlds';
import { SecureStorage } from '../storage';
import { logger } from '../utils/logger';
import { CACHE_KEYS, CACHE_TAGS, CACHE_CONFIG } from '../cache/keys';

/**
 * Hook for managing world data with SWR (Stale-While-Revalidate) pattern
 * 
 * Features:
 * - Returns cached worlds immediately
 * - Background revalidation while stale
 * - Automatic invalidation on mutations
 * - Loading/error handling
 * 
 * @param userId - Optional user ID. If not provided, uses current auth user
 * @param onWorldsLoaded - Optional callback when worlds are loaded
 */
export function useWorlds(userId?: string, onWorldsLoaded?: (worldIds: string[]) => void) {
  const [selectedWorld, setSelectedWorld] = useState<WorldWithAccess | null>(null);

  // Use QueryCache with SWR pattern for worlds fetching
  const { 
    data: worlds = [], 
    isLoading, 
    error, 
    refetch 
  } = useQuery<WorldWithAccess[]>(
    CACHE_KEYS.worlds.list(userId || 'current'),
    async () => {
      const userWorlds = await worldsDB.getMyWorlds(userId);
      
      // Update world access cache for all loaded worlds
      // These worlds are confirmed accessible since they came from the server's getMyWorlds()
      if (userWorlds && userWorlds.length > 0) {
        for (const world of userWorlds) {
          const cacheKey = `world_access_${world.world_id}`;
          const metaKey = `world_access_meta_${world.world_id}`;
          await SecureStorage.setJSON(cacheKey, true); // User has access
          await SecureStorage.setJSON(metaKey, {
            timestamp: Date.now(),
            source: 'server_verified'
          });
        }
      }

      // Notify parent if callback provided
      if (onWorldsLoaded) {
        const worldIds = userWorlds?.map(w => w.world_id) ?? [];
        onWorldsLoaded(worldIds);
      }

      return userWorlds;
    },
    {
      ...CACHE_CONFIG.metadata,  // Default: staleTime 2h, cacheTime 4h
      tags: [CACHE_TAGS.worlds, CACHE_TAGS.user(userId || 'current')],
      onError: (err) => {
        logger.error('cache', 'Error loading worlds:', err);
      }
    }
  );

  // Format error message
  const errorMessage = error ? 'Failed to load worlds. Please try again.' : null;

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
    refetch
  };
}