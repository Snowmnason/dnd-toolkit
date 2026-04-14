import { useCallback, useEffect, useRef } from 'react';

import {
  executeExternalNavigation,
  executeHistoryNavigation,
  executeRouteNavigation,
  executeStateQueryNavigation,
  executeUtilityNavigation,
} from '@/lib/navigation';
import { logger } from '@/lib/utils';

import { useNavigationUiModals } from './use-navigation-ui-modals';

export type { NavModalResponseType } from './use-navigation-ui-modals';

// ─── Throttle Options ─────────────────────────────────────────────────────────

/**
 * Per-call options for navigation methods.
 *
 * Every navigation method accepts an optional trailing options object to
 * control built-in duplicate-call throttling.
 *
 * - **Omitted** → uses the hook-level default (300 ms)
 * - **`throttleMs: 500`** → extends suppression window for this call
 * - **`throttleMs: 0`** or **`throttleMs: false`** → disables throttling for this call
 */
export interface NavigationCallOptions {
  throttleMs?: number | false;
}

/** Default throttle window applied to every call unless overridden. */
const DEFAULT_THROTTLE_MS = 300;

export interface UseNavigation {
  // ---- Transition family (guarded, fire-and-go) ----
  to: (route: string, params?: Record<string, string>, options?: NavigationCallOptions) => void;
  replace: (route: string, params?: Record<string, string>, options?: NavigationCallOptions) => void;

  // ---- History family (stack manipulation) ----
  back: (options?: NavigationCallOptions) => void;
  dismiss: (options?: NavigationCallOptions) => void;
  dismissAll: (target?: string, options?: NavigationCallOptions) => void;

  // ---- Utility family ----
  /** Update query parameters on the current route without navigating. */
  setParams: (params: Record<string, string>, options?: NavigationCallOptions) => void;
  /** Prefetch a route bundle in the background before navigating to it. */
  prefetch: (route: string, options?: NavigationCallOptions) => void;

  // ---- State queries (synchronous reads, no side-effects) ----
  /** Returns true if a back navigation is available in the current stack. */
  canGoBack: () => boolean;
  /** Returns true if a dismiss operation is available in the current stack. */
  canDismiss: () => boolean;
  /** Returns the current route path (e.g. '/main/worlds'). */
  getCurrentRoute: () => string;
  /** Returns the current route's query parameters. */
  getCurrentParams: () => Record<string, any>;

  // ---- External family ----
  openWeb: (url: string, options?: NavigationCallOptions) => void;
}

// ─── Throttle Internals ───────────────────────────────────────────────────────

/**
 * Build a deterministic deduplication key from a method name and its arguments.
 * Normalizes param object key order so `{ a, b }` and `{ b, a }` produce the
 * same key.
 */
