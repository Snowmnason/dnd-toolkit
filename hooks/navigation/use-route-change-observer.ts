import { useSegments } from 'expo-router';
import { useEffect, useRef } from 'react';

import { evaluateObservedRouteChange } from '@/lib/navigation';
import { consumeIntent } from '@/lib/navigation/nav-intent-log';
import { logger } from '@/lib/utils';
import { setCurrentPathname } from '@/system/Navigation';

import { useNavigationUiModals } from './use-navigation-ui-modals';

// Maximum number of routes to keep in the navigation history stack.
// Covers typical user flows without unbounded memory growth.
const MAX_HISTORY = 10;

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
 * 3. Resolves the `triggeredBy` intent for the change (see Intent Resolution below)
 * 4. Calls `evaluateObservedRouteChange()` which runs the real guard pipeline
 * 5. If guards deny: redirect is executed + NavModal shown
 * 6. If guards allow: no-op (route proceeds)
 *
 * **Intent Resolution (triggeredBy):**
 * The observer owns two-stage intent resolution so guards receive accurate context:
 *
 * Stage 1 — App-initiated (via navManager):
 *   `consumeIntent()` reads the slot that navManager write-once-records before each
 *   navigation call. If a value is present, it is the authoritative source:
 *   - 'user'     → tap/click via navigate.to() / navigate.replace()
 *   - 'redirect' → forced by auth guard or bootstrap
 *   - 'back'     → explicit navigate.back() call
 *   - 'dismiss'  → modal/sheet dismiss
 *
 * Stage 2 — OS-initiated (slot is null):
 *   Nothing was recorded → the segment change came from outside the app's JS. The
 *   observer infers intent from route history:
 *   - currentRoute IS in history → 'back'  (hardware back / iOS swipe-back / Android gesture)
 *   - currentRoute NOT in history → 'deep-link'  (OS notification tap, external URL on native)
 *
 * **History Stack:**
 * A lightweight ring buffer (`routeHistoryRef`, max 10 entries) tracks the in-app forward
 * navigation path. It is updated after each change:
 * - Forward ('user' / 'redirect' / 'deep-link'): append currentRoute
 * - Backward ('back' / 'dismiss'): truncate back to (and including) currentRoute
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
  const routeHistoryRef = useRef<string[]>([]);

  const { showNavModal } = useNavigationUiModals();

  useEffect(() => {
    const currentRoute = '/' + segments.join('/');
    const previousRoute = previousSegmentsRef.current
      ? '/' + previousSegmentsRef.current.join('/')
      : null;

    // Always keep the transport layer's pathname in sync first.
    // buildNavigationContext() in navManager reads this for fromRoute.
    setCurrentPathname(currentRoute);

    previousSegmentsRef.current = [...segments];

    // Initial mount: seed the history stack and skip policy check.
    // Bootstrap guard handles the initial route on web; layouts handle it on native.
    if (!previousRoute) {
      routeHistoryRef.current = [currentRoute];
      logger.category('navigation').debug('Route observer: initial mount, skipping policy check');
      return;
    }

    // Skip if route hasn't actually changed (can happen during re-renders)
    if (currentRoute === previousRoute) return;

    // ── Intent resolution ────────────────────────────────────────────────────
    // Stage 1: check if navManager recorded an intent for this navigation.
    const intent = consumeIntent();

    // Stage 2: if nothing was recorded, infer from route history.
    // A route that appears in our forward-navigation history was previously visited —
    // the most likely cause is hardware back / swipe-back without a JS navigate.back() call.
    // A route that has never been visited is a genuine external deep link.
    type ResolvedTrigger = 'user' | 'redirect' | 'back' | 'dismiss' | 'deep-link';
    const resolvedTrigger: ResolvedTrigger = intent !== null
      ? intent
      : routeHistoryRef.current.includes(currentRoute) ? 'back' : 'deep-link';

    // ── Update history stack ─────────────────────────────────────────────────
    if (resolvedTrigger === 'back' || resolvedTrigger === 'dismiss') {
      // Truncate history back to (and including) the route being returned to.
      const idx = routeHistoryRef.current.lastIndexOf(currentRoute);
      routeHistoryRef.current = idx !== -1
        ? routeHistoryRef.current.slice(0, idx + 1)
        : [...routeHistoryRef.current.slice(-(MAX_HISTORY - 1)), currentRoute];
    } else {
      // Forward navigation: append current route (ring-buffer, max MAX_HISTORY).
      routeHistoryRef.current = [...routeHistoryRef.current.slice(-(MAX_HISTORY - 1)), currentRoute];
    }

    logger.category('navigation').debug('Route change detected', {
      fromRoute: previousRoute,
      toRoute: currentRoute,
      triggeredBy: resolvedTrigger,
    });

    // ── Skip re-evaluation for manager-initiated navigations ─────────────────
    // 'user' and 'redirect' navigations already ran the full guard pipeline inside
    // executeRouteNavigation / executeInternalRedirectNavigation. Re-running here
    // would fail because worldId params exist in the call site but are not yet
    // flushed to storage, causing the permission guard to read undefined.
    // History has already been updated above — we just don't re-check policy.
    if (resolvedTrigger === 'user' || resolvedTrigger === 'redirect') {
      return;
    }

    const checkRoutePolicy = async () => {
      try {
        const result = await evaluateObservedRouteChange(currentRoute, previousRoute, resolvedTrigger);

        logger.category('navigation').debug('Route observer: policy result', {
          status: result.status,
          toRoute: currentRoute,
        });

        if (result.status === 'aborted') {
          if (result.reason === 'platform-incompatible') {
            // Platform-incompatible: the OS or browser sent us to a route that
            // doesn't exist on this platform. Log it but don't show a failure modal —
            // the bootstrap guard or layout-level auth guard will redirect silently.
            logger.category('navigation').warn('Route observer: platform-incompatible route, skipping failure modal', {
              reason: result.reason,
            });
          } else {
            logger.category('navigation').warn('Route observer: policy check aborted', {
              reason: result.reason,
            });
            showNavModal('failure');
          }
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
