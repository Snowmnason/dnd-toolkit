import { FeatureFlagName, FeatureFlags } from "@/lib/feature-flags";
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
    const unsubscribe = FeatureFlags.subscribe((changedFlagName, kind) => {
      // Re-render if:
      // 1. A specific flag was toggled and it matches this one
      // 2. A kind was toggled (we can't know which flags were affected, so re-render to be safe)
      // 3. All flags changed (changedFlagName === null, e.g. syncFromServer)
      if (
        changedFlagName === flagName ||
        changedFlagName === null ||
        kind !== undefined
      ) {
        setToggleCount((prev) => prev + 1);
      }
    });

    return unsubscribe;
  }, [flagName]);

  return FeatureFlags.isEnabled(flagName);
}
