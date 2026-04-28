import { useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';

import { AuthStateManager } from '@/lib/auth/auth-state';
import { executeInternalRedirectNavigation } from '@/lib/navigation';
import { logger } from '@/lib/utils';

/**
 * useBootstrapRouteGuard — Web Entry Coordinator
 *
 * WEB-ONLY hook that runs once when `appReady` fires. Determines the canonical
 * initial destination based on auth-phase freshness, ignoring protected deep links.
 *
 * **Ownership contract:**
 * Auth-phase is the source of truth for where the user lands on a full web load.
 * This hook reads the freshness outcome and routes accordingly:
 * - FRESH  → /select/world-selection  (session valid, skip login)
 * - STALE  → /login/sign-in           (re-authentication required)
 * - DEAD   → /                         (storage cleared, welcome)
 * - NONE   → /                         (first-time user, welcome)
 *
 * **Deep link policy:**
 * - Auth/email links (signup confirm, password reset, invites): ALLOWED — deferred to
 *   useAuthLinkObserver which handles them independently.
 * - Public /web/* routes: ALLOWED — these are app pages that don't require auth.
 * - All other deep links on protected routes: IGNORED on full web loads. The user
 *   is routed by freshness, not by the URL they entered.
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
