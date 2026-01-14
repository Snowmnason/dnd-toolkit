import { useCallback, useEffect, useState } from 'react';
import { useAppParams } from '@/contexts/AppParamsContext';
import { RequestManager } from '../api/request-manager';
import { worldsDB, WorldWithAccess } from '../database/worlds';
import { logger } from '../utils/logger';

/**
 * Custom hook for managing world data and state
 * Provides loading, error handling, and retry functionality
 * @param userId - Optional user ID for optimization. If not provided, uses current auth user
 */
export function useWorlds(userId?: string) {
  const [selectedWorld, setSelectedWorld] = useState<WorldWithAccess | null>(null);
  const [worlds, setWorlds] = useState<WorldWithAccess[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { setConnectedWorldIds } = useAppParams();

  const loadWorlds = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      // Use RequestManager as a centralized layer for:
      // - Deduplicating concurrent world list requests
      // - Retrying on transient failures with exponential backoff
      // - Rate limiting per user to prevent flooding (only when userId is available)
      const userWorlds = await RequestManager.fetch(
        `worlds:user:${userId || 'current'}`,
        () => worldsDB.getMyWorlds(userId),
        {
          dedupe: true,                        // Deduplicate concurrent requests
          retries: 3,                          // Retry 3 times on failure
          retryDelay: 1000,                    // Start with 1 second delay
          // Only apply rate limiting when userId is explicitly provided to avoid
          // lumping all unauthenticated/current-user requests into one bucket
          rateLimitKey: userId ? `user:${userId}:worlds` : undefined,
          timeout: 30000                       // 30 second timeout
        }
      );
      setWorlds(userWorlds ?? []);
      
      // Update connected worlds cache for navigation guard
      if (userWorlds && userWorlds.length > 0) {
        const worldIds = userWorlds.map(w => w.world_id);
        setConnectedWorldIds(worldIds);
      } else {
        setConnectedWorldIds([]);
      }
    } catch (err) {
      logger.error('storage', 'Error loading worlds:', err);
      setError('Failed to load worlds. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [userId, setConnectedWorldIds]); // Include userId and setConnectedWorldIds since they're used in the callback

  // Load worlds on mount
  useEffect(() => {
    loadWorlds();
  }, [loadWorlds]);

  // Retry function for error recovery
  const retry = useCallback(() => {
    setError(null);
    loadWorlds();
  }, [loadWorlds]);

  // Refetch function for manual refresh
  const refetch = useCallback(() => {
    loadWorlds();
  }, [loadWorlds]);

  return {
    // State
    selectedWorld,
    setSelectedWorld,
    worlds,
    isLoading,
    error,
    
    // Actions
    retry,
    refetch,
    loadWorlds
  };
}