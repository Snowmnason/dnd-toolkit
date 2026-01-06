import { useCallback, useEffect, useState } from 'react';
import { worldsDB, WorldWithAccess } from '../database/worlds';
import { logger } from '../utils/logger';
import { RequestManager } from '../index';

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

  const loadWorlds = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      // Use RequestManager as a centralized layer for:
      // - Deduplicating concurrent world list requests
      // - Retrying on transient failures with exponential backoff
      // - Rate limiting per user to prevent flooding
      const userWorlds = await RequestManager.fetch(
        `worlds:user:${userId || 'current'}`,
        () => worldsDB.getMyWorlds(userId),
        {
          dedupe: true,                        // Deduplicate concurrent requests
          retries: 3,                          // Retry 3 times on failure
          retryDelay: 1000,                    // Start with 1 second delay
          rateLimitKey: `user:${userId}:worlds`, // Rate limit per user
          timeout: 30000                       // 30 second timeout
        }
      );
      setWorlds(userWorlds ?? []);
    } catch (err) {
      logger.error('useWorlds', 'Error loading worlds:', err);
      setError('Failed to load worlds. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [userId]); // Include userId since it's used in the callback

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