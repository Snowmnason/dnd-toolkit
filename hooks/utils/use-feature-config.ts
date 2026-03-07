import { getFlag, subscribe, type FeatureFlagName } from "@/lib/feature-flags";
import { useEffect, useState } from "react";

/**
 * Hook to read a feature flag.
 * Subscribes to flag changes so components re-render when toggles are called via console or toggleKind.
 * Re-checks the flag value on every render to support runtime toggles.
 */
export function useFeatureFlag(flagName: FeatureFlagName): boolean {
  const [, setToggleCount] = useState(0);

  useEffect(() => {
    // Subscribe to flag changes and force re-render by incrementing state
    const unsubscribe = subscribe((allFlags: any) => {
      // Re-render when flags update (flagName may have changed)
      setToggleCount((prev) => prev + 1);
    });

    return unsubscribe;
  }, [flagName]);

  return getFlag(flagName as string, false);
}
