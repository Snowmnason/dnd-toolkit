import { useRouter, useSegments } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { NavManager } from '@/lib/navigation';
import { getPolicyModeFromConfig } from '@/lib/navigation/policy-engine';
import { logger } from '@/lib/utils';
import { useUserId, useWorldId } from '@/providers';
import { NavigationContext, NavigationDecision } from '@/type-definitions/navigation-decision';

export interface RouteChangeObserverState {
  navFailureVisible: boolean;
  navFailureHeading?: string;
  navFailureBody?: string;
}

/**
 * useRouteChangeObserver
 *
 * Observes all route changes (deep links, URL edits, back button) and runs them through
 * the navigation policy middleware. This catches navigation that bypasses `useGuardedNavigation()`.
 *
 * **When to Use:**
 * - Mount once in root layout (`app/_layout.tsx`)
 * - Catches deep links, URL bar edits, back button, and other route transitions
 * - Works alongside `useGuardedNavigation()` for comprehensive route protection
 *
 * **Guard Behavior:**
 * - Allow → do nothing (route change proceeds)
 * - Auth redirect → silently redirect to login (no modal)
 * - Deny (permission/admin/platform) → show NavFailureModal
 * - Abort → show NavFailureModal with error
 *
 * **Implementation Notes:**
 * - Uses `useSegments()` to detect route changes
 * - Compares current route to previous route to detect changes
 * - Only triggers policy check when route actually changes
 * - Does NOT intercept route change (runs after-the-fact); shows modal if denied
 * - For pre-navigation checks (before route change), use `useGuardedNavigation().push/replace`
 *
 * **Usage:**
 * Mount in app/_layout.tsx root layout:
 * ```
 * const observer = useRouteChangeObserver();
 * // Then render NavFailureModal using observer state
 * NavFailureModal visibility={observer.navFailureVisible}
 * ```
 *
 * @returns Observer state with modal visibility and dismiss handler
 */
