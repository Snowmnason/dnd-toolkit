/**
 * Navigation Configuration Service
 *
 * Centralized route configuration for D&D Toolkit.
 * Each route defines TopBar appearance, back behavior, modals, aliases, and more.
 *
 * ## Modals
 * Modal components (SettingsModal, CreateWorldModals, etc.) are **presentational only**.
 * They do not have route URLs and are controlled via React state (visible prop).
 * The `modal` config field is reserved for future modal-as-route patterns.
 *
 * ## Animations
 * Animation types are defined in route config but not yet implemented in Expo Router.
 * Use `getTransitionAnimation()` helper for future integration.
 */

import { trackVariantAssignment } from "@/lib/analytics";
import { logger } from "@/lib/utils";
import { Router } from "expo-router";
import {
    canonicalizePath,
    pathEquals,
    pathStartsWith,
    type RouteParams,
} from "./routeCanonicalizer";
import { LOGIN_ROUTES } from "./routes/loginRoutes";
import { MAIN_ROUTES } from "./routes/mainRoutes";
import { SELECT_ROUTES } from "./routes/selectRoutes";
import { SETTINGS_ROUTES } from "./routes/settingsRoutes";
import { WEB_ROUTES } from "./routes/webRoutes";

/**
 * A11y focus target on route navigation
 * - 'title': Focus TopBar title (default, screen-reader friendly)
 * - 'firstInteractive': Focus first interactive element
 * - 'none': No automatic focus (for modals, etc.)
 */
export type A11yFocusTarget = "title" | "firstInteractive" | "none";

/**
 * Animation type for route transitions (placeholder for future use)
 */
export type AnimationType = "slide" | "fade" | "modal" | "none";

/**
 * Modal configuration for routes that open as modals
 */
export interface ModalConfig {
  /** Is this route a modal? */
  isModal: boolean;
  /** Back button dismisses modal instead of navigating */
  dismissOnBack?: boolean;
  /** Custom dismiss handler */
  onDismiss?: (context: NavigationContext) => void;
}

/**
 * Route variant configuration for A/B testing and gradual rollouts
 * Allows running multiple versions of a route with percentage-based user bucketing
 *
 * **Note:** Variant IDs are the map keys in RouteVariantsMap, not stored in RouteVariant.
 * The map key is the single source of truth for variant identification.
 */
export interface RouteVariant {
  /** Display title for this variant (can override route title) */
  title?: string;

  /** Rollout percentage for this variant (0-100) */
  percentage: number;

  /** Optional seed for rebalancing (e.g., "2026-02-07") */
  seed?: string;

  /** Custom metadata for tracking or analytics */
  metadata?: Record<string, string | number | boolean>;
}

/**
 * Route variants mapping for A/B testing
 * Maps variant IDs (keys) to their configurations
 *
 * @example
 * ```ts
 * variants: {
 *   'v1': { title: 'Legacy', percentage: 90 },  // Key 'v1' is the variant ID
 *   'v2': { title: 'New', percentage: 10 },      // Key 'v2' is the variant ID
 * }
 * ```
 */
export type RouteVariantsMap = Record<string, RouteVariant>;

/**
 * Conditional redirect hook for access control
 * Returns target path if redirect is needed, undefined otherwise
 */
export type RedirectIfHook = (context: NavigationContext) => string | undefined;

/**
 * Context passed to route config handlers
 */
export interface NavigationContext {
  /** Current route segments from useSegments() */
  segments: string[];
  /** Current route params (worldId, userRole, etc.) */
  params: RouteParams;
  /** Expo router instance */
  router: Router;
  /** Current world ID (convenience) */
  worldId?: string;
  /** Current user role (convenience) */
  userRole?: string;
  /** Is mobile platform */
  isMobile: boolean;
}

/**
 * Route configuration definition
 */
export interface RouteConfig {
  /** Route path pattern (e.g., '/main/characters-npcs') */
  path: string;

  /** Route aliases for case-insensitive or alternative paths */
  aliases?: string[];

  /** TopBar title (can be function for dynamic titles) */
  title: string | ((context: NavigationContext) => string);

  /** Back button target path or handler */
  back?: string | ((context: NavigationContext) => string);

  /** Show hamburger menu button */
  showHamburger?: boolean;

