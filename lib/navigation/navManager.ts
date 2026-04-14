/**
 * Navigation Manager
 *
 * Orchestration hub for all navigation operations. Responsible for translating high-level
 * navigation intents into concrete routing decisions, then delegating execution to middleware.
 *
 * **Responsibilities:**
 * - Normalize and validate navigation requests
 * - Resolve deferred parameters (worldId, etc.) from approved sources
 * - Retrieve route metadata from navigation-config
 * - Evaluate routing policy and construct guard pipelines
 * - Delegate to middleware layer (never calls system layer directly)
 * - Handle errors gracefully and wrap results for hook consumption
 *
 * **Five Navigation Families:**
 * 1. **Route Navigation** (`executeRouteNavigation`) — Navigate to a route with params
 * 2. **Internal Redirects** (`executeInternalRedirectNavigation`) — Redirect from auth/jobs
 * 3. **History Operations** (`executeHistoryNavigation`) — back, dismiss, dismissAll, dismissTo
 * 4. **External Links** (`executeExternalNavigation`) — Open URLs with trust checking
 * 5. **Observed Changes** (`evaluateObservedRouteChange`) — Post-hoc policy re-evaluation
 *
 * **Layer Pattern:**
 * Hook → Manager (validation, policy) → Middleware (normalization, analytics) → System (execution)
 *
 * **Important:**
 * - Manager delegates to middleware exactly once per call
 * - Never constructs NavigationRequest or NavigationContext directly (use middleware types)
 * - All error handling is internal; always returns NavServiceResult status
 * - Policy evaluation will use lib/navigation auxiliary files (policy-engine, guard-builders)
 */

import {
  callExternalTransitionNav,
  callHistoryTransitionNav,
  callRouteTransitionNav,
  callStateQueriesNav,
  callUtilityTransitionNav,
  type NavAnalyticsContext,
  type NavServiceResult,
} from '@/middleware/navigation';
import type {
  NavManagerOptions,
  NavigationContext,
  Platform,
} from '@/type-definitions/transport-types';
import { Platform as RNPlatform } from 'react-native';
import { getAllRouteConfigs } from './navigationConfig';
import { PARAM_RESOLVERS, resolveContextParams } from './param-resolvers';
import { PolicyEngine, getPolicyModeFromConfig } from './policyEngine';
import { canonicalizePath } from './routeCanonicalizer';
import {
  applyRouteMetadata,
  isPlatformCompatible,
  mergeParameters,
  type RouteMetadata,
} from './routeTranslator';
import { isSemanticRoute, resolveSemanticRoute } from './semantic-routes';
import { isTrustedOrigin, storeTrustedOrigin } from './trusted-urls';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Shared context fields resolved once at the start of each navigation call. */
type SharedNavContext = {
  platform: Platform;
  fromRoute: string | undefined;
};

/** Resolve current platform and route in one sync call. */
function buildNavigationContext(): SharedNavContext {
  const rawRoute = callStateQueriesNav('getCurrentRoute') as string | undefined;
  const fromRoute = rawRoute && rawRoute.length > 0 ? rawRoute : undefined;
  const os = RNPlatform.OS;
  const platform: Platform =
    os === 'ios' || os === 'android' ? os : os === 'macos' || os === 'windows' ? 'desktop' : 'web';
  return { platform, fromRoute };
}

/**
 * Look up RouteMetadata for a canonical path from the navigation config.
 *
 * This is intentionally a lightweight path lookup. RouteConfig does not yet expose
 * auth/platform/contextParamNames fields, so only `path` is populated.
 * The platform check and contextParamNames extraction in the pipeline are dormant
 * until those fields are added to RouteConfig in a future pass.
 *
 * @see routeTranslator.ts for the full RouteMetadata type and future field definitions
 */
function getRouteMetadataForPath(canonicalPath: string): RouteMetadata | undefined {
  const configs = getAllRouteConfigs();
  const config = configs.find(
    c => c.path === canonicalPath || c.aliases?.some(a => a === canonicalPath),
  );
  if (!config) return undefined;
  // Only path is available from RouteConfig today. All other RouteMetadata fields
  // (requiresAuth, platform, contextParamNames, etc.) require future RouteConfig additions.
  return { path: config.path };
}

