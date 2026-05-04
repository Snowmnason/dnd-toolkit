/**
 * Feature Gating Navigation Guards
 *
 * Provides hooks to protect routes/screens from access when features are gated due to safe mode.
 *
 * Usage:
 * ```tsx
 * import { useFeatureGatingGuard } from '@/lib/error/safemode/navigation-guards';
 *
 * function MyProtectedScreen() {
 *   useFeatureGatingGuard(AffectedFeature.SYNC, {
 *     fallbackRoute: 'world-selection',
 *     showToast: true,
 *   });
 * }
 * ```
 */

import { useAppKernel } from "@/hooks/kernel";
import { useNavigation } from "@/hooks/navigation";
import { getAllRouteConfigs } from "@/lib/navigation";
import { logger } from "@/lib/utils";
import { useEffect } from "react";
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

  const { fallbackRoute, showToast, toastMessage } = options;

  useEffect(() => {
    const gatingStatus = checkFeatureGating(feature, kernel.safeMode);

    if (gatingStatus.isGated) {
      const resolvedFallback = fallbackRoute || '/select/world-selection';
      const message =
        toastMessage ||
        `${feature} is unavailable in safe mode. Redirecting...`;

      logger
        .category("navigation")
        .info(
          `[FeatureGating] Feature ${feature} is gated, redirecting to ${resolvedFallback}`,
        );

      if (showToast) {
        // TODO: Trigger toast notification
        logger.category('navigation').info(`[FeatureGating] ${message}`);
      }

      // Validate route exists in centralized navigation config
      if (!isValidRoute(resolvedFallback)) {
        logger
          .category("navigation")
          .error(
            `[FeatureGating] Fallback route ${resolvedFallback} not found in navigation config`,
          );
        return;
      }

      navigate.replace(resolvedFallback);
    }
  }, [feature, kernel.safeMode, navigate, fallbackRoute, showToast, toastMessage]);
}
