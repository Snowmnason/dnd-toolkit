/**
 * Navigation Configuration Service
 *
 * Centralized route configuration for D&D Toolkit.
 * Each route defines route identity, title, aliases, accessibility, analytics,
 * and optional route-scoped error recovery.
 *
 * Chrome visibility (topBar, bottomBar, hamburger, navDrawer) is owned by
 * AppConfig chrome policy — see hooks/provider/use-chrome-policy.ts.
 * Guard decisions (redirects, required params) belong in the auth/guard pipeline.
 */

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
 * Context passed to route config handlers
 */
export interface NavigationContext {
  /** Current route segments from useSegments() */
  segments: string[];
  /** Current route params (worldId, userRole, etc.) */
  params: RouteParams;
  /** Expo router instance (deprecated: use useNavigation hook instead) */
  router?: Router;
  /** Current world ID (convenience) */
  worldId?: string;
  /** Current user role (convenience) */
  userRole?: string;
  /** Is mobile platform */
  isMobile: boolean;
}

/**
 * Route configuration definition
 *
 * Route config is pure metadata: path identity, display title, aliases,
 * accessibility, analytics, and optional route-scoped error recovery.
 *
 * Chrome visibility is owned by AppConfig (use-chrome-policy.ts).
 * Guard decisions (redirects, required params) belong in the auth/guard pipeline.
 */
export interface RouteConfig {
  /** Route path pattern (e.g., '/main/characters-npcs') */
  path: string;

  /** Route aliases for case-insensitive or alternative paths */
  aliases?: string[];

  /** TopBar title (can be function for dynamic titles) */
  title: string | ((context: NavigationContext) => string);

  /** A11y focus target on navigation */
  a11yFocusTarget?: A11yFocusTarget;

  /** Analytics tracking name */
  analyticsName?: string;

  /** Custom error boundary handler */
  onError?: (error: Error, context: NavigationContext) => void;
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
    analyticsName: "unknown_route",
  });
}

/**
 * Apply default values to route config
 */
function applyDefaults(config: RouteConfig): RouteConfig {
  return {
    a11yFocusTarget: "title",
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
 * Get all route configs (for testing/debugging)
 */
export function getAllRouteConfigs(): RouteConfig[] {
  return ROUTE_CONFIGS;
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
