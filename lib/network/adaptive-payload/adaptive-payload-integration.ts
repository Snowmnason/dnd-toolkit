/**
 * Integration Utilities for Adaptive Payload Sizing
 *
 * Helpers for integrating adaptive payloads into query hooks.
 * Use these patterns when creating or updating query hooks.
 */

import { NetworkDetection } from "@/system/Network/network-detection";
import {
  buildAdaptiveQueryParams,
  getAdaptivePayloadOptions,
  getCacheKeyQualityComponent,
} from "./adaptive-payload";

/**
 * Configuration for adaptive query integration
 */
export interface AdaptiveQueryConfig {
  /**
   * Base cache key (string or array)
   * String: 'worlds:list'
   * Array: ['worlds', 'list']
   * Will be appended with quality: 'worlds:list:4g' or ['worlds', 'list', '4g']
   */
  baseCacheKey: string | string[];

  /**
   * Tags to invalidate on quality change
   * These should match the entity types affected (e.g., 'worlds', 'characters')
   */
  cacheTagsToInvalidate: string[];
}

/**
 * Get adaptive cache key that includes network quality
 *
 * Usage in query hooks:
 * ```ts
 * const cacheKey = getQualityAwareCacheKey({
 *   baseCacheKey: 'worlds:list',
 *   cacheTagsToInvalidate: ['worlds'],
 * });
 * // Result: 'worlds:list:4g' or 'worlds:list:2g'
 * ```
 *
 * @param config Adaptive query configuration
 * @returns Cache key that includes quality tier (string)
 */
export function getQualityAwareCacheKey(
  config: AdaptiveQueryConfig,
): string {
  const status = NetworkDetection.getStatus();
  const qualityComponent = getCacheKeyQualityComponent(status);

  // Handle both string and array base keys
  if (Array.isArray(config.baseCacheKey)) {
    return [...config.baseCacheKey, qualityComponent].join(":");
  }

  return `${config.baseCacheKey}:${qualityComponent}`;
}

/**
 * Get query params for adaptive payload request
 *
 * Usage in query hooks:
 * ```ts
 * const params = getAdaptiveQueryParams();
 * // Result: { imageQuality: 'hd', maxPayloadBytes: 5242880, compress: true }
 * ```
 *
 * @returns Query params object ready for API request
 */
export function getAdaptiveQueryParams(): Record<string, any> {
  const status = NetworkDetection.getStatus();
  const options = getAdaptivePayloadOptions(status);
  return buildAdaptiveQueryParams(options);
}

/**
 * Integration pattern for query hooks (React Query)
 *
 * Example implementation:
 * ```ts
 * import { useQuery } from '@tanstack/react-query';
 * import { getQualityAwareCacheKey, getAdaptiveQueryParams } from '@/lib/network/adaptive-payload-integration';
 *
 * export function useWorldsQuery() {
 *   const cacheKey = getQualityAwareCacheKey({
 *     baseCacheKey: ['worlds', 'list'],
 *     cacheTagsToInvalidate: ['worlds'],
 *   });
 *
 *   const queryParams = getAdaptiveQueryParams();
 *
 *   return useQuery({
 *     queryKey: cacheKey,
 *     queryFn: async () => {
 *       return requestManager.get('/api/worlds', { params: queryParams });
 *     },
 *     // optional: staleTime depends on quality
 *     // slower connections benefit from longer cache
 *     staleTime: getStaleTimeForQuality(cacheKey),
 *   });
 * }
 * ```
 *
 * Setup at app level:
 * ```ts
 * // app/_layout.tsx or AppLayout component
 *
 * import { useAdaptivePayloadCacheInvalidation } from '@/hooks/network/useAdaptivePayloadCacheInvalidation';
 *
 * export function AppLayout() {
 *   // Watch for quality changes and invalidate cache
 *   useAdaptivePayloadCacheInvalidation({
 *     tagsToInvalidate: ['worlds', 'characters', 'campaigns', 'assets'],
 *   });
 *
 *   // Render child routes here
 *   return (
 *     <AppParamsProvider>
 *       {renderRoutes()}
 *     </AppParamsProvider>
 *   );
 * }
 * ```
 */
export const integrateAdaptivePayloads = {
  /**
   * Documentation: follow the integration pattern above.
   */
};

/**
 * Optional: Calculate staleTime based on quality
 *
 * Slower connections benefit from longer cache validity
 * to reduce redundant network calls.
 *
 * @param cacheKey Cache key string (e.g., 'worlds:list:4g')
 * @returns staleTime in milliseconds
 */
export function getStaleTimeForQuality(cacheKey: string): number {
  // Extract quality component (last colon-separated segment)
  const segments = cacheKey.split(":");
  const qualityComponent = segments[segments.length - 1];

  // Adjust stale time based on quality tier
  switch (qualityComponent) {
    case "4g":
      return 2 * 60 * 1000; // 2 minutes - refresh quickly on good connection
    case "3g":
      return 5 * 60 * 1000; // 5 minutes
    case "2g":
    case "slow-2g":
      return 15 * 60 * 1000; // 15 minutes - keep longer on slow connection
    case "offline":
      return Infinity; // Never stale offline - use cached data
    default:
      return 5 * 60 * 1000; // 5 minutes default
  }
}