export function useRouteChangeObserver(): RouteChangeObserverState & { dismissNavFailure: () => void } {
  const router = useRouter();
  const segments = useSegments();
  const userId = useUserId();
  const worldId = useWorldId();

  const previousSegmentsRef = useRef<string[] | null>(null);
  const routeHistoryRef = useRef<string[]>([]); // Track visited routes for back button detection
  const [navFailure, setNavFailure] = useState<RouteChangeObserverState>({ navFailureVisible: false });

  const dismissNavFailure = () => {
    setNavFailure(prev => ({ ...prev, navFailureVisible: false }));
  };

  /**
   * Detect if navigation is a back button press by checking if the new route
   * was previously visited in the route history stack.
   */
  const detectBackButtonNavigation = (
    currentRoute: string,
    previousRoute: string,
    history: string[],
  ): boolean => {
    // Find positions in history
    const previousIndex = history.indexOf(previousRoute);
    const currentIndex = history.indexOf(currentRoute);

    // Back button: navigating to a route earlier in history
    // (currentIndex is less than previousIndex, meaning we're going back in the stack)
    if (previousIndex !== -1 && currentIndex !== -1 && currentIndex < previousIndex) {
      return true;
    }

    return false;
  };

  const showNavFailureModal = useCallback((heading?: string, body?: string) => {
    setNavFailure({ navFailureVisible: true, navFailureHeading: heading, navFailureBody: body });
  }, []);

  const handleDecision = useCallback(
    (
      decision: NavigationDecision,
      toRoute: string,
      fromRoute: string,
    ): void => {
      logger.category('navigation').debug('Route observer: decision received', {
        status: decision.status,
        toRoute,
      });

      switch (decision.status) {
        case 'allow':
          logger.category('navigation').debug('Route allowed, proceeding');
          // No action — route change is already complete
          break;

        case 'redirect':
          // Silent redirect for auth failures
          if (
            decision.target === '/login/sign-in' ||
            decision.target === '/' ||
            decision.target.startsWith('/login/')
          ) {
            logger.category('navigation').debug('Auth redirect after route change', {
              currentRoute: toRoute,
              target: decision.target,
            });
            router.replace(decision.target as any);
          } else {
            // Permission/access denied — redirect to safe fallback + show modal
            logger.category('navigation').debug('Permission denied after route change, redirecting to fallback', {
              deniedRoute: toRoute,
              hasWorld: !!worldId,
            });

            // Determine safe fallback route
            let fallbackRoute: string;
            if (worldId) {
              // User has a current world, redirect back to it
              fallbackRoute = `/main/${worldId}`;
            } else {
              // No current world, send to world selection
              fallbackRoute = '/select/world-selection';
            }

            // Log redirection without exposing worldId (PII safety)
            logger.category('navigation').debug('Redirecting to fallback after denied access', { 
              hasWorld: !!worldId,
              target: fallbackRoute.startsWith('/main') ? '/main/[world]' : fallbackRoute,
            });
            router.replace(fallbackRoute as any);
            
            // Show modal to explain why they were redirected
            showNavFailureModal();
          }
          break;

        case 'abort':
          logger.category('navigation').warn('Route change aborted', {
            reason: decision.error instanceof Error ? decision.error.message : String(decision.error),
            toRoute,
          });
          // TODO: In future, customize modal heading/body based on error type
          showNavFailureModal();
          break;

        case 'modal_then_redirect':
          logger.category('navigation').debug('Modal before redirect after route change', {
            toRoute,
            target: decision.target,
          });
          // TODO: In future, show modal with custom content before redirecting
          showNavFailureModal();
          break;

        default:
          logger.category('navigation').error('Unknown route observer decision status', {
            decision,
            toRoute,
          });
          showNavFailureModal();
      }
    },
    [router, showNavFailureModal, worldId],
  );

  useEffect(() => {
    // Convert segments to route string
    const currentRoute = '/' + segments.join('/');
    const previousRoute = previousSegmentsRef.current ? '/' + previousSegmentsRef.current.join('/') : null;

    // Update previous segments for next comparison
    previousSegmentsRef.current = segments;

    // Initialize route history on first mount
    if (!previousRoute && routeHistoryRef.current.length === 0) {
      routeHistoryRef.current.push(currentRoute);
      logger.category('navigation').debug('Route observer: initial mount, skipping policy check');
      return;
    }

    // Skip check on initial mount (no previous route)
    if (!previousRoute) {
      logger.category('navigation').debug('Route observer: initial mount, skipping policy check');
      return;
    }

    // Skip if route hasn't actually changed (can happen during re-renders)
    if (currentRoute === previousRoute) {
      return;
    }

    logger.category('navigation').debug('Route change detected', {
      fromRoute: previousRoute,
      toRoute: currentRoute,
    });

    // Check policy after route change
    const checkRoutePolicy = async () => {
      try {
        // Update route history to include the new route if not already there
        if (!routeHistoryRef.current.includes(currentRoute)) {
          routeHistoryRef.current.push(currentRoute);
        }

        // Detect if this is a back button navigation
        const isBackButton = detectBackButtonNavigation(
          currentRoute,
          previousRoute,
          routeHistoryRef.current,
        );

        // Determine navigation source
        const triggeredBy = isBackButton ? 'back' : 'deep-link';

        const context: NavigationContext = {
          fromRoute: previousRoute,
          toRoute: currentRoute,
          canonicalRoute: currentRoute.toLowerCase().trim().replace(/\/$/, ''),
          params: {}, // URL params would be extracted from useLocalSearchParams() if needed
          triggeredBy,
          userId,
          worldId,
          subscriptionTier: undefined, // TODO: extract from context if available
        };

        logger.category('navigation').debug('Checking route policy after change', {
          fromRoute: previousRoute,
          toRoute: currentRoute,
        });

        const policyMode = getPolicyModeFromConfig();
        const decision = await NavManager.decidePolicyForRoute(
          context,
          policyMode,
        );

        handleDecision(decision, currentRoute, previousRoute);
      } catch (error) {
        logger.category('navigation').error('Route policy check failed', {
          error: error instanceof Error ? error.message : String(error),
        });
        showNavFailureModal();
      }
    };

    checkRoutePolicy();
  }, [segments, userId, worldId, router, handleDecision, showNavFailureModal]);

  return {
    navFailureVisible: navFailure.navFailureVisible,
    navFailureHeading: navFailure.navFailureHeading,
    navFailureBody: navFailure.navFailureBody,
    dismissNavFailure,
  };
}

export default useRouteChangeObserver;
