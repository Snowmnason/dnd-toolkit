/**
 * Feature Gating Service
 *
 * Manages which features are available/gated based on current safe mode state.
 * This is the central place to check if a feature should be disabled.
 *
 * Usage (in components/screens later):
 * ```tsx
 * const isGated = useIsFeatureGated(AffectedFeature.SYNC);
 * const { isGated, reason } = useFeatureGatingStatus(AffectedFeature.PREMIUM);
 * ```
 */

import { AffectedFeature, SafeModeLevel, SafeModeState } from "./safe-mode";

/**
 * Result of feature gating check
 */
export interface FeatureGatingStatus {
  isGated: boolean;
  reason?: string;
  affectedLevel?: SafeModeLevel;
}

/**
 * Get human-readable explanation for why a feature is gated
 */
export function getFeatureGatingReason(
  feature: AffectedFeature,
  safeMode: SafeModeState | null,
): string {
  if (!safeMode) {
    return "";
  }

  switch (feature) {
    case AffectedFeature.SYNC:
      return "Data synchronization is temporarily unavailable.";
    case AffectedFeature.PREMIUM:
      return "Premium features are unavailable during safe mode.";
    case AffectedFeature.OFFLINE_MODE:
      return "Offline mode is unavailable due to storage issues.";
    case AffectedFeature.BACKGROUND_JOBS:
      return "Background tasks are disabled during safe mode.";
    case AffectedFeature.IMAGE_OPTIMIZATION:
      return "Image optimization is disabled due to storage constraints.";
    case AffectedFeature.ANALYTICS:
      return "Analytics collection is disabled.";
    case AffectedFeature.CLOUD_STORAGE:
      return "Cloud storage features are unavailable.";
    default:
      return "This feature is temporarily unavailable.";
  }
}

/**
 * Check if a feature is gated (unavailable) based on safe mode state
 *
 * @param feature - The feature to check
 * @param safeMode - Current safe mode state (null = NORMAL, no features gated)
 * @returns Status object with gating info
 */
export function checkFeatureGating(
  feature: AffectedFeature,
  safeMode: SafeModeState | null,
): FeatureGatingStatus {
  // NORMAL mode: all features available
  if (!safeMode) {
    return { isGated: false };
  }

  // DEGRADED/SAFE mode: gate affected features
  if (
    safeMode.level === SafeModeLevel.DEGRADED ||
    safeMode.level === SafeModeLevel.SAFE
  ) {
    const isAffected = safeMode.affectedFeatures.includes(feature);
    if (isAffected) {
      return {
        isGated: true,
        reason: getFeatureGatingReason(feature, safeMode),
        affectedLevel: safeMode.level,
      };
    }
  }

  // RECOVERY mode: gate most features except critical ones
  // (CONTACT_SUPPORT, REINSTALL don't require features)
  if (safeMode.level === SafeModeLevel.RECOVERY) {
    // Allow: HAS_ACCOUNT, THEME, DEV_MODE
    // Gate everything else
    const alwaysAvailable: AffectedFeature[] = [
      // These could be added if needed
    ];

    if (!alwaysAvailable.includes(feature)) {
      return {
        isGated: true,
        reason:
          "App is in recovery mode. Please complete recovery before using this feature.",
        affectedLevel: SafeModeLevel.RECOVERY,
      };
    }
  }

  return { isGated: false };
}

/**
 * Get all gated features for current safe mode state
 *
 * Useful for dimming multiple nav items at once
 */
export function getGatedFeatures(
  safeMode: SafeModeState | null,
): AffectedFeature[] {
  if (!safeMode) {
    return [];
  }

  if (
    safeMode.level === SafeModeLevel.DEGRADED ||
    safeMode.level === SafeModeLevel.SAFE
  ) {
    return safeMode.affectedFeatures;
  }

  if (safeMode.level === SafeModeLevel.RECOVERY) {
    // In RECOVERY, most features are gated
    return [
      AffectedFeature.SYNC,
      AffectedFeature.PREMIUM,
      AffectedFeature.OFFLINE_MODE,
      AffectedFeature.BACKGROUND_JOBS,
      AffectedFeature.IMAGE_OPTIMIZATION,
      AffectedFeature.ANALYTICS,
      AffectedFeature.CLOUD_STORAGE,
    ];
  }

  return [];
}