  /** Show TopBar entirely (default true, false for login/public routes) */
  showTopBar?: boolean;

  /** Required params for this route */
  requiredParams?: string[];

  /** Preserve these params when navigating away */
  preserveParamsOnBack?: string[];

  /** Modal configuration */
  modal?: ModalConfig;

  /** Conditional redirect (e.g., unauthorized world access) */
  redirectIf?: RedirectIfHook;

  /** Analytics tracking name */
  analyticsName?: string;

  /** Animation type for transitions */
  animation?: AnimationType;

  /** A11y focus target on navigation */
  a11yFocusTarget?: A11yFocusTarget;

  /** Custom error boundary handler */
  onError?: (error: Error, context: NavigationContext) => void;

  /** NEW: Route variants for A/B testing and gradual rollouts */
  variants?: RouteVariantsMap;

  /** NEW: Default variant ID if no rollout evaluation is needed */
  defaultVariant?: string;
}

/**
 * Route configuration registry
 * Add new routes here with their configuration
 */
const ROUTE_CONFIGS: RouteConfig[] = [
  ...LOGIN_ROUTES,
  ...SELECT_ROUTES,
  ...MAIN_ROUTES,
  ...SETTINGS_ROUTES,
  ...WEB_ROUTES,
];

/**
 * Get route configuration for current navigation context
 * Uses intelligent matching: exact path, aliases, first segment, default
 */
export function getRouteConfig(context: NavigationContext): RouteConfig {
  const currentPath = "/" + context.segments.join("/");

  logger.category("navigation").debug("Resolving route config", {
    path: currentPath,
    segments: context.segments,
    params: context.params,
  });

  // Strategy 1: Exact match
  let match = ROUTE_CONFIGS.find(
    (config) =>
      pathEquals(config.path, currentPath) ||
      config.aliases?.some((alias) => pathEquals(alias, currentPath)),
  );

  if (match) {
    logger.category("navigation").debug("Route matched (exact)", {
      path: currentPath,
      matched: match.path,
      strategy: "exact",
    });
    return applyDefaults(match);
  }

  // Strategy 2: Starts with (for nested routes like /main/characters-npcs/[id])
  match = ROUTE_CONFIGS.find((config) =>
    pathStartsWith(currentPath, config.path),
  );

  if (match) {
    logger.category("navigation").debug("Route matched (starts with)", {
      path: currentPath,
      matched: match.path,
      strategy: "starts_with",
    });
    return applyDefaults(match);
  }

  // Strategy 3: First segment match (e.g., /main/* matches /main/main-landing)
  const firstSegment = context.segments[0];
  if (firstSegment) {
    match = ROUTE_CONFIGS.find((config) => {
      const configFirstSegment = config.path.split("/").filter(Boolean)[0];
      return (
        canonicalizePath(firstSegment) === canonicalizePath(configFirstSegment || "")
      );
    });

    if (match) {
      logger.category("navigation").debug("Route matched (first segment)", {
        path: currentPath,
        matched: match.path,
        strategy: "first_segment",
        firstSegment,
      });
      return applyDefaults(match);
    }
  }

  // Strategy 4: Default fallback
  logger.category("navigation").warn("Route not found, using default", {
    path: currentPath,
    availableRoutes: ROUTE_CONFIGS.map((c) => c.path),
  });
  return applyDefaults({
    path: currentPath,
    title: "D&D Toolkit",
    showTopBar: true,
    showHamburger: false,
    analyticsName: "unknown_route",
  });
}

/**
 * Apply default values to route config
 */
function applyDefaults(config: RouteConfig): RouteConfig {
  return {
    showTopBar: true,
    showHamburger: false,
    a11yFocusTarget: "title",
    animation: "none",
    ...config,
  };
}

/**
 * Resolve dynamic title if it's a function
 */
export function resolveTitle(
  config: RouteConfig,
  context: NavigationContext,
): string {
  if (typeof config.title === "function") {
    return config.title(context);
  }
  return config.title;
}

/**
 * Resolve back target if it's a function
 */
export function resolveBackTarget(
  config: RouteConfig,
  context: NavigationContext,
): string | undefined {
  if (!config.back) {
    return undefined;
  }

  if (typeof config.back === "function") {
    return config.back(context);
  }

  return config.back;
}

/**
 * Check if route should redirect based on redirectIf hook
 */
