/**
 * Semantic Route Resolver
 *
 * Resolves semantic route identifiers to concrete app routes based on
 * application context (auth state, route config, etc.).
 *
 * **How it works:**
 * - Special-case routes (e.g., `'default'`) have built-in resolution logic.
 * - All other semantic IDs are resolved by matching against `semanticId` fields
 *   in the route config registry (`ROUTE_CONFIGS`). Add `semanticId: 'sign-in'`
 *   to a `RouteConfig` entry to make `navigate.to('sign-in')` work.
 *
 * **Semantic Routes:**
 * - `'default'` — Auth-aware fallback: unauthenticated → `/`, authenticated → `/select/world-selection`
 * - `'welcome'` — Landing/welcome screen
 * - `'sign-in'` — Sign-in screen
 * - `'sign-up'` — Account creation screen
 * - `'forgot-password'` — Forgot password screen
 * - `'world-selection'` — World picker
 * - `'settings'` — User settings
 * - `'home'` — Main app entry point (desktop landing or mobile panel)
 * - `'style-playground'` — Component playground (resolves to mobile or desktop variant based on platform)
 *
 * **Usage:**
 * ```typescript
 * navigate.to('sign-in')        // resolves via semanticId in route config
 * navigate.to('/login/sign-in') // resolves via concrete path (unchanged)
 *
 * const concreteRoute = await resolveSemanticRoute('default');
 * // Returns: '/' if not signed in, '/select/world-selection' if signed in
 * ```
 *
 * **When to Use:**
 * - Navigation failure fallback (e.g., deep link error, invalid route)
 * - Auth-state decision routing (e.g., token-based redirects, post-logout)
 * - Component navigation by meaningful name (e.g., button that goes to 'sign-in')
 * - Error boundary recovery (e.g., safe mode fallback)
 *
 * **Integration Points:**
 * - Called from `lib/navigation/navManager.ts` early in navigation pipeline
 * - Called from error handlers (e.g., `hooks/navigation/use-navigation.ts` failure callback)
 * - Must resolve synchronously or quickly (used in hot paths)
 *
 * **Adding a new semantic ID:**
 * 1. Add the ID string to `SEMANTIC_ROUTE_IDS` below.
 * 2. Add `semanticId: '<your-id>'` to the matching `RouteConfig` entry in `routes/`.
 * 3. For platform-conditional routes, also add `platformPaths: { mobile: '...', desktop: '...' }` to that entry.
 * 4. No changes to `navManager.ts` or `use-navigation.ts` required.
 */

import { ROUTE_CONFIGS } from '@/lib/navigation/navigationConfig';
import { logger } from '@/lib/utils';

/**
 * All valid semantic route identifiers.
 * Single source of truth — `SemanticRoute` type and runtime set are both derived from this.
 * Add new IDs here, then add `semanticId: '<id>'` to the matching RouteConfig.
 */
const SEMANTIC_ROUTE_IDS = [
  'default',
  'welcome',
  'sign-in',
  'sign-up',
  'forgot-password',
  'world-selection',
  'settings',
  'home',
  'style-playground',
] as const;

export type SemanticRoute = (typeof SEMANTIC_ROUTE_IDS)[number];

/** O(1) runtime check set — derived from SEMANTIC_ROUTE_IDS */
const SEMANTIC_ROUTE_SET = new Set<string>(SEMANTIC_ROUTE_IDS);

/**
 * Resolves a semantic route identifier to a concrete app route.
 *
 * - `'default'` uses built-in auth-aware logic.
 * - All other IDs are resolved by looking up `semanticId` in `ROUTE_CONFIGS`.
 * - If the matching config has `platformPaths` and a `platform` is provided, the
 *   platform-specific path is returned instead of the base `path`.
 *
 * @param target - The semantic route identifier (e.g., 'sign-in')
 * @param platform - Optional current platform for routes with platform-conditional paths
 * @returns Concrete route path (e.g., '/login/sign-in')
 * @throws If no matching route config is found for the target
 */
export async function resolveSemanticRoute(
  target: SemanticRoute,
  platform?: 'mobile' | 'desktop',
): Promise<string> {
  try {
    if (target === 'default') {
      return resolveDefaultRoute();
    }

    const config = ROUTE_CONFIGS.find((c) => c.semanticId === target);

    if (!config) {
      const errMsg = `No route config found for semantic route: '${target}'. Add semanticId: '${target}' to the matching RouteConfig entry.`;
      logger.category('navigation').warn(errMsg);
      throw new Error(errMsg);
    }

    // Platform-conditional resolution: pick mobile or desktop path when available
    if (platform && config.platformPaths) {
      const platformPath = config.platformPaths[platform];
      if (platformPath) return platformPath;
    }

    return config.path;
  } catch (error) {
    logger
      .category('navigation')
      .error('resolveSemanticRoute failed', { target, error: error instanceof Error ? error.message : String(error) });
    throw error;
  }
}

/**
 * Resolves the 'default' semantic route (fallback target for errors/decisions).
 * Binary auth-aware routing:
 * - No session → `/` (welcome screen)
 * - Active session → `/select/world-selection` (world selection)
 *
 * @returns Concrete route path based on auth state
 * @throws If auth state cannot be determined
 */
async function resolveDefaultRoute(): Promise<string> {
  try {
    const { getCurrentSession } = require('@/lib/auth/auth-manager') as typeof import('@/lib/auth/auth-manager');
    const session = await getCurrentSession();

    if (session) {
      // User is authenticated → navigate to world selection
      return '/select/world-selection';
    }

    // User is not authenticated (or session is null/invalid) → navigate to welcome
    return '/';
  } catch (error) {
    // If we can't determine auth state, fall back to welcome screen
    logger
      .category('navigation')
      .warn('resolveDefaultRoute: could not determine auth state, falling back to welcome', {
        error: error instanceof Error ? error.message : String(error),
      });
    return '/';
  }
}

/**
 * Checks if a route string is a semantic route identifier (not a concrete path).
 * Useful for determining if resolution is needed before other navigation steps.
 *
 * @param route - The route string to check
 * @returns true if route is a known semantic identifier, false if it's a concrete path
 */
export function isSemanticRoute(route: string): route is SemanticRoute {
  return SEMANTIC_ROUTE_SET.has(route);
}
