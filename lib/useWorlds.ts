import { useCallback, useEffect, useState } from 'react';
import { WorldWithAccess, worldsDB } from './database/worlds';

/**
 * Custom hook for managing world data and state
 * Provides loading, error handling, and retry functionality
 */
export function useWorlds() {
  const [selectedWorld, setSelectedWorld] = useState<WorldWithAccess | null>(null);
  const [worlds, setWorlds] = useState<WorldWithAccess[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadWorlds = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const userWorlds = await worldsDB.getMyWorlds();
      setWorlds(userWorlds);
    } catch (err) {
      console.error('Error loading worlds:', err);
      setError('Failed to load worlds. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

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