export function shouldRedirect(
  config: RouteConfig,
  context: NavigationContext,
): string | undefined {
  if (!config.redirectIf) {
    return undefined;
  }

  return config.redirectIf(context);
}

/**
 * Evaluate route variant for user using deterministic bucketing
 *
 * Uses pure bucketing (FNV-1a) to map users to variants based on cumulative percentages.
 * Guarantees exactly one variant is selected per user per route.
 *
 * **Algorithm:**
 * 1. Calculate bucket for user+route: bucketPercent(userId, config.path) → 0-99
 * 2. Iterate variants in order, accumulating percentages
 * 3. Return variant whose cumulative range contains the bucket
 * 4. Fall back to defaultVariant if percentages don't cover 0-99
 *
 * **Usage:**
 * ```ts
 * const variantId = await evaluateRouteVariant(config, userId);
 * const variant = config.variants?.[variantId] ?? config.variants?.[config.defaultVariant!];
 * // Use variant.title, metadata, etc. for analytics
 * ```
 *
 * @param config - Route configuration with variants
 * @param userId - User ID for deterministic bucketing
 * @returns Variant ID that owns this user's bucket, or defaultVariant ID, or undefined
 */
export async function evaluateRouteVariant(
  config: RouteConfig,
  userId: string,
): Promise<string | undefined> {
  if (!config.variants) {
    return undefined;
  }

  try {
    // Import bucketPercent for pure deterministic bucketing
    const { bucketPercent } = await import("@/pure-algo-immutables/rollout");

    // Calculate a single bucket for this route (0-99)
    const bucket = bucketPercent(userId, config.path);

    // Iterate variants and accumulate percentages to find matching variant
    let cumulativePercentage = 0;
    for (const [variantId, variant] of Object.entries(config.variants)) {
      cumulativePercentage += variant.percentage;

      // If bucket falls within this variant's range, select it
      if (bucket < cumulativePercentage) {
        logger.category("navigation").debug("Route variant matched", {
          path: config.path,
          variant: variantId,
          bucket,
          percentage: variant.percentage,
          cumulativePercentage,
          userId,
        });

        // Track variant assignment for A/B testing analytics (async, non-blocking)
        trackVariantAssignment({
          flagName: config.path,
          variant: variantId,
          userId,
          percentage: variant.percentage,
          context: { route_path: config.path },
        });

        return variantId;
      }
    }

    // If no variant matched (shouldn't happen if percentages sum to 100),
    // fall back to default
    if (config.defaultVariant) {
      logger
        .category("navigation")
        .debug("Using default route variant (no bucket match)", {
          path: config.path,
          variant: config.defaultVariant,
          bucket,
          cumulativePercentage,
          userId,
        });

      // Track default variant assignment for analytics
      trackVariantAssignment({
        flagName: config.path,
        variant: config.defaultVariant,
        userId,
        context: { route_path: config.path, reason: "default_fallback" },
      });

      return config.defaultVariant;
    }

    logger.category("navigation").debug("No route variant matched", {
      path: config.path,
      bucket,
      cumulativePercentage,
      userId,
    });
    return undefined;
  } catch (error) {
    logger
      .category("navigation")
      .warn("Failed to evaluate route variant", error);
    // Fallback: return defaultVariant
    return config.defaultVariant;
  }
}

/**
 * Get all route configs (for testing/debugging)
 */
export function getAllRouteConfigs(): RouteConfig[] {
  return ROUTE_CONFIGS;
}

/**
 * Get animation type for route transition (placeholder for future implementation)
 * Returns the animation type from route config, defaults to 'none'
 *
 * Future: This will integrate with Expo Router stack options or custom transition handlers
 */
export function getTransitionAnimation(
  config: RouteConfig,
  context: NavigationContext,
): AnimationType {
  return config.animation || "none";
}

/**
 * Add or update a route config (for dynamic routes or testing)
 */
export function registerRouteConfig(config: RouteConfig): void {
  const existingIndex = ROUTE_CONFIGS.findIndex((c) =>
    pathEquals(c.path, config.path),
  );

  if (existingIndex >= 0) {
    // eslint-disable-next-line security/detect-object-injection
    ROUTE_CONFIGS[existingIndex] = config;
  } else {
    ROUTE_CONFIGS.push(config);
  }
}
