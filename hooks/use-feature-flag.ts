import { FeatureFlagName, FeatureFlags } from '@/lib/feature-flags';
import { useMemo } from 'react';

/** Minimal hook to read a feature flag once. */
export function useFeatureFlag(flagName: FeatureFlagName): boolean {
  return useMemo(() => FeatureFlags.isEnabled(flagName), [flagName]);
}
