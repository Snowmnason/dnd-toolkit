/**
 * Route Translator
 *
 * Applies route-specific metadata transformations and parameter merging.
 * Lives in lib/navigation because metadata resolution is app-level domain logic,
 * not middleware infrastructure. The manager uses this before delegating to middleware.
 *
 * Handles:
 * - Route metadata application (auth requirements, platforms, deny strategies)
 * - Parameter merging (context-derived params + explicit navigation params)
 * - Platform compatibility validation
 *
 * @note Parameters passed explicitly to navigate() always win over context-derived params.
 * @note Metadata fields (requiresAuth, platform, etc.) are for policy evaluation only —
 *       they are never merged into URL params passed to the router.
 */

import type { NavigationContext, Platform } from '@/type-definitions';

/**
 * Route metadata — extracted from navigation-config RouteConfig for policy evaluation.
 * Contains only the fields the manager needs for guard/policy decisions.
 *
 * @note Only `path` is populated today. All other fields below are reserved for future
 * activation once RouteConfig exposes them. Do not read these fields expecting real values
 * until they are wired up in both RouteConfig and getRouteMetadataForPath().
 */
export interface RouteMetadata {
  path: string;
  /** @future Not yet populated — requires RouteConfig additions */
  requiresAuth?: boolean;
  /** @future Not yet populated — requires RouteConfig additions */
  requiresPermission?: boolean;
  /** @future Not yet populated — requires RouteConfig additions */
  requiresAdmin?: boolean;
  /** @future Not yet populated — Platform constraint: 'mobile' (ios/android), 'desktop' (web/desktop), or null (all) */
  platform?: 'mobile' | 'desktop' | null;
  /** @future Not yet populated — requires RouteConfig additions */
  denyStrategy?: 'redirect' | 'modal' | 'abort';
  /** @future Not yet populated — requires RouteConfig additions */
  redirectTarget?: string;
  /**
   * @future Not yet populated — requires RouteConfig additions.
   * Declare which context fields should be extracted as URL params.
   * For example, for world selection: ['worldId', 'role', 'owner']
   */
  contextParamNames?: string[];
}

/**
 * Processed context after metadata application.
 * Extends NavigationContext with resolved metadata and merged route params.
 */
export interface ProcessedContext extends NavigationContext {
  metadata?: RouteMetadata;
  /** Final merged params: context-derived fields overridden by explicit navigation params */
  mergedParams: Record<string, string>;
}

/**
 * Safely extract a validated param from context.
 * Used by applyRouteMetadata to dynamically extract context fields as URL params.
 *
 * SECURITY: The paramName is validated regex-tested to contain only [a-zA-Z0-9_-]
 * before extraction, preventing injection attacks. The source (navigation-config) is
 * trusted and never user-controlled.
 *
 * @returns Tuple of [paramName, value] if found, null otherwise
 * @internal
 */
function extractContextParam(
  context: unknown,
  paramName: string,
): [string, string] | null {
  if (!/^[a-zA-Z0-9_-]+$/.test(paramName)) {
    return null;
  }

  try {
    const contextRecord = context as unknown as Record<string, unknown>;
    // Safe: paramName is validated. Using direct property access.
    const descriptor = Object.getOwnPropertyDescriptor(contextRecord, paramName);
    const value = descriptor?.value;

    if (value === undefined || value === null) {
      return null;
    }
    return [paramName, String(value)];
  } catch {
    return null;
  }
}

/**
 * Apply route metadata to navigation context.
 *
 * Extracts context fields as URL params based on the route's declaration.
 * The route metadata defines which context fields become URL params via `contextParamNames`.
 * This keeps the extraction logic generic and configurable per-route.
 *
 * @note Metadata fields (requiresAuth, platform, etc.) stay on `metadata` —
 *       they are NOT merged into `mergedParams`. That object is for URL params only.
 *
 * @param context Navigation context (from transport-types)
 * @param params Explicit navigation params passed by the hook
 * @param metadata Route metadata resolved from navigation-config, including contextParamNames declaration
 * @returns ProcessedContext with metadata attached and params merged
 *
 * @example
 * // Route declares: contextParamNames: ['worldId', 'role', 'owner']
 * applyRouteMetadata(
 *   { worldId: 'uuid-123', role: 'owner', platform: 'web', ... },
 *   { extra: 'param' },
 *   { path: '/world', contextParamNames: ['worldId', 'role', 'owner'] }
 * )
 * // Returns: { ..., mergedParams: { worldId: 'uuid-123', role: 'owner', extra: 'param' } }
 */
export function applyRouteMetadata(
  context: NavigationContext,
  params?: Record<string, string>,
  metadata?: RouteMetadata,
): ProcessedContext {
  // Extract only the context fields declared by the route.
  // contextParamNames comes from trusted navigation-config (not user input).
  const contextDerivedParams: Record<string, string> = {};

  if (metadata?.contextParamNames) {
    for (const paramName of metadata.contextParamNames) {
      const paramTuple = extractContextParam(context, paramName);
      if (paramTuple !== null) {
        const [key, value] = paramTuple;
        Object.assign(contextDerivedParams, { [key]: value });
      }
    }
  }

  const mergedParams = mergeParameters(contextDerivedParams, params ?? {});

  return {
    ...context,
    metadata,
    mergedParams,
  };
}

/**
 * Validate platform compatibility between a route constraint and the current platform.
 *
 * Route metadata uses broad categories ('mobile', 'desktop') while the runtime
 * Platform type uses specific values ('ios', 'android', 'web', 'desktop').
 * This function maps categories correctly:
 * - `'mobile'`  → compatible with 'ios' and 'android'
 * - `'desktop'` → compatible with 'desktop' and 'web'
 *
 * @param platform Current runtime platform
 * @param metadata Route metadata
 * @returns true if platform is compatible with the route constraint
 *
 * @example
 * isPlatformCompatible('ios', { platform: 'mobile' })   // true
 * isPlatformCompatible('web', { platform: 'mobile' })   // false
 * isPlatformCompatible('web', { platform: 'desktop' })  // true
 * isPlatformCompatible('ios', { platform: null })        // true (no constraint)
 */
export function isPlatformCompatible(
  platform: Platform,
  metadata?: RouteMetadata,
): boolean {
  if (!metadata || !metadata.platform) {
    return true;
  }

  if (metadata.platform === 'mobile') {
    return platform === 'ios' || platform === 'android';
  }

  if (metadata.platform === 'desktop') {
    return platform === 'desktop' || platform === 'web';
  }

  return true;
}

/**
 * Merge context-derived params with explicit navigation params.
 *
 * Explicit navigation params always win over context-derived ones.
 * Use this to combine background params (userId, worldId from context)
 * with params the hook explicitly passed to the manager.
 *
 * @param contextParams Params derived from app context (userId, worldId, etc.)
 * @param navigationParams Params explicitly passed to navigate (take precedence)
 * @returns Merged params with navigation params overriding context params
 *
 * @example
 * mergeParameters({ worldId: 'ctx-world' }, { worldId: 'explicit-world' })
 * // → { worldId: 'explicit-world' }  (explicit wins)
 */
export function mergeParameters(
  contextParams: Record<string, string> = {},
  navigationParams: Record<string, string> = {},
): Record<string, string> {
  return {
    ...contextParams,
    ...navigationParams,
  };
}
