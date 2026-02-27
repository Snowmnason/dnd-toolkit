/**
 * Feature Gating Hooks
 *
 * React hooks to check if features are gated in the current safe mode state.
 * Use this in components/screens to conditionally disable features.
 *
 * IMPORTANT: Always pass stable enum values (e.g., AffectedFeature.SYNC)
 * Do not pass dynamic/computed values. If the feature comes from props, wrap it in useMemo.
 *
 * Usage:
 * ```tsx
 * // Simple check - pass enum value directly
 * const isSyncGated = useIsFeatureGated(AffectedFeature.SYNC);
 *
 * // Get full status with reason
 * const syncStatus = useFeatureGatingStatus(AffectedFeature.SYNC);
 * if (syncStatus.isGated) {
 *   showMessage(syncStatus.reason);
 * }
 *
 * // Get all gated features
 * const gatedFeatures = useGatedFeatures();
 *
 * // If feature comes from props, memoize it:
 * const feature = useMemo(() => featureFromProps, [featureFromProps]);
 * const status = useFeatureGatingStatus(feature);
 * ```
 */

import { useAppKernel } from "@/hooks/kernel/use-app-kernel";
import {
  AffectedFeature,
  checkFeatureGating,
  getGatedFeatures,
} from "@/lib/error";
import { useMemo } from "react";

/**
 * Check if a specific feature is gated (unavailable)
 *
 * @param feature - Must be a stable enum value (AffectedFeature.SYNC, etc.)
 * @returns true if feature is affected by safe mode, false otherwise
 *
 * Performance: O(1) check, memoized on feature + kernel.safeMode changes
 */
export function useIsFeatureGated(feature: AffectedFeature): boolean {
  const kernel = useAppKernel();
  // Memoize feature to ensure stable reference (though enum values are normally stable)
  const stableFeature = useMemo(() => feature, [feature]);
  return useMemo(
    () => checkFeatureGating(stableFeature, kernel.safeMode).isGated,
    [stableFeature, kernel.safeMode],
  );
}

/**
 * Get detailed gating status for a feature
 *
 * @param feature - Enum value (AffectedFeature.SYNC, etc.) or null
 * @returns { isGated, reason, affectedLevel } - Returns not gated for null features
 *
 * Performance: O(1) check, memoized on feature + kernel.safeMode changes
 */
export function useFeatureGatingStatus(feature: AffectedFeature | null) {
  const kernel = useAppKernel();
  // Memoize feature to ensure stable reference (though enum values are normally stable)
  const stableFeature = useMemo(() => feature, [feature]);
  return useMemo(() => {
    // Return not gated status for null features
    if (stableFeature === null) {
      return { isGated: false, reason: "", affectedLevel: null };
    }
    return checkFeatureGating(stableFeature, kernel.safeMode);
  }, [stableFeature, kernel.safeMode]);
}

/**
 * Get all currently gated features
 *
 * Useful for dimming multiple nav items or iterating over disabled features
 *
 * Performance: O(n) where n = number of affected features, memoized on kernel.safeMode changes
 */
export function useGatedFeatures(): AffectedFeature[] {
  const kernel = useAppKernel();
  return useMemo(() => getGatedFeatures(kernel.safeMode), [kernel.safeMode]);
}
