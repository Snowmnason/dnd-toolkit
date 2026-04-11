/**
 * Navigation Policy Engine
 *
 * Determines which guards should run for a given route based on:
 * - Current policy mode (protected_by_default or public_by_default)
 * - Route-specific configuration overrides
 * - Platform compatibility checks
 *
 * This is the decision-making layer that bridges:
 * - Route config (which routes need auth)
 * - Policy mode (what's the default access rule)
 * - Overrides (app-specific exceptions)
 * → Guard list (which checks to actually run)
 */

import { getAppConfig } from '@/config/core/loader';
import { AUTH_CONFIG } from '@/config/routing-auth-config';
import { AuthStateManager } from '@/lib/auth/auth-state';
import { logger } from '@/lib/utils';
import { NavigationContext, NavigationDecision, NavigationGuardConfig, NavigationPolicyMode } from '@/type-definitions/';

/**
 * Override directives for specific routes
 * Allows fine-tuning policy per route without changing mode
 */
export interface RouteOverrides {
  /** Force this route to require authentication */
  forceAuth?: boolean;
  /** Force this route to require permission verification */
  forcePermission?: boolean;
  /** Force this route to require admin access */
  forceAdmin?: boolean;
  /** Force this route to be public (ignore mode) */
  forcePublic?: boolean;
}

/**
 * Route policy verdict - which guards to run for this route
 */
export type RoutePolicyVerdict = 'allow_all' | 'require_auth' | 'require_permission' | 'require_admin' | 'custom';

/**
 * Get the current navigation policy mode from config
 *
 * Reads from config/appsettings.json (or .dev.json in development).
 * Defaults to 'protected_by_default' if not configured.
 *
 * @returns The configured policy mode
 */
export function getPolicyModeFromConfig(): NavigationPolicyMode {
  try {
    const config = getAppConfig();
    const mode = config.navigationPolicy?.defaultAccessMode;
    if (mode && (mode === 'protected_by_default' || mode === 'public_by_default')) {
      logger.category('navigation').debug('Policy mode from config', { mode });
      return mode;
    }
    logger.category('navigation').warn('navigationPolicy.defaultAccessMode not configured, using default');
    return 'protected_by_default';
  } catch (error) {
    logger.category('navigation').error('Failed to read policy mode from config', {
      error: error instanceof Error ? error.message : String(error),
    });
    return 'protected_by_default';
  }
}

/**
 * Navigation Policy Engine
 *
 * Centralized decision logic for policy mode + guard selection.
 * Called by nav-manager to build the guard pipeline for each navigation.
 */
export class PolicyEngine {
  /**
   * Get the policy verdict for a route based on mode and overrides
   *
   * @param toRoute - Destination route (canonicalized)
   * @param mode - Current policy mode (protected_by_default or public_by_default)
   * @param overrides - Route-specific overrides (optional)
   * @returns Policy verdict that describes guard requirements
   *
   * Policy verdicts:
   * - 'allow_all': No guards required
   * - 'require_auth': Authentication required
   * - 'require_permission': Permission verification required (e.g., world access, friend access)
   * - 'require_admin': Admin privileges required
   * - 'custom': Custom guard logic
   */
  static getPolicyForRoute(
    toRoute: string,
    mode: NavigationPolicyMode,
    overrides?: RouteOverrides,
  ): RoutePolicyVerdict {
    logger.category('navigation').debug('Policy engine: evaluating route', {
      toRoute,
      mode,
      overrides,
    });

    // Overrides take precedence: force public, force auth, force permission, force admin
    if (overrides?.forcePublic) {
      logger.category('navigation').debug('Policy: forcePublic override active');
      return 'allow_all';
    }
    if (overrides?.forceAdmin) {
      logger.category('navigation').debug('Policy: forceAdmin override active');
      return 'require_admin';
    }
    if (overrides?.forcePermission) {
      logger.category('navigation').debug('Policy: forcePermission override active');
      return 'require_permission';
    }
    if (overrides?.forceAuth) {
      logger.category('navigation').debug('Policy: forceAuth override active');
      return 'require_auth';
    }

    // Mode-based decision:
    // - protected_by_default: only explicitly public routes allow access
    // - public_by_default: only explicitly protected routes require auth
    if (mode === 'protected_by_default') {
      // Reject unless explicitly in publicRoutes
      const isPublic = AUTH_CONFIG.publicRoutes.some((publicRoute: string) =>
        toRoute.toLowerCase().includes(publicRoute.toLowerCase()),
      );
      if (isPublic) {
        return 'allow_all';
      }
      // Routes containing 'world' require world-level permission verification
      if (toRoute.toLowerCase().includes('world')) {
        return 'require_permission';
      }
      return 'require_auth';
    }

    // public_by_default: allow unless explicitly protected
    const isProtected = AUTH_CONFIG.protectedRoutes.some((protectedRoute: string) =>
      toRoute.toLowerCase().includes(protectedRoute.toLowerCase()),
    );
    if (!isProtected) {
      return 'allow_all';
    }
    // Routes containing 'world' require world-level permission verification
    if (toRoute.toLowerCase().includes('world')) {
      return 'require_permission';
    }
    return 'require_auth';
  }

