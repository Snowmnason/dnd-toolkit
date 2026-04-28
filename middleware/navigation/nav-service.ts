/**
 * Nav-Service Middleware
 *
 * Bridge between lib/navigation (manager) and system/Navigation (execution layer).
 *
 * Five explicit pass-through wrappers, each corresponding to one system/Navigation family:
 *   callRouteTransitionNav    — push / replace / dismissTo (with optional guard pipeline)
 *   callHistoryTransitionNav  — back / dismiss / dismissAll / dismissTo (no guards)
 *   callUtilityTransitionNav  — setParams / prefetch (simple ops, no analytics)
 *   callExternalTransitionNav — open full URL (no normalization)
 *   callStateQueriesNav       — read-only state (sync, no analytics)
 *
 * Each wrapper:
 *   1. Validates transport readiness (isTransportReady)
 *   2. Normalizes route input (strips leading "/")
 *   3. Calls the corresponding system function directly (no generic orchestrator)
 *   4. Fires analytics from the result (fire-and-forget, never blocks)
 *   5. Strips transaction metadata before returning to lib
 */

import { NavAnalytics } from '@/lib/analytics/modules/nav-analytics';
import { logger } from '@/lib/utils';
import {
  executeExternalTransitionNav,
  executeHistoryTransitionNav,
  executeRouteTransitionNav,
  executeStateQueriesNav,
  executeUtilityTransitionNav,
  isTransportReady,
} from '@/system/Navigation';
import type {
  NavigationContext,
  NavigationExecutionResult,
  NavigationGuardConfig,
  NavigationRequest,
  NavigationUiInstruction,
} from '@/type-definitions';

// ---------------------------------------------------------------------------
// Result type returned to lib — transaction metadata stripped
// ---------------------------------------------------------------------------

export type NavServiceResult =
  | { status: 'executed'; toRoute: string }
  | { status: 'redirected'; toRoute: string; reason: string }
  | { status: 'aborted'; reason: string; error?: Error }
  | { status: 'ui-required'; instruction: NavigationUiInstruction }
  | { status: 'no-op'; reason: string }
  | { status: 'transport-unavailable'; reason: string };

// ---------------------------------------------------------------------------
// Analytics context provided by lib (optional enrichment for tracking)
// ---------------------------------------------------------------------------

export type NavAnalyticsContext = {
  fromRoute?: string;
  userId?: string;
  worldId?: string;
  platform?: string;
  /** Navigation trigger as understood by lib. Maps to analytics source field. */
  source?: 'user' | 'redirect' | 'deep-link';
  paramCount?: number;
};

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Strip leading and trailing slashes from a route segment. */
function normalizeRoute(route: string): string {
  return route.replace(/^\/+|\/+$/g, '');
}

/**
 * Fire navigation analytics from an execution result.
 * Never throws — errors are logged at warn level and swallowed.
 */
