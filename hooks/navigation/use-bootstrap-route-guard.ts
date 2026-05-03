import { useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { AuthStateManager } from '@/lib/auth/auth-state';
import { evaluateObservedRouteChange, executeInternalRedirectNavigation } from '@/lib/navigation';
import { logger } from '@/lib/utils';

/**
 * useBootstrapRouteGuard — Web Entry Coordinator
 *
 * WEB-ONLY hook that runs once when `appReady` fires. Determines the canonical
 * initial destination for every full web page load.
 *
 * **Navigation type handling:**
 *
 * `back_forward` / `reload` + fresh session:
 *   User was already in the app. Honor the URL directly — no guard re-run needed.
 *   Stale/dead sessions still get redirected to sign-in/welcome.
 *
 * `navigate` (new tab, typed URL, bookmark, external link) + fresh session:
 *   Run the full guard pipeline for the requested URL via `evaluateObservedRouteChange`:
 *   - Guards pass → user lands on their target (deep link honored, analytics captured)
 *   - Guards deny → redirect already executed inside evaluateObservedRouteChange
 *   - Pipeline aborted → fall back to freshness-based redirect
 *   Auth/login routes are excluded from this path — a fresh user who bookmarked
 *   the sign-in page should be redirected to world-selection, not left on sign-in.
 *
 * `navigate` + stale/dead/none session → standard freshness redirect.
 *
 * **Always-allowed entry points:**
 * - Auth/email links (signup confirm, password reset, invites): deferred to
 *   useAuthLinkObserver which handles them independently.
 * - Public /web/* routes: no auth required, always honored.
 *
 * **Why not the route observer?**
 * `useRouteChangeObserver` handles runtime in-memory route changes after the app
 * is alive. This hook handles the initial entry point, which on web is always a
 * full app remount (URL edit, hard refresh, browser back/forward, deep link).
 *
 * **Timing:**
 * - Runs once when `appReady` transitions from false → true
 * - Auth-phase has already set bootstrap freshness during kernel init
 * - UIBlocker is still visible (hides ~50ms after appReady)
 * - Redirect executes before the blocker drops — no flash of wrong content
 *
 * @param appReady - Whether the kernel has finished bootstrap (kernel.phases.appReady)
 */
export function useBootstrapRouteGuard(appReady: boolean): void {
  const segments = useSegments();
  const hasRunRef = useRef(false);

  useEffect(() => {
    // Only run on web — native deep links don't cause full remounts
    if (Platform.OS !== 'web') return;

    // Only run once, when appReady first becomes true
    if (!appReady || hasRunRef.current) return;
    hasRunRef.current = true;

    const currentRoute = '/' + segments.join('/');

    logger.category('navigation').info(
      `[WebEntryCoordinator] Initial web route: ${currentRoute}`
    );

    const coordinateEntry = async () => {
      try {
        // ─── Step 1: Auth/email link detection ─────────────────────────
        // If the URL contains auth-relevant params (action, access_token in hash),
        // defer entirely to useAuthLinkObserver — it handles signup-confirm,
        // password-reset, world-invite flows independently.
        const hashFragment = typeof window !== 'undefined' ? window.location.hash : '';
        const urlParams = typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search)
          : null;
        const hasAuthAction = urlParams?.has('action');
        const hasHashTokens = hashFragment.includes('access_token');

        if (hasAuthAction || hasHashTokens) {
          logger.category('navigation').info(
            '[WebEntryCoordinator] Auth/email link detected — deferring to auth link observer',
            { currentRoute, hasAuthAction, hasHashTokens },
          );
          return;
        }

        // ─── Step 2: Allow public /web/* routes as deep links ──────────
        // These are public app pages (privacy policy, terms, etc.) that don't
        // require authentication. They should work as direct URLs.
        const lowerRoute = currentRoute.toLowerCase();
        if (lowerRoute === '/web' || lowerRoute.startsWith('/web/')) {
          logger.category('navigation').debug(
            '[WebEntryCoordinator] Public /web/ route — allowed as deep link',
            { currentRoute },
          );
          return;
        }

        // ─── Step 3: Read auth-phase freshness ─────────────────────────
        const freshness = AuthStateManager.getBootstrapFreshness();

        // ─── Step 3.5: Honor URL for fresh sessions ────────────────────
        const navType = getWebNavigationType();

        if (freshness === 'fresh') {
          if (navType === 'back_forward' || navType === 'reload') {
            // Restored navigation: user was already in the app at this URL.
            // Honor it directly — layout-level useAuthGuard enforces protection.
            logger.category('navigation').debug(
              '[WebEntryCoordinator] Restored navigation with fresh session — honoring URL',
              { navType, currentRoute },
            );
            return;
          }

          if (navType === 'navigate') {
            // Deep link (bookmark, external link, typed URL) with a live session.
            // Run the guard pipeline instead of blindly bouncing to world-selection.
            // Auth/login routes are excluded: a fresh user who bookmarked /login/sign-in
            // should be redirected to world-selection, not left on the sign-in page.
            const isAuthPublicRoute = lowerRoute === '/' || lowerRoute.startsWith('/login');
            if (!isAuthPublicRoute) {
              // Extract the worldId from the URL so the permission guard validates
              // the deep-linked world, not the stored LAST_SELECTED_WORLD.
              const urlSearchParams = typeof window !== 'undefined'
                ? new URLSearchParams(window.location.search)
                : null;
              const deepLinkWorldId = urlSearchParams?.get('worldId') ?? undefined;
              const overrideParams = deepLinkWorldId ? { worldId: deepLinkWorldId } : undefined;

              const deepLinkResult = await evaluateObservedRouteChange(
                currentRoute,
                '',
                'deep-link',
                overrideParams ? { overrideParams } : undefined,
              );
              if (deepLinkResult.status !== 'aborted') {
                logger.category('navigation').debug(
                  '[WebEntryCoordinator] Deep link honored for fresh session',
                  { currentRoute, guardStatus: deepLinkResult.status, deepLinkWorldId },
                );
                return;
              }
              // Guard pipeline aborted (error) — fall through to freshness redirect
              logger.category('navigation').warn(
                '[WebEntryCoordinator] Deep link guard check aborted, falling back to freshness redirect',
                { currentRoute },
              );
            }
          }
        }

        // Map freshness → canonical bootstrap destination
        let bootstrapDestination: string;
        switch (freshness) {
          case 'fresh':
            bootstrapDestination = '/select/world-selection';
            break;
          case 'stale':
            bootstrapDestination = '/login/sign-in';
            break;
          case 'dead':
          case 'none':
          default:
            bootstrapDestination = '/';
            break;
        }

        // ─── Step 4: Skip redirect if already at destination ───────────
        const normalizedCurrent = currentRoute.replace(/\/$/, '') || '/';
        const normalizedDest = bootstrapDestination.replace(/\/$/, '') || '/';

        if (normalizedCurrent === normalizedDest
          || normalizedCurrent.startsWith(normalizedDest + '/')) {
          logger.category('navigation').debug(
            '[WebEntryCoordinator] Already at bootstrap destination — no redirect needed',
            { currentRoute, freshness, bootstrapDestination },
          );
          return;
        }

        // ─── Step 5: Redirect to auth-owned destination ────────────────
        logger.category('navigation').info(
          `[WebEntryCoordinator] Redirecting: freshness=${freshness}`,
          { from: currentRoute, to: bootstrapDestination },
        );

        await executeInternalRedirectNavigation(
          `bootstrap-freshness-${freshness}`,
          bootstrapDestination,
        );
      } catch (error) {
        logger.category('navigation').warn(
          '[WebEntryCoordinator] Entry coordination failed (non-critical)',
          { error: error instanceof Error ? error.message : String(error), route: '/' + segments.join('/') },
        );
        // Non-fatal: the app renders whatever route is in the URL.
        // Runtime observer can catch policy violations on next segment change.
      }
    };

    coordinateEntry();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appReady]);
}