  /**
   * Build the guard pipeline for a route based on policy verdict
   *
   * Returns the list of guard configs that should run for this navigation.
   * Each guard is a check that can allow, deny, or redirect the navigation.
   *
   * @param verdict - Policy verdict from getPolicyForRoute
   * @param context - Navigation context for the guards to evaluate
   * @returns Array of guards to execute in order (pre → normal → post)
   */
  static buildGuardPipeline(
    verdict: RoutePolicyVerdict,
    context: NavigationContext,
  ): NavigationGuardConfig[] {
    const guards: NavigationGuardConfig[] = [];

    // Platform check: early reject if platform constraint mismatched
    // (This will be filled in by nav-manager from route metadata)
    // For now, return basic guard set based on verdict

    switch (verdict) {
      case 'allow_all':
        // No guards needed
        logger.category('navigation').debug('Policy: allow_all - no guards required');
        return [];

      case 'require_auth':
        // Auth check only
        logger.category('navigation').debug('Policy: require_auth - 1 guard');
        guards.push({
          name: 'auth-check',
          priority: 'pre',
          check: async (ctx: NavigationContext): Promise<NavigationDecision> => {
            if (ctx.userId) {
              return { status: 'allow' };
            }
            return {
              status: 'redirect',
              target: AUTH_CONFIG.redirectOnUnauthenticated || '/',
              reason: 'Authentication required',
            };
          },
          timeoutMs: 5000,
        });
        return guards;

      case 'require_permission':
        // Auth check + permission verification (e.g., world access, friend access)
        logger.category('navigation').debug('Policy: require_permission - 2 guards');
        guards.push({
          name: 'auth-check',
          priority: 'pre',
          check: async (ctx: NavigationContext): Promise<NavigationDecision> => {
            if (ctx.userId) {
              return { status: 'allow' };
            }
            return {
              status: 'redirect',
              target: AUTH_CONFIG.redirectOnUnauthenticated || '/',
              reason: 'Authentication required',
            };
          },
          timeoutMs: 5000,
        });
        guards.push({
          name: 'permission-check',
          priority: 'normal',
          check: async (ctx: NavigationContext): Promise<NavigationDecision> => {
            if (ctx.worldId) {
              return { status: 'allow' };
            }
            return {
              status: 'redirect',
              target: '/select/world-selection',
              reason: 'Permission verification required',
            };
          },
          timeoutMs: 5000,
        });
        return guards;

      case 'require_admin':
        // Auth check + admin verification (always reads fresh from storage)
        logger.category('navigation').debug('Policy: require_admin - 2 guards');
        guards.push({
          name: 'auth-check',
          priority: 'pre',
          check: async (ctx: NavigationContext): Promise<NavigationDecision> => {
            if (ctx.userId) {
              return { status: 'allow' };
            }
            return {
              status: 'redirect',
              target: AUTH_CONFIG.redirectOnUnauthenticated || '/',
              reason: 'Authentication required',
            };
          },
          timeoutMs: 5000,
        });
        guards.push({
          name: 'admin-check',
          priority: 'normal',
          // Admin status is stored as `is_admin: boolean` in user data (SecureStorage).
          // NOTE: The admin panel page itself always force-refreshes from DB on mount —
          // this guard is a fast pre-navigation gate using the cached user profile.
          // If admin status may have changed, the page-level check catches it.
          check: async (_ctx: NavigationContext): Promise<NavigationDecision> => {
            try {
              const userData = await AuthStateManager.getUserData();
              if (userData?.is_admin === true) {
                return { status: 'allow' };
              }
            } catch (error) {
              logger.category('navigation').error('Admin check failed to read user data', {
                error: error instanceof Error ? error.message : String(error),
              });
            }
            return {
              status: 'abort',
              error: new Error('Admin access required'),
              reason: 'Insufficient permissions',
            };
          },
          timeoutMs: 5000,
        });
        return guards;

      case 'custom':
        // Custom guard set (future: read from route config)
        logger.category('navigation').debug('Policy: custom - route-specific guards');
        return [];

      default:
        logger.category('navigation').warn('Policy: unknown verdict', { verdict });
        return [];
    }
  }
}
