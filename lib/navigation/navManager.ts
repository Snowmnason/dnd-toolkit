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

import { AUTH_CONFIG } from '@/config/routing-auth-config';
import { logger } from '@/lib/utils';
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
  return {
    path: config.path,
    // Forward platform constraint so isPlatformCompatible() can enforce it.
    // Other RouteMetadata fields (requiresAuth, contextParamNames, etc.) still require
    // future RouteConfig additions before they can be forwarded.
    ...(config.platform !== undefined && { platform: config.platform }),
  };
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
  action: 'push' | 'replace' | 'dismissTo' | 'reset' = 'push'
): Promise<NavServiceResult> {
  try {
    const ctx = buildNavigationContext();
    const semanticPlatform: 'mobile' | 'desktop' =
      ctx.platform === 'ios' || ctx.platform === 'android' ? 'mobile' : 'desktop';

    // Resolve semantic routes BEFORE canonicalizePath — semantic IDs are not paths and must
    // not be prefixed with '/'. Check the raw target, then canonicalize the resolved path.
    let canonicalTarget: string;
    if (isSemanticRoute(target)) {
      const resolved = await resolveSemanticRoute(target as any, semanticPlatform);
      canonicalTarget = canonicalizePath(resolved);
    } else {
      canonicalTarget = canonicalizePath(target);
    }

    // Resolve deferred params from approved lib sources (auth state, storage)
    // These are used ONLY for guard evaluation (NavigationContext), NOT as URL params.
    // userId/worldId live in SecureStorage and must never leak into URLs.
    const contextParams = await resolveContextParams(PARAM_RESOLVERS);

    // Resolve route metadata — enables platform check and contextParamNames extraction
    const routeMetadata = getRouteMetadataForPath(canonicalTarget);

    // Early reject: platform incompatibility
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
    // Only caller-provided params become URL params — context params stay internal.
    const processed = applyRouteMetadata(navCtx, params ?? {}, routeMetadata);
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

    return await callRouteTransitionNav(action, canonicalTarget, resolvedParams, guardPipeline, analytics, navCtx);
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
  action: 'push' | 'replace' | 'dismissTo' | 'reset' = 'replace'
): Promise<NavServiceResult> {
  try {
    // TODO: Validate redirect reason (ensure it's from approved source)
    const ctx = buildNavigationContext();
    const semanticPlatform: 'mobile' | 'desktop' =
      ctx.platform === 'ios' || ctx.platform === 'android' ? 'mobile' : 'desktop';

    // Resolve semantic routes BEFORE canonicalizePath — semantic IDs are not paths and must
    // not be prefixed with '/'. Check the raw target, then canonicalize the resolved path.
    let canonicalTarget: string;
    if (isSemanticRoute(target)) {
      const resolved = await resolveSemanticRoute(target as any, semanticPlatform);
      canonicalTarget = canonicalizePath(resolved);
    } else {
      canonicalTarget = canonicalizePath(target);
    }

    // Resolve deferred params from approved lib sources (auth state, storage)
    // These are used ONLY for guard evaluation (NavigationContext), NOT as URL params.
    // userId/worldId live in SecureStorage and must never leak into URLs.
    const contextParams = await resolveContextParams(PARAM_RESOLVERS);

    // Resolve route metadata — enables platform check and contextParamNames extraction
    const routeMetadata = getRouteMetadataForPath(canonicalTarget);

    // Early reject: platform incompatibility
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
    // Only caller-provided params become URL params — context params stay internal.
    const processed = applyRouteMetadata(navCtx, params ?? {}, routeMetadata);
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

    return await callRouteTransitionNav(action, canonicalTarget, resolvedParams, guardPipeline, analytics, navCtx);
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

    // Route requires auth/permission/admin — run the real guard pipeline
    // with current user state to determine if the user actually has access.
    const ctx = buildNavigationContext();
    const contextParams = await resolveContextParams(PARAM_RESOLVERS);

    // If transitioning FROM a public route (e.g. /login/sign-in → /select/world-selection)
    // and userId couldn't be resolved, this is a post-auth storage race: React auth state
    // becomes true before the userId is flushed to SecureStorage. The observer is a
    // fallback for deep links — it must not block trusted post-login transitions.
    // useAuthGuard in the destination layout enforces actual protection.
    const previousRoute = canonicalizePath(_previousRoute ?? '');
    const isFromPublicRoute = AUTH_CONFIG.publicRoutes.some((r: string) =>
      previousRoute.toLowerCase().includes(r.toLowerCase()),
    );
    if (!contextParams.userId && isFromPublicRoute) {
      logger.category('navigation').debug(
        'Observer: userId unresolved on post-public-route transition — deferring to useAuthGuard',
        { from: previousRoute, to: canonicalRoute },
      );
      return { status: 'no-op', reason: 'post-auth-race-deferred-to-guard' };
    }

    const navCtx: NavigationContext = {
      toRoute: canonicalRoute,
      triggeredBy: 'deep-link',
      platform: ctx.platform,
      fromRoute: ctx.fromRoute,
      userId: contextParams.userId,
      worldId: contextParams.worldId,
    };

    const guardPipeline = PolicyEngine.buildGuardPipeline(verdict, navCtx);

    // Execute guards to see if user is actually denied
    // Run each guard — if any rejects, redirect to its specified target
    for (const guard of guardPipeline) {
      const guardResult = await guard.check(navCtx);
      if (guardResult.status === 'redirect') {
        const reason = `observer-policy-violation: ${guard.name}-denied`;
        try {
          return await executeInternalRedirectNavigation(
            reason,
            guardResult.target,
            {},
            _options,
          );
        } catch (redirectError) {
          logger.category('navigation').error(
            'Failed to execute redirect during route validation',
            { target: guardResult.target, error: redirectError instanceof Error ? redirectError.message : String(redirectError) }
          );
          // Return aborted instead of letting redirect error propagate
          return {
            status: 'aborted',
            reason: 'redirect-execution-failed',
            error: redirectError instanceof Error ? redirectError : new Error(String(redirectError)),
          };
        }
      }
      if (guardResult.status === 'abort') {
        return {
          status: 'aborted',
          reason: `observer-guard-abort: ${guard.name} - ${guardResult.reason}`,
        };
      }
    }

    // All guards passed — user has access, route is allowed
    return { status: 'no-op', reason: 'route-allowed-by-guards' };
  } catch (error) {
    return {
      status: 'aborted',
      reason: 'error',
      error: error instanceof Error ? error : new Error(String(error)),
    };
  }
}