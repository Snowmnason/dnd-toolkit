import { useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';

import { evaluateObservedRouteChange } from '@/lib/navigation';
import { logger } from '@/lib/utils';

import { useNavigationUiModals } from './use-navigation-ui-modals';

/**
 * useRouteChangeObserver
 *
 * ROOT-ONLY EFFECT HOOK: Detects route changes and validates them post-hoc.
 * Mount exactly once in `app/_layout.tsx` at the root level.
 *
 * **Purpose:**
 * Catches navigation that bypasses the `useNavigation()` hook:
 * - Deep links from OS (notifications, browser, QR codes)
 * - URL edits in address bar (web)
 * - Back button/gesture navigation (mobile)
 * - Programmatic navigation from third-party code
 *
 * **How It Works:**
 * 1. Watches `useSegments()` for route changes
 * 2. Calls `evaluateObservedRouteChange()` which re-evaluates policy for the new route
 * 3. If denied: `evaluateObservedRouteChange` executes the redirect, then shows NavModal
 * 4. If allowed: no-op (route proceeds)
 *
 * **Guard Behavior:**
 * - **Allow** → no action (route change proceeds normally)
 * - **Permission/access denied** → `evaluateObservedRouteChange` redirects + NavModal shown
 * - **Abort/error** → NavModal shown
 *
 * **Return Type:**
 * Void. Modal state is managed by `ModalProvider`/`ModalLayer` via `useNavigationUiModals`.
 * No layout changes required.
 *
 * **Integration:**
 * - Root layout mounts this as a side-effect: `useRouteChangeObserver()`
 * - Failures render automatically via `ModalLayer` (same channel as `useNavigation`)
 *
 * **Notes:**
 * - Does not intercept pre-navigation; runs after-the-fact
 * - For pre-navigation checks, use `useNavigation().to/replace`
 * - Separate concern from user-triggered navigation (different trigger source)
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
