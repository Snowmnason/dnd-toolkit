import {
    FeatureFlagsManager,
    type FeatureFlagState,
} from "@/lib/feature-flags";
import { logger } from "@/lib/utils/logger";
import { useEffect, useState } from "react";

/**
 * Hook to access a specific server-synced feature flag
 *
 * Subscribes to FeatureFlagsManager and re-renders when flags change.
 * Uses synchronous getFlag() method with proper priority:
 * 1. User override (admin testing)
 * 2. Server value (from startup bootstrap)
 * 3. Hardcoded fallback
 *
 * @param flagName - Name of the flag to check
 * @param fallback - Default value if flag not found (default: false)
 * @returns Object with { enabled, loading, error, source }
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { enabled, loading } = useFeatureFlags("premiumUI");
 *
 *   if (loading) return <div>Loading...</div>;
 *   return enabled ? <PremiumUI /> : <FreeUI />;
 * }
 * ```
 */
export function useFeatureFlags(
  flagName: string,
  fallback: boolean = false,
): { enabled: boolean; loading: boolean; error: Error | null; source?: string } {
  const [state, setState] = useState<{
    enabled: boolean;
    loading: boolean;
    error: Error | null;
    source?: string;
  }>({
    enabled: fallback,
    loading: true,
    error: null,
  });

  useEffect(() => {
    // Get initial value (synchronous)
    try {
      const enabled = FeatureFlagsManager.getFlag(flagName, fallback);
      const allFlags = FeatureFlagsManager.getAllFlags();
      const source = allFlags[flagName]?.source || "fallback";

      setState({ enabled, loading: false, error: null, source });
      logger.debug("ui", `useFeatureFlags(${flagName}): initialized`, {
        enabled,
        source,
      });
    } catch (error) {
      setState({ enabled: fallback, loading: false, error: error as Error });
      logger.error("ui", `useFeatureFlags(${flagName}): error`, error);
    }

    // Subscribe to updates
    const unsubscribe = FeatureFlagsManager.subscribe((updatedFlags) => {
      try {
        const enabled = FeatureFlagsManager.getFlag(flagName, fallback);
        const source = updatedFlags[flagName]?.source || "fallback";
        setState({ enabled, loading: false, error: null, source });
        logger.debug("ui", `useFeatureFlags(${flagName}): updated`, {
          enabled,
          source,
        });
      } catch (error) {
        setState({ enabled: fallback, loading: false, error: error as Error });
      }
    });

    return unsubscribe;
  }, [flagName, fallback]);

  return state;
}
