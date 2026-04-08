import { useRouter, useSegments } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking } from 'react-native';

import { NavManager } from '@/lib/navigation';
import { getPolicyModeFromConfig } from '@/lib/navigation/policy-engine';
import { logger } from '@/lib/utils';
import { useUserId, useWorldId } from '@/providers';
import { NavigationContext, NavigationDecision } from '@/type-definitions/navigation-decision';

export interface NavigationFailureState {
  visible: boolean;
  heading?: string;
  body?: string;
}

export interface GuardedNavigationAPI {
  push: (route: string, params?: Record<string, any>) => Promise<void>;
  replace: (route: string, params?: Record<string, any>) => Promise<void>;
  back: () => void;
  openModal: (route: string, params?: Record<string, any>) => void;
  openWeb: (url: string) => void;
  navFailure: NavigationFailureState;
  dismissNavFailure: () => void;
}

/**
 * useGuardedNavigation
 *
 * Provides a guarded navigation API that runs all navigation through the policy middleware.
 *
 * **Navigation Methods:**
 * - `push(route, params?)` — Run through NavManager guard pipeline (async)
 * - `replace(route, params?)` — Run through NavManager guard pipeline (async)
 * - `back()` — Bypass guards (user-initiated, low-risk)
 * - `openModal(route, params?)` — Bypass guards (modals don't need route checks)
 * - `openWeb(url)` — Open external URL (no route checks needed)
 *
 * **Guard Behavior:**
 * - Auth failure → silent redirect to login (no modal)
 * - Permission/platform/admin failure → show NavFailureModal (for user feedback)
 * - Abort → show NavFailureModal with error
 *
 * **Modal State:**
 * - `navFailure` — { visible, heading?, body? }
 * - `dismissNavFailure()` — Close the modal
 * - Consuming component renders NavFailureModal using this state
 *
 * **Usage:**
 * ```typescript
 * const navigate = useGuardedNavigation();
 *
 * // In a button handler
 * await navigate.push('/main/characters', { worldId: '123' });
 *
 * // In a consuming component, render modal
 * <NavFailureModal
 *   visible={navigate.navFailure.visible}
 *   heading={navigate.navFailure.heading}
 *   body={navigate.navFailure.body}
 *   onDismiss={navigate.dismissNavFailure}
 * />
 * ```
 */
export function useGuardedNavigation(): GuardedNavigationAPI {
  const router = useRouter();
  const segments = useSegments();
  const userId = useUserId();
  const worldId = useWorldId();

  const [navFailure, setNavFailure] = useState<NavigationFailureState>({ visible: false });

  const dismissNavFailure = useCallback(() => {
    setNavFailure(prev => ({ ...prev, visible: false }));
  }, []);

  const showNavFailureModal = useCallback((heading?: string, body?: string) => {
    setNavFailure({ visible: true, heading, body });
  }, []);

  const buildContext = useCallback(
    (toRoute: string, params?: Record<string, any>): NavigationContext => {
      const fromRoute = '/' + segments.join('/');
      return {
        fromRoute,
        toRoute,
        canonicalRoute: toRoute.toLowerCase().trim().replace(/\/$/, ''),
        params: params || {},
        triggeredBy: 'push',
        userId,
        worldId,
        subscriptionTier: undefined, // TODO: extract from context if available
      };
    },
    [segments, userId, worldId],
  );

  const handleDecision = useCallback(
    (decision: NavigationDecision): boolean => {
      logger.category('navigation').debug('Navigation decision received', { status: decision.status });

      switch (decision.status) {
        case 'allow':
          logger.category('navigation').debug('Navigation allowed');
          return true;

        case 'redirect':
          // Silent redirect for auth failures
          if (
            decision.target === '/login/sign-in' ||
            decision.target === '/' ||
            decision.target.startsWith('/login/')
          ) {
            logger.category('navigation').debug('Silent auth redirect', { target: decision.target });
            router.replace(decision.target as any);
          } else {
            // Permission/access denied — redirect to safe fallback + show modal
            logger.category('navigation').debug('Permission denied, redirecting to fallback', {
              deniedTarget: decision.target,
              fallbackWorldId: worldId,
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

            logger.category('navigation').debug('Redirecting to fallback', { fallbackRoute });
            router.replace(fallbackRoute as any);
            
            // Show modal to explain why they were redirected
            showNavFailureModal();
          }
          return false;

        case 'abort':
          logger.category('navigation').warn('Navigation aborted', {
            reason: decision.error instanceof Error ? decision.error.message : String(decision.error),
          });
          // TODO: In future, customize modal heading/body based on error type
          showNavFailureModal();
          return false;

        case 'modal_then_redirect':
          logger.category('navigation').debug('Modal before redirect', { target: decision.target });
          // TODO: In future, show modal with custom content before redirecting
          showNavFailureModal();
          return false;

        default:
          logger.category('navigation').error('Unknown navigation decision status', { decision });
          showNavFailureModal();
          return false;
      }
    },
    [router, showNavFailureModal, worldId],
  );

  const executeGuardedNavigation = useCallback(
    async (
      toRoute: string,
      action: 'push' | 'replace' = 'push',
      params?: Record<string, any>,
    ): Promise<void> => {
      try {
        const context = buildContext(toRoute, params);

        logger.category('navigation').debug('Executing guarded navigation', {
          action,
          toRoute,
          fromRoute: context.fromRoute,
        });

        const policyMode = getPolicyModeFromConfig();
        const decision = await NavManager.decidePolicyForRoute(
          context,
          policyMode,
        );

        if (handleDecision(decision)) {
          if (action === 'replace') {
            router.replace({ pathname: toRoute as any, params });
          } else {
            router.push({ pathname: toRoute as any, params });
          }
        }
      } catch (error) {
        logger.category('navigation').error('Navigation error', {
          error: error instanceof Error ? error.message : String(error),
        });
        // TODO: In future, show modal with structured error info
        showNavFailureModal();
      }
    },
    [buildContext, handleDecision, router, showNavFailureModal],
  );

  return {
    // Guarded navigation (runs through policy middleware)
    push: (route: string, params?: Record<string, any>) => executeGuardedNavigation(route, 'push', params),
    replace: (route: string, params?: Record<string, any>) => executeGuardedNavigation(route, 'replace', params),

    // Unguarded navigation (low-risk, user actions)
    back: () => {
      logger.category('navigation').debug('Back navigation');
      router.back();
    },
    openModal: (route: string, params?: Record<string, any>) => {
      logger.category('navigation').debug('Open modal', { route });
      router.push({ pathname: route as any, params });
    },
    openWeb: (url: string) => {
      logger.category('navigation').debug('Open web link', { url });
      Linking.openURL(url).catch((err: Error) => {
        logger.category('navigation').error('Failed to open URL', { url, error: err.message });
      });
    },

    // Modal state for consuming components
    navFailure,
    dismissNavFailure,
  };
}

export default useGuardedNavigation;
