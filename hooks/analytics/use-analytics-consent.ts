import { AnalyticsConsent, type ConsentLevel } from '@/lib/analytics';
import { logger } from '@/lib/utils/logger';
import { useCallback, useEffect, useState } from 'react';

export interface UseAnalyticsConsentReturn {
  /** Current consent level */
  level: ConsentLevel;
  /** Update consent level (automatically persists to SecureStorage + queues database sync) */
  setLevel: (level: ConsentLevel) => Promise<void>;
  /** Loading state during initialization or level changes */
  isLoading: boolean;
  /** Whether consent has been initialized from storage */
  isInitialized: boolean;
}

/**
 * Hook for managing analytics consent level.
 *
 * On mount, loads consent from SecureStorage (or database if stale).
 * When level changes, automatically persists to SecureStorage and queues server sync.
 *
 * Usage:
 *   const { level, setLevel, isLoading } = useAnalyticsConsent();
 *   await setLevel('full');  // Updates storage and queues database sync
 *
 * @param options - Optional configuration
 * @param options.maxAgeMs - Cache freshness threshold (default 4 hours)
 * @param options.forceRefresh - Skip cache and force database refresh
 */
export function useAnalyticsConsent(options?: {
  maxAgeMs?: number;
  forceRefresh?: boolean;
}): UseAnalyticsConsentReturn {
  const [level, setLevelState] = useState<ConsentLevel>(() => AnalyticsConsent.getLevel());
  const [isLoading, setIsLoading] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize consent on mount
  useEffect(() => {
    const initializeConsent = async () => {
      setIsLoading(true);
      try {
        const initialLevel = await AnalyticsConsent.initialize(options);
        setLevelState(initialLevel);
        setIsInitialized(true);
        logger.category('analytics').debug('hook_initialized', 'useAnalyticsConsent hook initialized', {
          level: initialLevel,
        });
      } catch (err) {
        logger.category('analytics').error('hook_initialized', 'Failed to initialize consent hook', {
          error: err instanceof Error ? err.message : String(err),
        });
        // Use current in-memory level even if initialization failed
        setLevelState(AnalyticsConsent.getLevel());
        setIsInitialized(true);
      } finally {
        setIsLoading(false);
      }
    };

    initializeConsent();
  }, [options?.maxAgeMs, options?.forceRefresh]);

  // Update consent level and persist
  const updateLevel = useCallback(
    async (newLevel: ConsentLevel) => {
      setIsLoading(true);
      try {
        await AnalyticsConsent.setLevel(newLevel);
        setLevelState(newLevel);
        logger.category('analytics').info('consent_changed', 'Consent level updated via hook', {
          newLevel,
          prevLevel: level,
        });
      } catch (err) {
        logger.category('analytics').error('consent_changed', 'Failed to update consent level', {
          newLevel,
          error: err instanceof Error ? err.message : String(err),
        });
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [level],
  );

  return {
    level,
    setLevel: updateLevel,
    isLoading,
    isInitialized,
  };
}