/**
 * Execute route navigation to a destination.
 *
 * **Use this when:** You want to navigate to a named route, optionally with deferred parameters
 * (e.g., worldId) resolved from app state.
 *
 * @param target - Destination route path (e.g., "/login", "main/world-settings").
 *                 Will be normalized (lowercase, trailing slashes trimmed).
 * @param params - Optional URL parameters as key-value pairs.
 * @param options - Optional flags (skipGuards, skipValidation, trusted).
 * @returns NavServiceResult (executed, redirected, aborted, ui-required, no-op)
 *
 * @example
 * // Simple navigation
 * await executeRouteNavigation('/login');
 *
 * // With params
 * await executeRouteNavigation('/main/world-settings', { worldId: '123' });
 *
 * @note Pipeline: normalize → resolve-params → metadata → policy → delegate
 * @see executeInternalRedirectNavigation for system-initiated redirects
 */
export async function executeRouteNavigation(
  target: string,
  params?: Record<string, string>,
  options?: NavManagerOptions,
  action: 'push' | 'replace' | 'dismissTo' = 'push'
): Promise<NavServiceResult> {
  try {
    const ctx = buildNavigationContext();
    let canonicalTarget = canonicalizePath(target);

    // Resolve semantic routes to concrete paths (e.g., 'default' → '/' or '/select/world-selection')
    if (isSemanticRoute(canonicalTarget)) {
      canonicalTarget = await resolveSemanticRoute(canonicalTarget as any);
    }

    // Resolve deferred params from approved lib sources (auth state, storage)
    const contextParams = await resolveContextParams(PARAM_RESOLVERS);
    // Storage-resolved values are base; explicit params passed by caller win
    const preResolvedParams = mergeParameters(contextParams, params ?? {});

    // Resolve route metadata — enables platform check and contextParamNames extraction
    const routeMetadata = getRouteMetadataForPath(canonicalTarget);

    // Early reject: platform incompatibility (no-op until routes declare platform constraints)
    if (!isPlatformCompatible(ctx.platform, routeMetadata)) {
      return { status: 'aborted', reason: 'platform-incompatible' };
    }

    // Enrich context with resolved userId/worldId for guard evaluation
    const navCtx: NavigationContext = {
      toRoute: canonicalTarget,
      triggeredBy: 'user',
      platform: ctx.platform,
      fromRoute: ctx.fromRoute,
      userId: contextParams.userId,
      worldId: contextParams.worldId,
    };

    // Apply metadata: contextParamNames extraction (dormant until routes declare them)
    // + final merge with preResolvedParams — result is the URL params for the route
    const processed = applyRouteMetadata(navCtx, preResolvedParams, routeMetadata);
    const resolvedParams = processed.mergedParams;

    const policyMode = getPolicyModeFromConfig();
    const verdict = PolicyEngine.getPolicyForRoute(canonicalTarget, policyMode);
    const guardPipeline = options?.skipGuards
      ? []
      : PolicyEngine.buildGuardPipeline(verdict, navCtx);

    const analytics: NavAnalyticsContext = {
      source: 'user',
      fromRoute: ctx.fromRoute,
      platform: ctx.platform,
    };

    return await callRouteTransitionNav(action, canonicalTarget, resolvedParams, guardPipeline, analytics);
  } catch (error) {
    return {
      status: 'aborted',
      reason: 'error',
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Execute an internal redirect from auth or job systems.
 *
 * **Use this when:** Auth/jobs need to force a navigation (session expired, 2FA needed, etc.).
 * Uses 'replace' action to replace current route (user can't navigate back to it).
 *
 * @param redirectReason - Why this redirect was triggered (e.g., 'session-expired', 'needs-2fa').
 *                        Used for logging and analytics.
 * @param target - Destination route path.
 * @param params - Optional URL parameters.
 * @param options - Optional flags.
 * @returns NavServiceResult (executed, redirected, aborted, etc.)
 *
 * @example
 * // Session expired
 * await executeInternalRedirectNavigation('session-expired', '/login');
 *
 * @note Uses 'replace' instead of 'push'; source marked as 'redirect' for analytics.
 * @see executeRouteNavigation for comparison
 */
export async function executeInternalRedirectNavigation(
  redirectReason: string,
  target: string,
  params?: Record<string, string>,
  options?: NavManagerOptions,
  action: 'push' | 'replace' | 'dismissTo' = 'replace'
): Promise<NavServiceResult> {
  try {
    // TODO: Validate redirect reason (ensure it's from approved source)
    const ctx = buildNavigationContext();
    let canonicalTarget = canonicalizePath(target);

    // Resolve semantic routes to concrete paths (e.g., 'default' → '/' or '/select/world-selection')
    if (isSemanticRoute(canonicalTarget)) {
      canonicalTarget = await resolveSemanticRoute(canonicalTarget as any);
    }

    // Resolve deferred params from approved lib sources (auth state, storage)
    const contextParams = await resolveContextParams(PARAM_RESOLVERS);
    // Storage-resolved values are base; explicit params passed by caller win
    const preResolvedParams = mergeParameters(contextParams, params ?? {});

    // Resolve route metadata — enables platform check and contextParamNames extraction
    const routeMetadata = getRouteMetadataForPath(canonicalTarget);

    // Early reject: platform incompatibility (no-op until routes declare platform constraints)
    if (!isPlatformCompatible(ctx.platform, routeMetadata)) {
      return { status: 'aborted', reason: 'platform-incompatible' };
    }

    // Enrich context with resolved userId/worldId for guard evaluation
    const navCtx: NavigationContext = {
      toRoute: canonicalTarget,
      triggeredBy: 'redirect',
      platform: ctx.platform,
      fromRoute: ctx.fromRoute,
      userId: contextParams.userId,
      worldId: contextParams.worldId,
    };

    // Apply metadata: contextParamNames extraction (dormant until routes declare them)
    // + final merge with preResolvedParams — result is the URL params for the route
    const processed = applyRouteMetadata(navCtx, preResolvedParams, routeMetadata);
    const resolvedParams = processed.mergedParams;

    const policyMode = getPolicyModeFromConfig();
    const verdict = PolicyEngine.getPolicyForRoute(canonicalTarget, policyMode);
    const guardPipeline = options?.skipGuards
      ? []
      : PolicyEngine.buildGuardPipeline(verdict, navCtx);

    const analytics: NavAnalyticsContext = {
      source: 'redirect',
      fromRoute: ctx.fromRoute,
      platform: ctx.platform,
    };

    return await callRouteTransitionNav(action, canonicalTarget, resolvedParams, guardPipeline, analytics);
  } catch (error) {
    return {
      status: 'aborted',
      reason: 'error',
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Execute history/stack navigation (back, dismiss, dismissAll, dismissTo).
 *
 * **Use this when:** You need back button, close modal, or stack manipulation.
 * These skip the full policy pipeline (lighter execution).
 *
 * @param action - 'back' | 'dismiss' | 'dismissAll' | 'dismissTo'
 * @param target - Required only for 'dismissTo'; ignored for others.
 * @param options - Optional flags (rarely used).
 * @returns NavServiceResult
 *
 * @example
 * await executeHistoryNavigation('back');
 * await executeHistoryNavigation('dismiss');
 * await executeHistoryNavigation('dismissAll');
 * await executeHistoryNavigation('dismissTo', 'main/world-select');
 *
 * @note No guard pipeline execution for backward navigation.
 */
export async function executeHistoryNavigation(
  action: 'back' | 'dismiss' | 'dismissAll' | 'dismissTo',
  target?: string,
  options?: NavManagerOptions
): Promise<NavServiceResult> {
  try {
    if (action === 'dismissTo' && !target) {
      return { status: 'aborted', reason: 'dismissTo requires a target route' };
    }
    const canonicalTarget = target !== undefined ? canonicalizePath(target) : undefined;

    return await callHistoryTransitionNav(action, canonicalTarget);
  } catch (error) {
    return {
      status: 'aborted',
      reason: 'error',
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/*
 * **Example:**
 * ```typescript
 * // User clicks untrusted link: https://external-site.com/page
 * const result = await executeExternalNavigation('https://external-site.com/page');
 * // Returns: { status: 'ui-required', instruction: {...} }
 * // Hook shows modal with three buttons: "Don't open", "Open anyway", "Trust and open"
 *
 * // User selects "Open anyway" (temporary):
 * const result = await executeExternalNavigation('https://external-site.com/page', { 
 *   trusted: false, 
 *   skipTrustCheck: true 
 * });
 * // Navigates but doesn't store trust
 *
 * // User selects "Trust and open" (store for future):
 * const result = await executeExternalNavigation('https://external-site.com/page', { 
 *   trusted: true, 
 *   storeTrust: true 
 * });
 * // Navigates AND stores URL origin so future clicks open immediately
 * ```
 **/
/**
 * Execute navigation to an external URL with optional trust verification.
 *
 * **Use this when:** You need to open a web link, email, phone number, or other external resource.
 * Includes built-in trust model to prevent accidental clicks on suspicious URLs.
 *
 * **Trust Model:**
 * - If URL origin is NOT trusted:
 *   - Returns `ui-required` status → Hook shows 3-button consent modal
 *   - User chooses from three options:
 *     - **"Don't open"** (default) — Dismiss modal; no navigation, no storage
 *     - **"Open anyway"** — Navigate immediately; don't store trust for future
 *     - **"Trust and open"** — Navigate AND store URL origin as trusted
 * - If URL origin IS trusted (or `options.trusted = true`):
 *   - Opens the URL via middleware
 *
 * @param url - Full URL to open (should be http:// or https://).
 *              Non-http(s) URLs are rejected during validation .
 * @param options - Optional flags:
 *                  - `trusted`: true = skip trust check and open immediately
 *                  - `storeTrust`: true = store URL origin as trusted for future opens
 *                  - `skipValidation`: true = skip URL format validation
 *                  - `skipTrustCheck`: true = open immediately without storing (one-time action)
 * @returns NavServiceResult:
 *         - `ui-required` if URL not trusted (user consent needed, with three options)
 *         - `executed` if URL opened successfully
 *         - `aborted` if URL format invalid or other error
 * @throws Never throws; errors return aborted status.
 *
 * @see executeRouteNavigation for in-app routing
 * @note TODO (Phase 4c): Implement trust storage via `lib/navigation/trusted-urls.ts`.
 *       Currently, trust checking is a no-op; hook layer will manage three-option modal logic.
 */
export async function executeExternalNavigation(
  url: string,
  options?: NavManagerOptions
): Promise<NavServiceResult> {
  try {
    // Validate URL format — must be http or https
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return { status: 'aborted', reason: 'invalid URL format' };
    }
    if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') {
      return { status: 'aborted', reason: 'only http/https URLs are supported' };
    }

    const hostname = parsedUrl.hostname;

    // "Open anyway" — one-time bypass, no trust stored
    if (options?.skipTrustCheck) {
      return await callExternalTransitionNav(url, { trusted: false });
    }

    // "Trust and open" — store origin then open
    if (options?.storeTrust) {
      await storeTrustedOrigin(url);
      return await callExternalTransitionNav(url, { trusted: true });
    }

    // Explicit trusted flag (e.g., internal deep-link handler)
    if (options?.trusted) {
      return await callExternalTransitionNav(url, { trusted: true });
    }

    // Check persisted trust list
    const trusted = await isTrustedOrigin(url);
    if (trusted) {
      return await callExternalTransitionNav(url, { trusted: true });
    }

    // Not trusted — ask user via three-option consent modal
    return {
      status: 'ui-required',
      instruction: {
        type: 'trusted-url-consent',
        url,
        hostname,
        message: `Open external link from ${hostname}?`,
        modalType: 'trusted-url-consent',
      },
    };
  } catch (error) {
    return {
      status: 'aborted',
      reason: 'error',
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Execute a utility navigation operation (setParams, prefetch).
 *
 * **Use this when:**
 * - `setParams` — Update query parameters on the current route without navigating.
 * - `prefetch` — Load a route bundle in the background before the user navigates to it.
 *
 * These skip the guard pipeline entirely; they are lightweight utility ops, not navigation decisions.
 *
 * @param action - `'setParams'` or `'prefetch'`
 * @param params - For `setParams`: key-value pairs to set. For `prefetch`: `{ target: 'route/path' }`.
 * @returns NavServiceResult (executed, no-op, aborted, transport-unavailable)
 *
 * @example
 * // Update URL params on the current screen
 * await executeUtilityNavigation('setParams', { worldId: '456' });
 *
 * // Warm up a route bundle before navigating
 * await executeUtilityNavigation('prefetch', { target: '/main/characters' });
 */
export async function executeUtilityNavigation(
  action: 'setParams' | 'prefetch',
  params?: Record<string, any>,
): Promise<NavServiceResult> {
  try {
    return await callUtilityTransitionNav(action, params);
  } catch (error) {
    return {
      status: 'aborted',
      reason: 'error',
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}

/**
 * Execute a synchronous state query on the navigation transport.
 *
 * **Use this when:** You need to read navigation state (e.g., whether back is available)
 * without performing any navigation action. Passes directly through to middleware, which
 * delegates to the transport adapter.
 *
 * @param query - The state query to execute.
 * @returns The synchronous result from the transport layer, or `undefined` if transport is not ready.
 *
 * @example
 * // Check if a back-navigation is available before rendering a back button
 * const canGoBack = executeStateQueryNavigation('canGoBack'); // boolean | undefined
 */
export function executeStateQueryNavigation(
  query: 'getCurrentRoute' | 'getCurrentParams' | 'canGoBack' | 'canDismiss',
): any {
  return callStateQueriesNav(query);
}

/**
 * Re-evaluate routing policy for an observed route change.
 *
 * **Use this when:** Observer detects that current route changed (via Expo Router segments),
 * and you need to validate whether the new route is allowed given current execution context.
 *
 * **When is this called?**
 * - User uses browser back button → lands on unauthorized route
 * - Deep link from notification → lands on protected route
 * - Tab switch (web) → route may have become invalid
 *
 * **Pipeline:**
 * - Re-run policy checks for currentRoute
 * - If allowed: return no-op (route is fine)
 * - If denied: automatically redirect to safe target
 *
 * **Example:**
 * ```typescript
 * // Observer detected route changed from '/main' to '/admin'
 * // Check if user still has admin access
 * const result = await evaluateObservedRouteChange('/admin', '/main');
 * // If user lost admin access:
 * //   Returns: { status: 'redirected', toRoute: '/main' }
 * // If user still has access:
 * //   Returns: { status: 'no-op', reason: '...' }
 * ```
 *
 * @param currentRoute - Route path that observer detected (e.g., '/admin').
 * @param _previousRoute - Route path before the change (rarely used; marked unused).
 * @param _context - Additional execution context (rarely used).
 * @param _options - Optional behavior flags (rarely used).
 * @returns NavServiceResult with status (no-op if allowed, redirected if correction needed, aborted if error).
 * @throws Never throws; errors return aborted status.
 *
 * @note This is called by hooks/navigation/use-route-change-observer.ts when segments change.
 * @note Implement full policy re-evaluation and redirect determination.
 *
 * @see executeRouteNavigation for initial navigation
 */
export async function evaluateObservedRouteChange(
  currentRoute: string,
  _previousRoute: string,
  _context?: Record<string, any>,
  _options?: NavManagerOptions
): Promise<NavServiceResult> {
  try {
    const canonicalRoute = canonicalizePath(currentRoute);
    const policyMode = getPolicyModeFromConfig();

    // Re-evaluate policy for the current route
    const verdict = PolicyEngine.getPolicyForRoute(canonicalRoute, policyMode);

    // If route is publicly accessible, it's always allowed
    if (verdict === 'allow_all') {
      return { status: 'no-op', reason: 'route-allowed' };
    }

    // Route requires authentication, permission, admin, or custom logic.
    // For safety, redirect to main if user lands on protected route via back button or deep link.
    // More sophisticated access checking (e.g., verifying current user state) should be added
    // when AUTH_CONFIG gains per-route access level definitions.
    const reason = `observer-policy-violation: route-requires-${verdict}`;
    return await executeInternalRedirectNavigation(
      reason,
      '/main',
      {},
      _options,
    );
  } catch (error) {
    return {
      status: 'aborted',
      reason: 'error',
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}