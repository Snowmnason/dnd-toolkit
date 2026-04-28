/**
 * Hook for UI components to be aware of adaptive payload state
 * 
 * Use this in components that want to display connection quality indicators,
 * disable certain features on slow networks, or adjust UI based on payload quality.
 * 
 * @example
 * ```tsx
 * function MapView() {
 *   const { effectiveType, payloadOptions } = useAdaptivePayload();
 *   
 *   // Show quality indicator
 *   const quality = payloadOptions.imageQuality || 'unknown';
 *   console.log(`Maps on ${effectiveType}: quality=${quality}`);
 *   
 *   // Conditionally render expensive components
 *   if (payloadOptions.excludeMaps) {
 *     return <TextMapPlaceholder />;
 *   }
 *   
 *   return <FullMapComponent />;
 * }
 * ```
 * 
 * @see AdaptivePayload for quality mapping logic
 */

import { NetworkManager, type AdaptivePayloadOptions } from '@/lib/network/network-manager';
import { logger } from "@/lib/utils/logger";
import { QueryCache } from "@/middleware/storage";
import { useEffect, useMemo, useState } from 'react';

export interface UseAdaptivePayloadResult {
  /**
   * Current effective network connection type
   * Examples: '4g', '3g', '2g', 'slow-2g', 'offline', 'unknown'
   */
  effectiveType: string;

  /**
   * Adaptive payload quality settings for current network
   * Includes: imageQuality, excludeMaps, summaryOnly, etc.
   * 
   * Use these in components/fetchers to adjust what data to load
   */
  payloadOptions: AdaptivePayloadOptions;

  /**
   * Whether the device is currently offline
   * Convenience property for common UI checks
   */
  isOffline: boolean;

  /**
   * Whether network quality is slow (2g or slower)
   * Convenience property for disabling heavy UI features
   */
  isSlowNetwork: boolean;

  /**
   * Whether network quality is excellent (4g)
   * Convenience property for enabling premium features
   */
  isExcellentNetwork: boolean;
}

/**
 * Hook that returns the current adaptive payload options and network state
 * 
 * This hook subscribes to NetworkDetection changes and returns current network
 * quality information along with recommended payload options for the UI.
 * Updates automatically when network quality changes.
 * 
 * @returns Network status and adaptive payload configuration
 */
export function useAdaptivePayload(): UseAdaptivePayloadResult {
  // Get initial network status and subscribe to changes
  // Store in state so component re-renders when network quality changes
  const [networkStatus, setNetworkStatus] = useState(
    () => NetworkManager.getStatus()
  );

  // Subscribe to network status changes
  useEffect(() => {
    // Unsubscribe returns the cleanup function
    const unsubscribe = NetworkManager.subscribe((newStatus) => {
      setNetworkStatus(newStatus);
    });

    return unsubscribe;
  }, []);

  // Memoize the payload options so we don't recalculate unnecessarily
  // Options change only when networkStatus.effectiveType changes
  const payloadOptions = useMemo(
    () => NetworkManager.getPayloadOptions(networkStatus || undefined),
    [networkStatus]
  );

  const effectiveType = networkStatus?.effectiveType || 'unknown';
  const isOffline = effectiveType === 'offline';
  const isSlowNetwork = effectiveType === '2g' || effectiveType === 'slow-2g';
  const isExcellentNetwork = effectiveType === '4g';

  return {
    effectiveType,
    payloadOptions,
    isOffline,
    isSlowNetwork,
    isExcellentNetwork,
  };
}

// ─── Cache Invalidation ───────────────────────────────────────────────────────

/**
 * Hook that watches network quality changes and invalidates cache for
 * queries that depend on adaptive payloads. Call once at app level.
 *
 * @param options.tagsToInvalidate Tags to invalidate when quality changes
 * @param options.skipInitialCheck Skip invalidation on first mount (default: true)
 */
export function useAdaptivePayloadCacheInvalidation(options: {
  tagsToInvalidate: string[];
  skipInitialCheck?: boolean;
}): void {
  const { tagsToInvalidate, skipInitialCheck = true } = options;
  const tagsKey = tagsToInvalidate.join(',');

  useEffect(() => {
    let previousEffectiveType: string | undefined = NetworkManager.getStatus()?.effectiveType;
    let isFirstCheck = true;

    const unsubscribe = NetworkManager.subscribe((status) => {
      const currentEffectiveType = status?.effectiveType;

      if (isFirstCheck && skipInitialCheck) {
        previousEffectiveType = currentEffectiveType;
        isFirstCheck = false;
        return;
      }
      isFirstCheck = false;

      if (previousEffectiveType !== currentEffectiveType) {
        logger.category("network").info("Network quality changed, invalidating adaptive payload cache", {
          from: previousEffectiveType,
          to: currentEffectiveType,
          tagsInvalidated: tagsToInvalidate,
        });
        QueryCache.invalidateByTags(tagsToInvalidate, { strategy: 'background' }).catch((err) => {
          logger.category("error").warn("Failed to invalidate adaptive payload cache", err);
        });
        previousEffectiveType = currentEffectiveType;
      }
    });

    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tagsKey, skipInitialCheck]);
}

/**
 * Manually invalidate cache for quality-aware queries.
 * Use when you want to force a refetch without waiting for network quality to change.
 * Background strategy allows stale data to display while refetching.
 */
export async function invalidateAdaptivePayloadCache(tagsToInvalidate: string[]): Promise<void> {
  logger.category("network").debug("Manually invalidating adaptive payload cache", { tagsToInvalidate });
  await QueryCache.invalidateByTags(tagsToInvalidate, { strategy: 'background' });
}
