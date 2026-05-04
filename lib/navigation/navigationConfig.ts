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

  /**
   * Platform constraint for this route.
   * - 'mobile'  — iOS and Android only
   * - 'desktop' — web and desktop only
   * - null / omitted — available on all platforms
   *
   * Enforced by the navigation manager before any transport execution.
   * Navigation to an incompatible route returns status 'aborted' with
   * reason 'platform-incompatible'. Component-level platform checks
   * may still be used for layout, but this field is the authoritative
   * route-visibility contract.
   */
  platform?: 'mobile' | 'desktop' | null;

  /**
   * Platform-conditional paths for semantic routes that resolve to different concrete routes
   * per platform. When set on an entry with `semanticId`, `resolveSemanticRoute` will return
   * the platform-specific path instead of `path`. Falls back to `path` if no entry matches.
   *
   * @example
   * ```ts
   * // In a RouteConfig entry with semanticId: 'style-playground':
   * platformPaths: { mobile: '/settings/stylemobile', desktop: '/settings/styledesktop' }
   * ```
   */
  platformPaths?: { mobile?: string; desktop?: string };

  /**
   * Semantic identifier for in-app component navigation.
   * Enables `navigate.to('sign-in')` as an alias for the concrete path.
   * Must be unique across all route configs.
   * Deep links must always use concrete paths — semantic IDs are in-app only.
   *
   * @example
   * ```ts
   * navigate.to('sign-in')        // resolves via semanticId
   * navigate.to('/login/sign-in') // resolves via concrete path
   * ```
   */
  semanticId?: string;

  /**
   * Marks this entry as a semantic dispatch anchor.
   *
   * Semantic anchors exist solely so `resolveSemanticRoute()` can look up a `semanticId` and
   * optionally branch via `platformPaths`. They are NOT real navigable routes and must
   * never be returned by `getRouteConfig()`. The concrete platform entries below the anchor
   * (with `platform: 'mobile'` / `platform: 'desktop'`) are the authoritative route configs.
   *
   * Rules:
   * - Always paired with `semanticId` + `platformPaths`.
   * - `path` should match the desktop concrete path (fallback when no platform is given).
   * - `getRouteConfig()` skips these entries entirely.
   * - `validateRouteRegistry()` ensures no two entries share the same `semanticId`.
   */
  semanticAnchor?: true;

  /** Custom error boundary handler */
  onError?: (error: Error, context: NavigationContext) => void;

  /**
   * Contextual back destination shown when there is no navigation stack (e.g. after a deep link).
   * Can be a string (static) or a function that computes the destination based on context (e.g. platform-specific).
   * The TopBar renders a back arrow that navigates to this route instead of calling navigate.back().
   * If omitted and there is no stack, no back arrow is shown.
   */
  backDestination?: string | ((context: NavigationContext) => string);
}

/**
 * Route configuration registry
 * Add new routes here with their configuration
 */
export const ROUTE_CONFIGS: RouteConfig[] = [
  ...LOGIN_ROUTES,
  ...SELECT_ROUTES,
  ...MAIN_ROUTES,
  ...SETTINGS_ROUTES,
  ...WEB_ROUTES,
];

/**
 * Pick the best concrete RouteConfig match from a set of candidates.
 *
 * Semantic anchors (semanticAnchor: true) are dispatch-only entries used by
 * resolveSemanticRoute(). They are always skipped here. Among real concrete
 * entries, platform-matched entries win over unconstrained entries.
 *
 * @param candidates - All entries whose path/alias matched
 * @param isMobile   - Whether the current runtime is mobile (iOS/Android)
 * @returns Best concrete match, or undefined if no compatible entry exists
 */
function pickBestMatch(
  candidates: RouteConfig[],
  isMobile: boolean,
): RouteConfig | undefined {
  const concrete = candidates.filter((c) => !c.semanticAnchor);
  if (concrete.length === 0) return undefined;

  const targetPlatform: 'mobile' | 'desktop' = isMobile ? 'mobile' : 'desktop';

  // 1. Exact platform match
  const platformMatched = concrete.find((c) => c.platform === targetPlatform);
  if (platformMatched) return platformMatched;

  // 2. Unconstrained (available on all platforms)
  const unconstrained = concrete.find((c) => !c.platform);
  if (unconstrained) return unconstrained;

  // 3. No compatible entry (route only exists for the other platform)
  return undefined;
}

