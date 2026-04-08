/**
 * Navigation Actions — Centralized Router Execution
 *
 * Wraps every Expo Router method so all navigation goes through one place.
 * Importable everywhere (pure-algo-immutables tier).
 *
 * **Why this exists:**
 * - Single audit point for all navigation calls (analytics, route protection, logging)
 * - Every layer (hooks, lib, safemode) calls `navigate.*` instead of `router.*`
 * - Each layer still owns its own decision/business logic before calling these
 *
 * **Architecture:**
 * - Hooks: Call `navigate.*` after validation + decision logic
 * - Lib: Call `navigate.*` after orchestration + business logic
 * - System/Safemode: Call `navigate.*` after recovery logic
 *
 * Usage:
 * ```typescript
 * import { navigate } from '@/pure-algo-immutables/navigation-actions';
 *
 * navigate.replace(router, '/main/dashboard');
 * navigate.push(router, '/settings', { tab: 'profile' });
 * navigate.back(router);
 * navigate.dismissTo(router, '/select-world');
 * navigate.prefetch(router, '/main/dashboard');
 * ```
 */

import { Router } from 'expo-router';

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Throws if router is null/undefined. Used by every method below. */
function assertRouter(router: Router | null | undefined, action: string): asserts router is Router {
  if (!router) {
    throw new Error(`Router is null/undefined — cannot execute navigate.${action}()`);
  }
}

// ─── Navigate Object ────────────────────────────────────────────────────────

/**
 * Centralized navigation execution methods.
 *
 * Every method delegates directly to the corresponding `router.*` call.
 * No middleware or policy logic — just the translation layer.
 */
export const navigate = {

  // ── Stack Navigation ────────────────────────────────────────────────────

  /**
   * Push a new route onto the navigation stack.
   *
   * Adds the route on top of the current stack. User can go back to the previous screen.
   *
   * @param router - Expo Router instance (from `useRouter()`)
   * @param route - Target route path (e.g., '/main/dashboard', '/settings')
   * @param params - Optional route parameters
   *
   * @example
   * ```typescript
   * navigate.push(router, '/main/dashboard', { tab: 'overview' });
   * ```
   */
  push: (router: Router | null | undefined, route: string, params?: Record<string, any>): void => {
    assertRouter(router, 'push');
    router.push({ pathname: route as any, params });
  },

  /**
   * Replace the current route (no back navigation to the replaced screen).
   *
   * Use for final navigation decisions: auth redirects, error recovery, post-login routing.
   *
   * @param router - Expo Router instance (from `useRouter()`)
   * @param route - Target route path
   * @param params - Optional route parameters
   *
   * @example
   * ```typescript
   * navigate.replace(router, '/login');
   * ```
   */
  replace: (router: Router | null | undefined, route: string, params?: Record<string, any>): void => {
    assertRouter(router, 'replace');
    router.replace({ pathname: route as any, params });
  },

  /**
   * Navigate to the provided route (smart — reuses existing screen if already in stack).
   *
   * Unlike `push`, this won't duplicate a screen that's already in the stack.
   * Expo Router's default navigation behavior.
   *
   * @param router - Expo Router instance (from `useRouter()`)
   * @param route - Target route path
   * @param params - Optional route parameters
   *
   * @example
   * ```typescript
   * navigate.to(router, '/main/dashboard');
   * ```
   */
  to: (router: Router | null | undefined, route: string, params?: Record<string, any>): void => {
    assertRouter(router, 'to');
    router.navigate({ pathname: route as any, params });
  },

  // ── Back / Dismiss ──────────────────────────────────────────────────────

  /**
   * Go back one step in the navigation history.
   *
   * @param router - Expo Router instance (from `useRouter()`)
   *
   * @example
   * ```typescript
   * navigate.back(router);
   * ```
   */
  back: (router: Router | null | undefined): void => {
    assertRouter(router, 'back');
    router.back();
  },

  /**
   * Dismiss the current screen (or multiple screens) from the stack.
   *
   * If the current screen is the only route, dismisses the entire stack.
   *
   * @param router - Expo Router instance (from `useRouter()`)
   * @param count - Number of screens to dismiss (default: 1)
   *
   * @example
   * ```typescript
   * navigate.dismiss(router);       // dismiss 1
   * navigate.dismiss(router, 3);    // dismiss 3 screens
   * ```
   */
  dismiss: (router: Router | null | undefined, count?: number): void => {
    assertRouter(router, 'dismiss');
    router.dismiss(count);
  },

  /**
   * Dismiss all screens and return to the first screen in the closest stack.
   *
   * Similar to `popToTop` in React Navigation.
   *
   * @param router - Expo Router instance (from `useRouter()`)
   *
   * @example
   * ```typescript
   * navigate.dismissAll(router);
   * ```
   */
  dismissAll: (router: Router | null | undefined): void => {
    assertRouter(router, 'dismissAll');
    router.dismissAll();
  },

  /**
   * Dismiss screens until the provided route is reached.
   *
   * If the route is not found in the stack, replaces the current screen instead.
   *
   * @param router - Expo Router instance (from `useRouter()`)
   * @param route - Target route path to dismiss to
   * @param params - Optional route parameters
   *
   * @example
   * ```typescript
   * navigate.dismissTo(router, '/select-world');
   * ```
   */
  dismissTo: (router: Router | null | undefined, route: string, params?: Record<string, any>): void => {
    assertRouter(router, 'dismissTo');
    router.dismissTo({ pathname: route as any, params });
  },

  // ── Query ───────────────────────────────────────────────────────────────

  /**
   * Check if the router can go back (has history).
   *
   * @param router - Expo Router instance (from `useRouter()`)
   * @returns `true` if back navigation is possible
   *
   * @example
   * ```typescript
   * if (navigate.canGoBack(router)) { navigate.back(router); }
   * ```
   */
  canGoBack: (router: Router | null | undefined): boolean => {
    assertRouter(router, 'canGoBack');
    return router.canGoBack();
  },

  /**
   * Check if the current screen can be dismissed (stack has > 1 screen).
   *
   * @param router - Expo Router instance (from `useRouter()`)
   * @returns `true` if dismiss is possible
   *
   * @example
   * ```typescript
   * if (navigate.canDismiss(router)) { navigate.dismiss(router); }
   * ```
   */
  canDismiss: (router: Router | null | undefined): boolean => {
    assertRouter(router, 'canDismiss');
    return router.canDismiss();
  },

  // ── Params ──────────────────────────────────────────────────────────────

  /**
   * Update the current route's query params without navigating.
   *
   * @param router - Expo Router instance (from `useRouter()`)
   * @param params - Partial params to merge into the current route
   *
   * @example
   * ```typescript
   * navigate.setParams(router, { tab: 'settings', filter: 'active' });
   * ```
   */
  setParams: (router: Router | null | undefined, params: Record<string, any>): void => {
    assertRouter(router, 'setParams');
    router.setParams(params as any);
  },

  // ── Performance ─────────────────────────────────────────────────────────

  /**
   * Prefetch a screen in the background before navigating to it.
   *
   * Call this ahead of time for routes the user is likely to visit next.
   * Improves perceived navigation speed.
   *
   * @param router - Expo Router instance (from `useRouter()`)
   * @param route - Route path to prefetch
   *
   * @example
   * ```typescript
   * // Prefetch dashboard while user is on login screen
   * navigate.prefetch(router, '/main/dashboard');
   * ```
   */
  prefetch: (router: Router | null | undefined, route: string): void => {
    assertRouter(router, 'prefetch');
    router.prefetch(route as any);
  },
};