function fireAnalytics(
  result: NavigationExecutionResult,
  target: string,
  analytics?: NavAnalyticsContext,
): void {
  try {
    NavAnalytics.trackNavigationResult({
      result,
      target,
      fromRoute: analytics?.fromRoute,
      userId: analytics?.userId,
      worldId: analytics?.worldId,
      platform: analytics?.platform,
      source: analytics?.source ?? 'user',
      paramCount: analytics?.paramCount ?? 0,
    });
  } catch (err) {
    logger
      .category('navigation')
      .warn(`NavService analytics failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

/** Strip transaction metadata — lib only needs outcome fields, not timing/guard internals. */
function stripResult(result: NavigationExecutionResult): NavServiceResult {
  switch (result.status) {
    case 'executed':
      return { status: 'executed', toRoute: result.toRoute };
    case 'redirected':
      return { status: 'redirected', toRoute: result.toRoute, reason: result.reason };
    case 'aborted':
      return { status: 'aborted', reason: result.reason, error: result.error };
    case 'ui-required':
      return { status: 'ui-required', instruction: result.instruction };
    case 'no-op':
      return { status: 'no-op', reason: result.reason };
  }
}

// ---------------------------------------------------------------------------
// Navigation middleware exports — five explicit pass-through functions
// ---------------------------------------------------------------------------

/**
 * Route Transition — push / replace / dismissTo
 *
 * Normalizes target (strips leading "/"). Assembles NavigationRequest for the
 * system layer. Runs guard pipeline if guards are provided.
 *
 * @param action  Router action to perform
 * @param target  Destination route (canonical path, e.g. "main/world-settings")
 * @param params  Optional URL params merged into the request
 * @param guards  Guard pipeline built by the manager/policy engine
 * @param analytics  Optional context for analytics enrichment
 */
export async function callRouteTransitionNav(
  action: 'push' | 'replace' | 'reset' | 'dismissTo',
  target: string,
  params?: Record<string, string>,
  guards?: NavigationGuardConfig[],
  analytics?: NavAnalyticsContext,
  navCtx?: NavigationContext,
): Promise<NavServiceResult> {
  if (!isTransportReady()) {
    logger.category('navigation').warn('callRouteTransitionNav: transport not ready');
    return { status: 'transport-unavailable', reason: 'Transport not initialized' };
  }

  const cleanTarget = normalizeRoute(target);

  const request: NavigationRequest = {
    family: 'route',
    action,
    target: cleanTarget,
    params,
    source:
      analytics?.source === 'deep-link'
        ? 'deeplink'
        : analytics?.source === 'redirect'
          ? 'redirect'
          : 'direct',
    requiresGuardPipeline: (guards?.length ?? 0) > 0,
    analyticsMode: 'track',
  };

  const result = await executeRouteTransitionNav(request, guards, navCtx);
  fireAnalytics(result, cleanTarget, analytics);
  return stripResult(result);
}

/**
 * History Transition — back / dismiss / dismissAll / dismissTo
 *
 * No guard pipeline. dismissTo normalizes the target (strips leading "/").
 * Source is always treated as 'user' since these are backward navigations.
 *
 * @param action  History action to perform
 * @param target  Required only for dismissTo
 * @param analytics  Optional context for analytics enrichment
 */
export async function callHistoryTransitionNav(
  action: 'back' | 'dismiss' | 'dismissAll' | 'dismissTo',
  target?: string,
  analytics?: NavAnalyticsContext,
): Promise<NavServiceResult> {
  if (!isTransportReady()) {
    logger.category('navigation').warn('callHistoryTransitionNav: transport not ready');
    return { status: 'transport-unavailable', reason: 'Transport not initialized' };
  }

  const cleanTarget = target ? normalizeRoute(target) : undefined;
  const result = await executeHistoryTransitionNav(action, cleanTarget);
  fireAnalytics(result, cleanTarget ?? action, { ...analytics, source: 'user' });
  return stripResult(result);
}

/**
 * Utility Transition — setParams / prefetch
 *
 * For setParams: pass `{ key: value }` pairs directly.
 * For prefetch: pass `{ target: 'route' }` — target is normalized (strips leading "/").
 * No analytics — utility ops are not navigation decision events.
 *
 * @param action  Utility action to perform
 * @param params  Action-specific parameters
 */
export async function callUtilityTransitionNav(
  action: 'setParams' | 'prefetch',
  params?: Record<string, any>,
): Promise<NavServiceResult> {
  if (!isTransportReady()) {
    logger.category('navigation').warn('callUtilityTransitionNav: transport not ready');
    return { status: 'transport-unavailable', reason: 'Transport not initialized' };
  }

  const normalizedParams =
    action === 'prefetch' && params?.target
      ? { ...params, target: normalizeRoute(params.target) }
      : params;

  const result = await executeUtilityTransitionNav(action, normalizedParams);
  return stripResult(result);
}

/**
 * External Transition — open a full URL in the browser / system handler
 *
 * URL is NOT normalized — external URLs must be passed as-is.
 *
 * @param url      Full URL to open (https://...)
 * @param options  Optional flags (trusted: skip security prompt)
 * @param analytics  Optional context for analytics enrichment
 */
export async function callExternalTransitionNav(
  url: string,
  options?: { trusted?: boolean },
  analytics?: NavAnalyticsContext,
): Promise<NavServiceResult> {
  if (!isTransportReady()) {
    logger
      .category('navigation')
      .warn('callExternalTransitionNav: transport not ready');
    return { status: 'transport-unavailable', reason: 'Transport not initialized' };
  }

  const result = await executeExternalTransitionNav(url, options);
  fireAnalytics(result, url, analytics);
  return stripResult(result);
}

/**
 * State Queries — synchronous read-only operations
 *
 * No guard pipeline. No analytics (read-only, no decision made).
 * Returns undefined if transport is not yet ready.
 *
 * @param action  Query to perform
 */
export function callStateQueriesNav(
  action: 'getCurrentRoute' | 'getCurrentParams' | 'canGoBack' | 'canDismiss',
): any {
  if (!isTransportReady()) {
    logger.category('navigation').warn('callStateQueriesNav: transport not ready');
    return undefined;
  }

  return executeStateQueriesNav(action);
}