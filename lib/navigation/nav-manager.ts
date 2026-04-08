/**
 * Navigation Manager
 *
 * Main orchestration hub for navigation decisions.
 * Entry point for all policy-driven navigation.
 *
 * Pipeline (clean hierarchy: Manager → Middleware → System):
 * 1. Validate input context
 * 2. Canonicalize route (lib-level utility)
 * 3. Resolve route metadata from navigation-config
 * 4. Platform compatibility check (early reject)
 * 5. Policy verdict + guard pipeline (PolicyEngine)
 * 6. Delegate to middleware (NavService → system/Navigation)
 * 7. Return decision
 *
 * The manager NEVER calls system/ directly — middleware handles that bridge.
 */

import { NavService } from '@/lib/middleware/navigation/nav-service';
import { logger } from '@/lib/utils';
import type { NavigationContext, NavigationDecision, NavigationPolicyMode } from '@/type-definitions/navigation-decision';
import { getAllRouteConfigs } from './navigation-config';
import { PolicyEngine, type RouteOverrides } from './policy-engine';
import { canonicalizePath } from './route-canonicalizer';
import { applyRouteMetadata, isPlatformCompatible, type RouteMetadata } from './route-translator';

/**
 * NavManager - Stateless orchestrator for navigation decisions
 *
 * Called for each navigation attempt. No stored state.
 */
export class NavManager {
  /**
   * Main entry point: decide if navigation is allowed based on policy
   *
   * @param context Navigation context (from/to routes, user/world state)
   * @param policyMode App-level policy (protected_by_default or public_by_default)
   * @param overrides Route-specific overrides (optional)
   * @returns Navigation decision (allow, redirect, abort, or modal)
   */
  static async decidePolicyForRoute(
    context: NavigationContext,
    policyMode: NavigationPolicyMode,
    overrides?: RouteOverrides,
  ): Promise<NavigationDecision> {
    logger.category('navigation').debug('NavManager: processing navigation', {
      from: context.fromRoute,
      to: context.toRoute,
      policyMode,
    });

    try {
      // Step 1: Validate input context
      if (!context.toRoute) {
        logger.category('navigation').error('NavManager: missing toRoute');
        return {
          status: 'abort',
          error: 'Invalid navigation context: missing toRoute',
          reason: 'Validation failed',
        };
      }

      // Step 2: Canonicalize route
      const canonicalRoute = canonicalizePath(context.toRoute);
      const canonicalizedContext: NavigationContext = {
        ...context,
        canonicalRoute,
      };

      // Step 3: Resolve route metadata from navigation-config
      const metadata = NavManager.resolveRouteMetadata(canonicalRoute);
      const processedContext = applyRouteMetadata(canonicalizedContext, metadata);

      logger.category('navigation').debug('NavManager: route resolved', {
        canonical: canonicalRoute,
        hasMetadata: !!metadata,
      });

      // Step 4: Platform compatibility check (early reject before guards)
      if (!isPlatformCompatible(processedContext, metadata)) {
        logger.category('navigation').warn('NavManager: platform mismatch', {
          current: context.platform,
          required: metadata?.platform,
          route: canonicalRoute,
        });
        return {
          status: 'abort',
          error: `Route ${canonicalRoute} is not available on ${context.platform || 'this platform'}`,
          reason: 'Platform mismatch',
        };
      }

      // Step 5: Policy verdict + guard pipeline
      const verdict = PolicyEngine.getPolicyForRoute(canonicalRoute, policyMode, overrides);
      const guards = PolicyEngine.buildGuardPipeline(verdict, processedContext);

      logger.category('navigation').debug('NavManager: policy resolved', {
        verdict,
        guardCount: guards.length,
      });

      // Step 6: Delegate to middleware
      const decision = await NavService.executeNavigation(processedContext, guards);

      logger.category('navigation').debug('NavManager: decision received', {
        status: decision.status,
      });

      return decision;
    } catch (error) {
      logger.category('navigation').error('NavManager: pipeline error', {
        error: error instanceof Error ? error.message : String(error),
        toRoute: context.toRoute,
      });

      return {
        status: 'abort',
        error: error instanceof Error ? error.message : 'Unknown error',
        reason: 'Internal pipeline error',
      };
    }
  }

  /**
   * Shorthand for protected-by-default mode (current app model)
   */
  static async decidePolicyForRouteProtected(
    context: NavigationContext,
    overrides?: RouteOverrides,
  ): Promise<NavigationDecision> {
    return this.decidePolicyForRoute(context, 'protected_by_default', overrides);
  }

  /**
   * Shorthand for public-by-default mode (future app model)
   */
  static async decidePolicyForRoutePublic(
    context: NavigationContext,
    overrides?: RouteOverrides,
  ): Promise<NavigationDecision> {
    return this.decidePolicyForRoute(context, 'public_by_default', overrides);
  }

  /**
   * Resolve route metadata from navigation-config
   *
   * Looks up the RouteConfig for a canonical path and extracts
   * middleware-relevant metadata (auth, world access, platform, deny strategy).
   */
  private static resolveRouteMetadata(canonicalRoute: string): RouteMetadata | undefined {
    try {
      const allConfigs = getAllRouteConfigs();
      const match = allConfigs.find((config) => {
        const configCanonical = canonicalizePath(config.path);
        if (configCanonical === canonicalRoute) return true;
        return config.aliases?.some((alias: string) => canonicalizePath(alias) === canonicalRoute);
      });

      if (!match) {
        logger.category('navigation').debug('NavManager: no route config found', {
          route: canonicalRoute,
        });
        return undefined;
      }

      return {
        path: match.path,
        requiresAuth: match.requiresPermission !== undefined ? true : undefined,
        requiresPermission: match.requiresPermission,
        requiresAdmin: match.requiresAdmin,
        platform: match.platform,
        denyStrategy: match.denyStrategy,
      };
    } catch {
      return undefined;
    }
  }
}

export type { RouteOverrides } from './policy-engine';

