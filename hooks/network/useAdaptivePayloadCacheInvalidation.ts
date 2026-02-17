/**
 * Cache Invalidation on Network Quality Change
 *
 * Watches NetworkDetection for effectiveType changes and invalidates
 * quality-sensitive cache tags so queries refetch with new params.
 *
 * Integration with Phase 1b: Use this hook in app layout or screens
 * that have quality-dependent queries. Call invalidateAdaptivePayloadCache()
 * when you want to force-refresh without waiting for quality change.
 */

import { QueryCache } from "@/lib/cache/query-cache";
import { NetworkDetection } from "@/lib/network/network-detection";
import { logger } from "@/lib/utils/logger";
import { useEffect } from "react";

/**
 * Hook that watches network quality changes and invalidates
 * cache for queries that depend on adaptive payloads.
 *
 * Call this hook once at app level (e.g., in AppLayout) to automatically
 * refetch queries when network quality changes (4G → 2G → offline).
 *
 * Example:
 * ```tsx
 * export function AppLayout() {
 *   useAdaptivePayloadCacheInvalidation({
 *     tagsToInvalidate: ['worlds', 'characters', 'campaigns'],
 *   });
 *
 *   return <div>...</div>;
 * }
 * ```
 *
 * @param options Configuration for cache invalidation
 * @param options.tagsToInvalidate Tags to invalidate when quality changes
 *        (e.g., ['worlds', 'characters']). Usually top-level entity tags.
 * @param options.skipInitialCheck If true, skip invalidation on first mount
 *        (default: true, to avoid redundant refetch on app start)
 */
export function useAdaptivePayloadCacheInvalidation(options: {
  tagsToInvalidate: string[];
  skipInitialCheck?: boolean;
}): void {
  const { tagsToInvalidate, skipInitialCheck = true } = options;

  useEffect(() => {
    let previousEffectiveType: string | undefined = NetworkDetection.getStatus()
      ?.effectiveType;
    let isFirstCheck = true;

    // Subscribe to network status changes
    const unsubscribe = NetworkDetection.subscribe((status) => {
      const currentEffectiveType = status?.effectiveType;

      // Skip check on first subscription if requested
      if (isFirstCheck && skipInitialCheck) {
        previousEffectiveType = currentEffectiveType;
        isFirstCheck = false;
        return;
      }

      isFirstCheck = false;

      // Check if effectiveType actually changed
      if (previousEffectiveType !== currentEffectiveType) {
        logger
          .category("network")
          .info("Network quality changed, invalidating adaptive payload cache", {
            from: previousEffectiveType,
            to: currentEffectiveType,
            tagsInvalidated: tagsToInvalidate,
          });

        // Invalidate cache tags to force refetch with new quality params
        QueryCache.invalidateByTags(tagsToInvalidate).catch((err) => {
          logger
            .category("error")
            .warn("Failed to invalidate adaptive payload cache", err);
        });

        previousEffectiveType = currentEffectiveType;
      }
    });

    return () => {
      unsubscribe();
    };
  }, [tagsToInvalidate, skipInitialCheck]);
}

/**
 * Manually invalidate cache for quality-aware queries
 *
 * Use this when you want to force a refetch without waiting for network quality to change
 * (e.g., user manually switches quality tier, or request fails and you want to retry with same quality).
 *
 * @param tagsToInvalidate Tags to invalidate
 */
export async function invalidateAdaptivePayloadCache(
  tagsToInvalidate: string[],
): Promise<void> {
  logger
    .category("network")
    .debug("Manually invalidating adaptive payload cache", { tagsToInvalidate });

  await QueryCache.invalidateByTags(tagsToInvalidate);
}
