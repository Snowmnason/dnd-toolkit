import { FeatureFlagName, FeatureFlags } from '@/lib/feature-flags';

/**
 * Hook to read a feature flag.
 * Note: Recomputes on every render to support runtime toggles via FeatureFlags.toggle().
 */
export function useFeatureFlag(flagName: FeatureFlagName): boolean {
  return FeatureFlags.isEnabled(flagName);
}
