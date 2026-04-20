import { useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';

import { evaluateObservedRouteChange } from '@/lib/navigation';
import { logger } from '@/lib/utils';

import { useNavigationUiModals } from './use-navigation-ui-modals';

/**
 * useRouteChangeObserver
 *
 * ROOT-ONLY EFFECT HOOK: Runtime fallback that detects in-memory route changes
 * and validates them post-hoc.
 * Mount exactly once in `app/_layout.tsx` at the root level.
 *
 * **Role in the protection stack:**
 * - **Primary protection (web):** `useBootstrapRouteGuard` — handles the initial route
 *   on every fresh page load (URL edit, refresh, deep link, browser back/forward all
 *   cause a full app remount on web due to static export).
 * - **Runtime fallback (this hook):** Catches the rare case where a route change occurs
 *   in-memory without a full remount — e.g., programmatic navigation from third-party
 *   code, or native deep links that don't remount the app.
 * - On native (iOS/Android), deep links arrive as OS intents and may not remount the app,
 *   so this observer is the primary guard on those platforms.
 *
 * **How It Works:**
 * 1. Watches `useSegments()` for route changes
 * 2. Skips the initial mount (bootstrap guard handles that on web)
 * 3. Calls `evaluateObservedRouteChange()` which runs the real guard pipeline
 * 4. If guards deny: redirect is executed + NavModal shown
 * 5. If guards allow: no-op (route proceeds)
 *
 * **Guard Behavior:**
 * - **Allow** → no action (route change proceeds normally)
 * - **Permission/access denied** → `evaluateObservedRouteChange` redirects + NavModal shown
 * - **Abort/error** → NavModal shown
 *
 * **Return Type:**
 * Void. Modal state is managed by `ModalProvider`/`ModalLayer` via `useNavigationUiModals`.
 *
 * **Integration:**
 * - Root layout mounts this as a side-effect: `useRouteChangeObserver()`
 * - Failures render automatically via `ModalLayer` (same channel as `useNavigation`)
 */
export function useRouteChangeObserver(): void {
  const segments = useSegments();
  const previousSegmentsRef = useRef<string[] | null>(null);

  const { showNavModal } = useNavigationUiModals();

  useEffect(() => {
    const currentRoute = '/' + segments.join('/');
    const previousRoute = previousSegmentsRef.current
      ? '/' + previousSegmentsRef.current.join('/')
      : null;

    previousSegmentsRef.current = [...segments];

    // Skip policy check on initial mount
    if (!previousRoute) {
      logger.category('navigation').debug('Route observer: initial mount, skipping policy check');
      return;
    }

    // Skip if route hasn't actually changed (can happen during re-renders)
    if (currentRoute === previousRoute) return;

    logger.category('navigation').debug('Route change detected', {
      fromRoute: previousRoute,
      toRoute: currentRoute,
    });

    const checkRoutePolicy = async () => {
      try {
        const result = await evaluateObservedRouteChange(currentRoute, previousRoute);

        logger.category('navigation').debug('Route observer: policy result', {
          status: result.status,
          toRoute: currentRoute,
        });

        if (result.status === 'aborted') {
          logger.category('navigation').warn('Route observer: policy check aborted', {
            reason: result.reason,
          });
          showNavModal('failure');
        } else if (result.status === 'redirected') {
          // Redirect was already executed inside evaluateObservedRouteChange
          logger.category('navigation').debug('Route observer: policy violation corrected', {
            toRoute: result.toRoute,
            reason: result.reason,
          });
          showNavModal('failure');
        }
        // 'no-op' / 'executed': route was allowed — nothing to show
      } catch (error) {
        logger.category('navigation').error('Route policy check failed', {
          error: error instanceof Error ? error.message : String(error),
        });
        showNavModal('failure');
      }
    };

    checkRoutePolicy();
  }, [segments, showNavModal]);
}


export default useRouteChangeObserver;
