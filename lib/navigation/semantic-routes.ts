/**
 * Semantic Route Resolver
 *
 * Resolves semantic route identifiers (e.g., 'default') to concrete app routes based on
 * application context (auth state, etc.).
 *
 * **Semantic Routes:**
 * - `'default'` (fallback target) — Binary auth-aware route for navigation errors and decisions
 *   - Unauthenticated → `/` (welcome screen)
 *   - Authenticated → `/select/world-selection` (world picker)
 * - Future: Additional semantic routes with richer context-awareness (e.g., 'home', 'settings')
 *
 * **Usage:**
 * ```typescript
 * const concreteRoute = await resolveSemanticRoute('default');
 * // Returns: '/' if not signed in, '/select/world-selection' if signed in
 *
 * // Or check directly:
 * const route = await resolveDefaultRoute();
 * ```
 *
 * **When to Use:**
 * - Navigation failure fallback (e.g., deep link error, invalid route)
 * - Auth-state decision routing (e.g., token-based redirects, post-logout)
 * - Error boundary recovery (e.g., safe mode fallback)
 *
 * **Integration Points:**
 * - Called from `lib/navigation/navManager.ts` early in navigation pipeline
 * - Called from error handlers (e.g., `hooks/navigation/use-navigation.ts` failure callback)
 * - Must resolve synchronously or quickly (used in hot paths)
 */

import { getCurrentSession } from '@/lib/auth/auth-manager';
import { logger } from '@/lib/utils';

type SemanticRoute = 'default';

/**
 * Resolves a semantic route identifier to a concrete app route.
 * Determines target route based on current auth state.
 *
 * @param target - The semantic route identifier (e.g., 'default')
 * @returns Concrete route path (e.g., '/', '/select/world-selection')
 * @throws If resolution fails or target is unknown
 */
export async function resolveSemanticRoute(target: SemanticRoute): Promise<string> {
  try {
    if (target === 'default') {
      return resolveDefaultRoute();
    }

    // Unknown semantic route
    const errMsg = `Unknown semantic route: ${target}`;
    logger.category('navigation').warn(errMsg);
    throw new Error(errMsg);
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
 * Checks if a route path is a semantic route (not a concrete route).
 * Useful for determining if resolution is needed before other navigation steps.
 *
 * @param route - The route path to check
 * @returns true if route is a semantic identifier, false if it's a concrete path
 */
export function isSemanticRoute(route: string): boolean {
  return route === 'default';
}
