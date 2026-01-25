/**
 * Feature Gating Hook
 *
 * React hook to check if a feature is gated in the current safe mode state.
 * Use this in components/screens to conditionally disable features.
 *
 * Usage:
 * ```tsx
 * // Simple check
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
 * ```
 */

import {
    AffectedFeature,
    checkFeatureGating,
    getGatedFeatures,
} from "@/lib/error";
import { useAppKernel } from "@/lib/kernel/use-app-kernel";
import { useMemo } from "react";

/**
 * Check if a specific feature is gated (unavailable)
 *
 * Returns true if feature is affected by safe mode, false otherwise
 */
export function useIsFeatureGated(feature: AffectedFeature): boolean {
  const kernel = useAppKernel();
  return useMemo(
    () => checkFeatureGating(feature, kernel.safeMode).isGated,
    [feature, kernel.safeMode],
  );
}

/**
 * Get detailed gating status for a feature
 *
 * Returns { isGated, reason, affectedLevel }
 */
export function useFeatureGatingStatus(feature: AffectedFeature) {
  const kernel = useAppKernel();
  return useMemo(
    () => checkFeatureGating(feature, kernel.safeMode),
    [feature, kernel.safeMode],
  );
}

/**
 * Get all currently gated features
 *
 * Useful for dimming multiple nav items
 */
export function useGatedFeatures(): AffectedFeature[] {
  const kernel = useAppKernel();
  return useMemo(() => getGatedFeatures(kernel.safeMode), [kernel.safeMode]);
}
