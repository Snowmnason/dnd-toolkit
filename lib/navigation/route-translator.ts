/**
 * Route Translator
 *
 * Applies route-specific metadata transformations and parameter merging.
 * Lives in lib/navigation because metadata resolution is app-level domain logic,
 * not middleware infrastructure. The manager uses this before delegating to middleware.
 *
 * Handles:
 * - Route metadata application (auth requirements, platforms, deny strategies)
 * - Parameter merging (URL params + navigation params + context)
 * - Platform compatibility validation
 */

import type { NavigationContext } from '@/type-definitions';

/**
 * Route metadata — extracted from navigation-config RouteConfig
 */
export interface RouteMetadata {
  path: string;
  requiresAuth?: boolean;
  requiresPermission?: boolean;
  requiresAdmin?: boolean;
  platform?: 'mobile' | 'desktop' | null;
  denyStrategy?: 'redirect' | 'modal' | 'abort';
  redirectTarget?: string;
}

/**
 * Processed context after metadata application
 */
export interface ProcessedContext extends NavigationContext {
  metadata?: RouteMetadata;
  mergedParams: Record<string, any>;
}

/**
 * Apply route metadata to navigation context
 *
 * @param context Navigation context
 * @param metadata Route metadata (from navigation-config)
 * @returns Processed context with metadata and merged params
 */
export function applyRouteMetadata(
  context: NavigationContext,
  metadata?: RouteMetadata,
): ProcessedContext {
  const mergedParams = {
    ...context.params,
    ...(metadata && { _requiresAuth: metadata.requiresAuth }),
    ...(metadata && { _platform: metadata.platform }),
    ...(context.userId && { userId: context.userId }),
    ...(context.worldId && { worldId: context.worldId }),
    ...(context.userRole && { userRole: context.userRole }),
    ...(context.subscriptionTier && { subscriptionTier: context.subscriptionTier }),
  };

  return {
    ...context,
    metadata,
    mergedParams,
  };
}

/**
 * Validate platform compatibility
 *
 * Checks if current platform is allowed by route metadata.
 * Used as pre-guard check before running guards (early reject).
 *
 * @param context Navigation context with platform info
 * @param metadata Route metadata
 * @returns true if platform is compatible, false otherwise
 */
export function isPlatformCompatible(
  context: NavigationContext,
  metadata?: RouteMetadata,
): boolean {
  // No platform constraint or null = allow all platforms
  if (!metadata || !metadata.platform) {
    return true;
  }

  // App platform unknown = assume compatible
  if (!context.platform) {
    return true;
  }

  return context.platform === metadata.platform;
}

/**
 * Merge URL parameters with navigation parameters
 *
 * @param urlParams Parameters from URL / Expo Router params
 * @param navigationParams Parameters passed to navigate.push()
 * @returns Merged parameter object (navigation params take precedence)
 */
export function mergeParameters(
  urlParams: Record<string, any> = {},
  navigationParams: Record<string, any> = {},
): Record<string, any> {
  return {
    ...urlParams,
    ...navigationParams,
  };
}
