import { getAllFlags, getFlag, subscribe, type FeatureFlagName } from "@/lib/feature-flags";
import { logger } from "@/lib/utils/logger";
import { useEffect, useState } from "react";

/**
 * Hook to access a specific server-synced feature flag
 *
 * Subscribes to flag changes and re-renders when flags update.
 * Uses synchronous getFlag() method with proper priority:
 * 1. User override (admin testing)
 * 2. Server value (from startup bootstrap)
 * 3. Config-driven value (offline fallback)
 * 4. Hardcoded fallback
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
      const enabled = getFlag(flagName, fallback);
      const allFlags = getAllFlags();
      /* eslint-disable-next-line security/detect-object-injection */
      const source = (allFlags[flagName] as any)?.source || "fallback";

      setState({ enabled, loading: false, error: null, source });
      logger.category('feature_flags').debug(`useFeatureFlags(${flagName}): initialized`, {
        enabled,
        source,
      });
    } catch (error) {
      setState({ enabled: fallback, loading: false, error: error as Error });
      logger.category('feature_flags').error(`useFeatureFlags(${flagName}): error`, error);
    }

    // Subscribe to updates
    const unsubscribe = subscribe((updatedFlags: any) => {
      try {
        const enabled = getFlag(flagName, fallback);
        /* eslint-disable-next-line security/detect-object-injection */
        const source = updatedFlags[flagName]?.source || "fallback";
        setState({ enabled, loading: false, error: null, source });
        logger.category('feature_flags').debug(`useFeatureFlags(${flagName}): updated`, {
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

/**
 * Simple hook to read a feature flag as a plain boolean.
 * Subscribes to flag changes so components re-render when flags are toggled.
 *
 * Use this when you only need `true`/`false` and don't need loading/error states.
 * Use `useFeatureFlags` when you need the full `{ enabled, loading, error, source }` shape.
 *
 * @example
 * ```tsx
 * const showBetaUI = useFeatureFlag("betaUI");
 * ```
 */
export function useFeatureFlag(flagName: FeatureFlagName): boolean {
  const [, forceUpdate] = useState(0);

  useEffect(() => {
    const unsubscribe = subscribe(() => forceUpdate((n) => n + 1));
    return unsubscribe;
  }, [flagName]);

  return getFlag(flagName as string, false);
}
