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

import { useEffect } from "react";
import { useAppKernel } from "@/hooks/kernel";
import { useNavigation } from "@/hooks/navigation";
import { getAllRouteConfigs } from "@/lib/navigation";
import { logger } from "@/lib/utils";
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
 * Navigation guard factory to protect routes from gated features
 *
 * Deprecated: Use `useFeatureGatingGuard()` hook instead for better integration.
 * This factory function is kept for backward compatibility but should not be used in new code.
 *
 * @param feature - Feature to guard
 * @param navigate - Navigation instance from useNavigation hook
 * @param options - Guard options
 */
export function createFeatureGatingGuard(
  feature: AffectedFeature,
  navigate: ReturnType<typeof useNavigation>,
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
        logger.category('navigation').info(`[FeatureGating] ${message}`);
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

      navigate.replace(fallbackRoute);
      return true; // Guard was applied
    }

    return false; // Feature is available, allow access
  };
}

/**
 * Hook to protect routes from gated features
 *
 * Use this in screen/layout components to automatically redirect when a feature is unavailable.
 * Runs an effect that checks feature gating on mount and whenever safeMode changes.
 *
 * @param feature - Feature to guard
 * @param options - Guard options
 *
 * @example
 * ```tsx
 * function MyProtectedScreen() {
 *   useFeatureGatingGuard(AffectedFeature.SYNC, {
 *     fallbackRoute: "/select/world-selection",
 *     showToast: true,
 *   });
 *   // Rest of component...\n *}
 * ```
 */
export function useFeatureGatingGuard(
  feature: AffectedFeature,
  options: FeatureGatingGuardOptions = {},
) {
  const navigate = useNavigation();
  const kernel = useAppKernel();

  useEffect(() => {
    const gatingStatus = checkFeatureGating(feature, kernel.safeMode);

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
        logger.category('navigation').info(`[FeatureGating] ${message}`);
      }

      // Validate route exists in centralized navigation config
      if (!isValidRoute(fallbackRoute)) {
        logger
          .category("navigation")
          .error(
            `[FeatureGating] Fallback route ${fallbackRoute} not found in navigation config`,
          );
        return;
      }

      navigate.replace(fallbackRoute);
    }
  }, [feature, kernel.safeMode, navigate, options]);
}

/**
 * Alternative: Direct factory function for use in route guards (DEPRECATED)
 *
 * Kept for backward compatibility. New code should use `useFeatureGatingGuard()` hook instead.
 *
 * If you need a factory pattern, consider extracting the navigation and kernel at the call site
 * and using the hook version instead.
 */
