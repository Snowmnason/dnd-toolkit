
import { logger } from '@/lib/utils/logger';
import { Analytics } from '@/managers/analytics/analytics-manager';
import { currentConsentLevel, type ConsentLevel } from '@/type-definitions/analytics-types';
import { useCallback, useState } from 'react';

export interface UseAnalyticsConsentReturn {
  /** Current consent level */
  level: ConsentLevel;
  /** Update consent level (automatically persists to SecureStorage + queues database sync) */
  setLevel: (level: ConsentLevel) => Promise<void>;
  /** Loading state during level changes */
  isLoading: boolean;
  /** Always true (initialized by auth flows during bootstrap/sign-in) */
  isInitialized: boolean;
}

/**
 * Hook for managing analytics consent level.
 *
 * Consent is initialized during auth flows (bootstrap sign-in, token restore).
 * This hook reads from the global consent state and provides a way to update it.
 * When level changes, automatically persists to SecureStorage and queues server sync.
 *
 * Usage:
 *   const { level, setLevel, isLoading } = useAnalyticsConsent();
 *   await setLevel('full');  // Updates storage and queues database sync
 */
export function useAnalyticsConsent(): UseAnalyticsConsentReturn {
  const [level, setLevelState] = useState<ConsentLevel>(currentConsentLevel);
  const [isLoading, setIsLoading] = useState(false);

  // Update consent level and persist
  const updateLevel = useCallback(
    async (newLevel: ConsentLevel) => {
      setIsLoading(true);
      try {
        await Analytics.updateConsentLevel(newLevel);
        setLevelState(newLevel);
        logger.category('analytics').info('Consent level updated via hook', {
          newLevel,
          prevLevel: level,
        });
      } catch (err) {
        logger.category('analytics').error('Failed to update consent level', {
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
    isInitialized: true, // Always initialized by auth flows (bootstrap sign-in, token restore)
  };
}
