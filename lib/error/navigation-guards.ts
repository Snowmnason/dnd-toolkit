/**
 * Feature Gating Navigation Guards
 *
 * Provides guards to protect routes/screens from access when features are gated due to safe mode.
 *
 * Currently Implemented:
 * - createFeatureGatingGuard(): Factory function for creating route-level guards
 *
 * Future (TODO):
 * - useFeatureGatingGuard(): Hook for direct use in screen components
 *
 * Usage:
 * ```tsx
 * import { createFeatureGatingGuard } from '@/lib/error/navigation-guards';
 *
 * const guardFeature = createFeatureGatingGuard(AffectedFeature.SYNC, router, {
 *   fallbackRoute: "/select/world-selection",
 *   showToast: true,
 * });
 *
 * // Check guard in screen
 * if (guardFeature(safeMode)) {
 *   // Feature is gated, user was redirected
 * } else {
 *   // Feature is available, render screen
 * }
 * ```
 */

import type { Href } from "expo-router";
import { Router } from "expo-router";
import { useAppKernel } from "../kernel/use-app-kernel";
import { getAllRouteConfigs } from "../navigation/navigation-config";
import { logger } from "../utils/logger";
import { checkFeatureGating } from "./feature-gating";
import { AffectedFeature } from "./safe-mode";

/**
 * Validate that a route exists in the centralized navigation config
 */
function isValidRoute(path: string): boolean {
  const configs = getAllRouteConfigs();
  const normalizedPath = path.toLowerCase();

  return configs.some((config) => {
    const normalizedConfigPath = config.path.toLowerCase();
    const normalizedAlias = config.aliases?.some(
      (alias) => alias.toLowerCase() === normalizedPath,
    );
    return normalizedConfigPath === normalizedPath || normalizedAlias;
  });
}

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

      // Validate route exists in centralized navigation config
      if (!isValidRoute(fallbackRoute)) {
        logger
          .category("navigation")
          .error(
            `[FeatureGating] Fallback route ${fallbackRoute} not found in navigation config`,
          );
        return false; // Guard not applied due to invalid route
      }

      router.push(fallbackRoute as unknown as Href);
      return true; // Guard was applied
    }

    return false; // Feature is available, allow access
  };
}

/**
 * Alternative: Direct hook for use in components (FUTURE IMPLEMENTATION)
 *
 * TODO: Implement when we have better router integration
 * This hook would automatically redirect if feature is gated
 *
 * Requires:
 * - Router instance from useRouter() hook
 * - Proper exception handling for navigation errors
 * - Integration with layout-level navigation guards
 *
 * Example (when implemented):
 * ```tsx
 * export function useFeatureGatingGuard(
 *   feature: AffectedFeature,
 *   options: FeatureGatingGuardOptions = {},
 * ) {
 *   const router = useRouter();
 *   const kernel = useAppKernel();
 *
 *   useEffect(() => {
 *     const gatingStatus = checkFeatureGating(feature, kernel.safeMode);
 *     if (gatingStatus.isGated) {
 *       const fallbackRoute = options.fallbackRoute || "/select/world-selection";
 *       if (isValidRoute(fallbackRoute)) {
 *         router.push(fallbackRoute);
 *       }
 *     }
 *   }, [feature, kernel.safeMode, router, options]);
 * }
 * ```
 */
// NOT EXPORTED - Implementation pending
// export function useFeatureGatingGuard(...)
