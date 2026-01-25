/**
 * Feature Gating Navigation Guards
 *
 * Helpers to protect routes/screens from access when features are gated.
 *
 * Usage (in screens/layouts later):
 * ```tsx
 * import { useFeatureGatingGuard } from '@/lib/error/navigation-guards';
 *
 * export default function SyncScreen() {
 *   // Redirect to home if SYNC is gated
 *   useFeatureGatingGuard(AffectedFeature.SYNC, {
 *     fallbackRoute: "/select/world-selection",
 *     showToast: true,
 *   });
 *
 *   return <YourScreen />;
 * }
 * ```
 */

import { Router } from "expo-router";
import { useEffect } from "react";
import { useAppKernel } from "../kernel/use-app-kernel";
import { logger } from "../utils/logger";
import { checkFeatureGating } from "./feature-gating";
import { AffectedFeature } from "./safe-mode";

interface FeatureGatingGuardOptions {
  /** Route to redirect to if feature is gated (default: home) */
  fallbackRoute?: string;
  /** Show toast/notification when redirecting (default: false) */
  showToast?: boolean;
  /** Custom message for the toast (default: auto-generated) */
  toastMessage?: string;
}

/**
 * Navigation guard hook to protect routes from gated features
 *
 * Use this in screen/layout components to redirect when a feature is unavailable.
 * Typically used at route entry points to prevent accessing screens that depend
 * on gated features.
 *
 * @param feature - Feature to guard
 * @param router - Expo router instance
 * @param options - Guard options
 */
export function createFeatureGatingGuard(
  feature: AffectedFeature,
  router: Router,
  options: FeatureGatingGuardOptions = {},
) {
  return (safeMode: ReturnType<typeof useAppKernel>["safeMode"]) => {
    const gatingStatus = checkFeatureGating(feature, safeMode);

    if (gatingStatus.isGated) {
      const fallbackRoute = options.fallbackRoute || "/select/world-selection";
      const message =
        options.toastMessage ||
        `${feature} is unavailable in safe mode. Redirecting...`;

      logger
        .category("navigation")
        .info(
          `[FeatureGating] Feature ${feature} is gated, redirecting to ${fallbackRoute}`,
        );

      if (options.showToast) {
        // TODO: Trigger toast notification
        // This would require AppToast context or similar
        console.info("[FeatureGating]", message);
      }

      router.push(fallbackRoute as any);
      return true; // Guard was applied
    }

    return false; // Feature is available, allow access
  };
}

/**
 * Alternative: Direct hook for use in components
 *
 * Automatically redirects if feature is gated
 * FUTURE: Implement when we have better route structure
 */
export function useFeatureGatingGuard(
  feature: AffectedFeature,
  options: FeatureGatingGuardOptions = {},
) {
  const kernel = useAppKernel();

  useEffect(() => {
    const gatingStatus = checkFeatureGating(feature, kernel.safeMode);

    if (gatingStatus.isGated) {
      logger
        .category("navigation")
        .warn(`[FeatureGating] Attempted to access gated feature: ${feature}`);

      // NOTE: Router import would be needed here
      // For now, this is a placeholder for future implementation
      // when we have proper router integration
    }
  }, [feature, kernel.safeMode]);
}
