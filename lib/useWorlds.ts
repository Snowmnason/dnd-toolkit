import { useCallback, useEffect, useState } from 'react';
import { WorldWithAccess, worldsDB } from './database/worlds';
import { logger } from './utils/logger';

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
      // Pass userId to getMyWorlds for potential optimization
      const userWorlds = await worldsDB.getMyWorlds(userId);
      setWorlds(userWorlds);
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