/**
 * Get route configuration for current navigation context.
 *
 * Matching strategies (in priority order):
 * 1. Exact path / alias match — platform-preferred via pickBestMatch
 * 2. Prefix match (for nested routes like /main/characters-npcs/[id])
 * 3. First-segment match (coarse fallback for unknown sub-routes)
 * 4. Hard-coded default
 *
 * Semantic anchor entries (semanticAnchor: true) are never returned.
 * Platform-specific entries are preferred over unconstrained entries.
 */
export function getRouteConfig(context: NavigationContext): RouteConfig {
  const currentPath = "/" + context.segments.join("/");

  logger.category("navigation").debug("Resolving route config", {
    path: currentPath,
    segments: context.segments,
    params: context.params,
  });

  // Strategy 1: Exact match (path or alias)
  const exactCandidates = ROUTE_CONFIGS.filter(
    (config) =>
      pathEquals(config.path, currentPath) ||
      config.aliases?.some((alias) => pathEquals(alias, currentPath)),
  );
  let match = pickBestMatch(exactCandidates, context.isMobile);

  if (match) {
    logger.category("navigation").debug("Route matched (exact)", {
      path: currentPath,
      matched: match.path,
      strategy: "exact",
    });
    return applyDefaults(match);
  }

  // Strategy 2: Prefix match (for nested routes like /main/characters-npcs/[id])
  const prefixCandidates = ROUTE_CONFIGS.filter((config) =>
    pathStartsWith(currentPath, config.path),
  );
  match = pickBestMatch(prefixCandidates, context.isMobile);

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
    const firstSegCandidates = ROUTE_CONFIGS.filter((config) => {
      const configFirstSegment = config.path.split("/").filter(Boolean)[0];
      return (
        canonicalizePath(firstSegment) === canonicalizePath(configFirstSegment || "")
      );
    });
    match = pickBestMatch(firstSegCandidates, context.isMobile);

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
 * Violation detected by validateRouteRegistry()
 */
export interface RouteRegistryViolation {
  type: 'duplicate-path-platform' | 'duplicate-semantic-id';
  message: string;
}

/**
 * Validate the route registry for structural integrity.
 *
 * Checks:
 * - No two concrete entries (non-anchor) share the same `path + platform` key.
 *   Duplicate concrete entries cause first-match shadowing in getRouteConfig().
 * - No two entries share the same `semanticId`.
 *   Duplicate semantic IDs cause non-deterministic resolveSemanticRoute() results.
 *
 * @param configs - Defaults to the real ROUTE_CONFIGS registry. Pass a custom array in tests.
 * @returns Array of violations (empty = registry is clean).
 *
 * Called automatically in dev mode at module load. Call directly in tests:
 * ```ts
 * expect(validateRouteRegistry()).toHaveLength(0);
 * ```
 */
export function validateRouteRegistry(
  configs: RouteConfig[] = ROUTE_CONFIGS,
): RouteRegistryViolation[] {
  const violations: RouteRegistryViolation[] = [];

  // ── Duplicate concrete path + platform ──────────────────────────────────────
  const concreteSeen = new Set<string>();
  for (const config of configs) {
    if (config.semanticAnchor) continue;
    const key = `${config.path}::${config.platform ?? 'all'}`;
    if (concreteSeen.has(key)) {
      violations.push({
        type: 'duplicate-path-platform',
        message: `Duplicate concrete route: path='${config.path}' platform='${
          config.platform ?? 'all'
        }'. Add semanticAnchor:true if this is a dispatch anchor, or remove the duplicate.`,
      });
    } else {
      concreteSeen.add(key);
    }
  }

  // ── Duplicate semanticId ────────────────────────────────────────────────────
  const semanticIdSeen = new Map<string, string>();
  for (const config of configs) {
    if (!config.semanticId) continue;
    const existing = semanticIdSeen.get(config.semanticId);
    if (existing !== undefined) {
      violations.push({
        type: 'duplicate-semantic-id',
        message: `Duplicate semanticId '${config.semanticId}' on paths '${existing}' and '${config.path}'. Each semanticId must be unique.`,
      });
    } else {
      semanticIdSeen.set(config.semanticId, config.path);
    }
  }

  return violations;
}

// ── Dev-mode integrity check ──────────────────────────────────────────────────
// Runs once at module load in development. Logs each violation as a navigation
// error so it appears in the category-filtered dev console immediately.
if (typeof __DEV__ !== 'undefined' && __DEV__) {
  const violations = validateRouteRegistry();
  violations.forEach((v) =>
    logger.category('navigation').error(`[RouteRegistry] ${v.message}`),
  );
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