/**
 * Detect the type of the current web page navigation.
 *
 * Uses the modern `PerformanceNavigationTiming` API with fallback to the
 * legacy `performance.navigation` for older browsers.
 *
 * @returns
 * - `'navigate'`     — New tab, typed URL, link from external page
 * - `'reload'`       — Hard refresh (F5, Cmd+R)
 * - `'back_forward'` — Browser back or forward button
 * - `'unknown'`      — API unavailable or unrecognized value
 */
export function getWebNavigationType(): 'navigate' | 'reload' | 'back_forward' | 'unknown' {
  if (typeof performance === 'undefined') return 'unknown';

  // Modern API: PerformanceNavigationTiming (Chrome 57+, Firefox 58+, Safari 15.4+)
  const entries = performance.getEntriesByType('navigation') as PerformanceNavigationTiming[];
  if (entries.length > 0) {
    const t = entries[0].type;
    if (t === 'navigate' || t === 'reload' || t === 'back_forward') return t;
  }

  // Legacy fallback: deprecated but still widely available
  const legacy = (performance as any).navigation;
  if (legacy) {
    if (legacy.type === 0) return 'navigate';
    if (legacy.type === 1) return 'reload';
    if (legacy.type === 2) return 'back_forward';
  }

  return 'unknown';
}
