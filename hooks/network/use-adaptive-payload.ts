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
 * @see useAdaptivePayloadCacheInvalidation for cache invalidation
 */

import { getAdaptivePayloadOptions } from '@/lib/network/adaptive-payload';
import { NetworkDetection } from '@/lib/network/network-detection';
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
  payloadOptions: ReturnType<typeof getAdaptivePayloadOptions>;

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
    () => NetworkDetection.getStatus()
  );

  // Subscribe to network status changes
  useEffect(() => {
    // Unsubscribe returns the cleanup function
    const unsubscribe = NetworkDetection.subscribe((newStatus) => {
      setNetworkStatus(newStatus);
    });

    return unsubscribe;
  }, []);

  // Memoize the payload options so we don't recalculate unnecessarily
  // Options change only when networkStatus.effectiveType changes
  const payloadOptions = useMemo(
    () => getAdaptivePayloadOptions(networkStatus),
    [networkStatus]
  );

  const effectiveType = networkStatus.effectiveType || 'unknown';
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