function buildThrottleKey(method: string, args: unknown[]): string {
  const parts = args.map((arg) => {
    if (arg == null) return '';
    if (typeof arg === 'object' && !Array.isArray(arg)) {
      // Sort keys for deterministic serialization
      const entries = Object.entries(arg as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
      return JSON.stringify(Object.fromEntries(entries));
    }
    return String(arg);
  });
  return `${method}:${parts.join(':')}`;
}

/**
 * Resolve the effective throttle window for a single call.
 * Returns `0` (disabled) when the caller explicitly opts out.
 */
function resolveThrottleMs(options?: NavigationCallOptions): number {
  if (options?.throttleMs === false || options?.throttleMs === 0) return 0;
  return options?.throttleMs ?? DEFAULT_THROTTLE_MS;
}

/**
 * useNavigation
 *
 * PRIMARY HOOK for user-triggered navigation. Use this in screens and components.
 *
 * **IMPORTANT: User-Triggered Navigation Only**
 * This hook is for screen-initiated navigation ONLY (user taps a button, clicks a link, etc).
 * Internal redirects from auth/jobs should NOT use this hook; they call managers directly.
 * See `executeInternalRedirectNavigation` for auth-driven redirects.
 *
 * **Built-In Throttling:**
 * Every method deduplicates rapid identical calls within a default 300 ms window.
 * Override per-call via the trailing options object:
 * - `{ throttleMs: 500 }` — longer suppression for slow routes
 * - `{ throttleMs: 0 }` or `{ throttleMs: false }` — disable for this call
 *
 * **Action Families:**
 * - Transition (`to`, `replace`) — fire-and-go, full guard pipeline via NavManager
 *   - Returns void; failures handled via navFailure state (NavModal shown automatically)
 * - History (`back`, `dismiss`, `dismissAll`) — fire-and-forget, no guards
 *   - Synchronous stack manipulation (no Promise)
 * - External (`openWeb`) — scheme-validated with two-level trust model:
 *   - Internally trusted → opens immediately
 *   - Unknown origin → shows TrustedUrlConsentModal with three-option consent:
 *     1. "Don't open" (dismiss, no tracking)
 *     2. "Open anyway" (one-time, don't persist trust)
 *     3. "Trust & open" (persist origin as trusted for future)
 *
 * **Failure Handling:**
 * When navigation fails (permission denied, policy abort, etc):
 * - `to()` and `replace()` do NOT throw; they show NavModal via ModalProvider
 * - Hook does NOT automatically redirect; failures are advisory
 *
 * **Return Type:**
 * - All methods return `void` — fire-and-go; do NOT await them at call sites
 * - `to()` / `replace()` run the full guard pipeline internally; failures show NavModal
 * - `back()` / `dismiss()` / `dismissAll()` are synchronous stack manipulation
 * - `openWeb()` is void (trust modal opens if needed; hook manages state)
 *
 * **Usage:**
 * ```typescript
 * const navigate = useNavigation();
 *
 * // Guarded transitions (with policy checks) — fire-and-go, no await needed
 * navigate.to('/main/characters', { worldId: '123' });
 * navigate.replace('/select/world-selection');
 *
 * // History manipulation (fire-and-forget)
 * navigate.back();
 * navigate.dismiss();
 * navigate.dismissAll();
 * navigate.dismissAll('main/world-select'); // dismissTo
 *
 * // External (shows trust modal if origin unknown)
 * navigate.openWeb('https://example.com');
 *
 * // Disable throttling for a specific call
 * navigate.to('/debug/logs', undefined, { throttleMs: false });
 *
 * // Extend throttle window for a slow route
 * navigate.to('/main/heavy-page', { id: '1' }, { throttleMs: 500 });
 *
 * // Modals are rendered automatically via ModalProvider — no layout changes needed.
 * ```
 */
export function useNavigation(): UseNavigation {
  const { showNavModal, dismissNavModal, showTrustModal, dismissTrustModal } = useNavigationUiModals();

  // ---- Internal throttle state ----

  const lastCallRef = useRef<{ key: string; at: number } | null>(null);

  /**
   * Returns `true` if this call should be skipped (duplicate within throttle window).
   * When throttling is disabled (`windowMs === 0`), always returns `false`.
   */
  const shouldThrottle = useCallback((key: string, windowMs: number): boolean => {
    if (windowMs <= 0) return false;
    const now = Date.now();
    if (lastCallRef.current && lastCallRef.current.key === key && now - lastCallRef.current.at < windowMs) {
      return true;
    }
    lastCallRef.current = { key, at: now };
    return false;
  }, []);

  // Defensive cleanup on unmount — clears the ref so no stale state can persist
  // if the hook instance is somehow retained beyond component lifecycle.
  useEffect(() => {
    return () => {
      lastCallRef.current = null;
    };
  }, []);

  // ---- Shared result handler ----

  const handleResult = useCallback(
    (result: Awaited<ReturnType<typeof executeRouteNavigation>>, context?: string) => {
      if (result.status === 'aborted' || result.status === 'transport-unavailable') {
        logger.category('navigation').warn('Navigation aborted', {
          reason: result.reason,
          context,
        });
        const canGoBack = executeStateQueryNavigation('canGoBack') as boolean ?? false;
        showNavModal(
          'failure',
          undefined,
          result.reason,
          canGoBack,
          () => {
            dismissNavModal();
            // Directly execute — calling replace() here would create a circular dependency
            // (replace() calls handleResult, handleResult defines this callback)
            // Pass semantic 'default' target; navManager resolves it internally (auth-aware)
            executeRouteNavigation('default', {}, undefined, 'replace').catch(
              (err: Error) => logger.category('navigation').error('go-default failed', { error: err.message }),
            );
          },
          canGoBack
            ? () => {
                dismissNavModal();
                executeHistoryNavigation('back').catch(
                  (err: Error) => logger.category('navigation').error('go-back failed', { error: err.message }),
                );
              }
            : undefined,
        );
      }
    },
    [showNavModal, dismissNavModal],
  );

  // ---- Transition family ----

  const to = useCallback(
    (route: string, params?: Record<string, string>, options?: NavigationCallOptions): void => {
      const windowMs = resolveThrottleMs(options);
      if (shouldThrottle(buildThrottleKey('to', [route, params]), windowMs)) return;

      executeRouteNavigation(route, params)
        .then((result) => handleResult(result, 'to'))
        .catch((error: unknown) => {
          logger.category('navigation').error('Navigation error', {
            error: error instanceof Error ? error.message : String(error),
          });
          showNavModal('failure', undefined, 'An unexpected error occurred.');
        });
    },
    [handleResult, showNavModal, shouldThrottle],
  );

  const replace = useCallback(
    (route: string, params?: Record<string, string>, options?: NavigationCallOptions): void => {
      const windowMs = resolveThrottleMs(options);
      if (shouldThrottle(buildThrottleKey('replace', [route, params]), windowMs)) return;

      executeRouteNavigation(route, params, undefined, 'replace')
        .then((result) => handleResult(result, 'replace'))
        .catch((error: unknown) => {
          logger.category('navigation').error('Navigation error', {
            error: error instanceof Error ? error.message : String(error),
          });
          showNavModal('failure', undefined, 'An unexpected error occurred.');
        });
    },
    [handleResult, showNavModal, shouldThrottle],
  );

  // ---- History family ----

  const back = useCallback((options?: NavigationCallOptions) => {
    const windowMs = resolveThrottleMs(options);
    if (shouldThrottle('back', windowMs)) return;

    executeHistoryNavigation('back').catch((err: Error) =>
      logger.category('navigation').error('back failed', { error: err.message }),
    );
  }, [shouldThrottle]);

  const dismiss = useCallback((options?: NavigationCallOptions) => {
    const windowMs = resolveThrottleMs(options);
    if (shouldThrottle('dismiss', windowMs)) return;

    executeHistoryNavigation('dismiss').catch((err: Error) =>
      logger.category('navigation').error('dismiss failed', { error: err.message }),
    );
  }, [shouldThrottle]);

  const dismissAll = useCallback((target?: string, options?: NavigationCallOptions) => {
    const windowMs = resolveThrottleMs(options);
    if (shouldThrottle(buildThrottleKey('dismissAll', [target]), windowMs)) return;

    const action = target ? 'dismissTo' : 'dismissAll';
    executeHistoryNavigation(action, target).catch((err: Error) =>
      logger.category('navigation').error('dismissAll failed', { error: err.message }),
    );
  }, [shouldThrottle]);

  // ---- State queries ----

  const canGoBack = useCallback(
    (): boolean => (executeStateQueryNavigation('canGoBack') as boolean) ?? false,
    [],
  );

  const canDismiss = useCallback(
    (): boolean => (executeStateQueryNavigation('canDismiss') as boolean) ?? false,
    [],
  );

  const getCurrentRoute = useCallback(
    (): string => (executeStateQueryNavigation('getCurrentRoute') as string) ?? '/',
    [],
  );

  const getCurrentParams = useCallback(
    (): Record<string, any> => (executeStateQueryNavigation('getCurrentParams') as Record<string, any>) ?? {},
    [],
  );

  // ---- Utility family ----

  const setParams = useCallback(
    (params: Record<string, string>, options?: NavigationCallOptions): void => {
      const windowMs = resolveThrottleMs(options);
      if (shouldThrottle(buildThrottleKey('setParams', [params]), windowMs)) return;

      executeUtilityNavigation('setParams', params).catch((err: Error) =>
        logger.category('navigation').error('setParams failed', { error: err.message }),
      );
    },
    [shouldThrottle],
  );

  const prefetch = useCallback(
    (route: string, options?: NavigationCallOptions): void => {
      const windowMs = resolveThrottleMs(options);
      if (shouldThrottle(buildThrottleKey('prefetch', [route]), windowMs)) return;

      executeUtilityNavigation('prefetch', { target: route }).catch((err: Error) =>
        logger.category('navigation').error('prefetch failed', { error: err.message }),
      );
    },
    [shouldThrottle],
  );

  // ---- External family ----

  const openWeb = useCallback(
    (url: string, options?: NavigationCallOptions) => {
      const windowMs = resolveThrottleMs(options);
      if (shouldThrottle(buildThrottleKey('openWeb', [url]), windowMs)) return;

      executeExternalNavigation(url)
        .then((result) => {
          if (result.status === 'ui-required' && result.instruction.type === 'trusted-url-consent') {
            // Unknown origin — bind callbacks to this url and open trust modal
            showTrustModal(
              url,
              () => dismissTrustModal(),
              () => {
                dismissTrustModal();
                executeExternalNavigation(url, { skipTrustCheck: true })
                  .then((r) => handleResult(r, 'openWebAnyway'))
                  .catch((err: Error) =>
                    logger.category('navigation').error('openWebAnyway failed', { error: err.message }),
                  );
              },
              () => {
                dismissTrustModal();
                executeExternalNavigation(url, { storeTrust: true })
                  .then((r) => handleResult(r, 'openWebTrusted'))
                  .catch((err: Error) =>
                    logger.category('navigation').error('openWebTrusted failed', { error: err.message }),
                  );
              },
            );
          } else {
            handleResult(result, 'openWeb');
          }
        })
        .catch((err: Error) =>
          logger.category('navigation').error('openWeb failed', { error: err.message }),
        );
    },
    [handleResult, showTrustModal, dismissTrustModal, shouldThrottle],
  );

  return {
    to,
    replace,
    back,
    dismiss,
    dismissAll,
    setParams,
    prefetch,
    canGoBack,
    canDismiss,
    getCurrentRoute,
    getCurrentParams,
    openWeb,
  };
}

export default useNavigation;