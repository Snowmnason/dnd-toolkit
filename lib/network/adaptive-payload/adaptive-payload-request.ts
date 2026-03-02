/**
 * Request Management Integration for Adaptive Payloads
 * 
 * Helpers to auto-append adaptive query parameters to GET requests,
 * and to make explicit decisions about downgrading already-loaded resources.
 * Use these when making query requests through RequestManager.
 */

import { NetworkDetection } from '@/system/Network/network-detection';
import { buildAdaptiveQueryParams, getAdaptivePayloadOptions, type PayloadQuality } from './adaptive-payload';

/**
 * Append adaptive payload parameters to a URL/key
 * 
 * Use this when making GET requests through RequestManager to automatically
 * include quality-aware parameters without modifying the fetcher.
 * 
 * Example:
 * ```ts
 * const key = appendAdaptiveParams('worlds:list'); // 'worlds:list?imageQuality=hd&...'
 * const result = await RequestManager.fetch(key, () => fetcher());
 * ```
 * 
 * @param urlOrKey - URL or cache key (e.g., 'worlds:list' or '/api/worlds')
 * @returns URL/key with adaptive params appended as query string
 */
export function appendAdaptiveParams(urlOrKey: string): string {
  const status = NetworkDetection.getStatus();
  const options = getAdaptivePayloadOptions(status);
  const params = buildAdaptiveQueryParams(options);

  // If no params to add, return as-is
  if (Object.keys(params).length === 0) {
    return urlOrKey;
  }

  // Build query string
  const queryString = new URLSearchParams(params).toString();

  // Append to URL
  const separator = urlOrKey.includes('?') ? '&' : '?';
  return `${urlOrKey}${separator}${queryString}`;
}

/**
 * Build query string from adaptive payload options
 * 
 * Converts current network quality to query parameters.
 * 
 * Example:
 * ```ts
 * const queryString = getAdaptiveQueryString(); // 'imageQuality=hd&maxPayloadBytes=5242880'
 * const url = `https://api.example.com/worlds?${queryString}`;
 * ```
 * 
 * @returns Query string (e.g., 'imageQuality=hd&excludeMaps=true')
 */
export function getAdaptiveQueryString(): string {
  const status = NetworkDetection.getStatus();
  const options = getAdaptivePayloadOptions(status);
  const params = buildAdaptiveQueryParams(options);
  return new URLSearchParams(params).toString();
}

/**
 * Decide whether to downgrade an already-loaded resource when network quality changes
 * 
 * Use this to make explicit, thoughtful decisions about when to replace already-loaded
 * content vs. keeping what the user has. This prevents poor UX like automatically
 * replacing a loaded HD image with a thumbnail just because the connection degraded.
 * 
 * Safe default: never auto-downgrade loaded resources. Components can use this helper
 * to opt-in to degradation only when it makes sense (e.g., animated GIFs, real-time updates).
 * 
 * Example:
 * ```tsx
 * function ImageView({ world }: { world: World }) {
 *   const { payloadOptions } = useAdaptivePayload();
 *   const [imageQuality, setImageQuality] = useState<PayloadQuality>('hd');
 *   const [imageState, setImageState] = useState<'loading' | 'loaded'>('loading');
 * 
 *   // After image loads
 *   const onImageLoaded = (quality: PayloadQuality) => {
 *     setImageQuality(quality);
 *     setImageState('loaded');
 *   };
 * 
 *   // Called when quality changes, determines if we should re-request lower quality
 *   const shouldReload = shouldDowngradeResource(
 *     imageQuality,
 *     payloadOptions.imageQuality,
 *     imageState
 *   );
 * 
 *   // Only reload if we decide to downgrade (you decide the policy)
 *   useEffect(() => {
 *     if (shouldReload) {
 *       refetchImage(); // Define this yourself
 *     }
 *   }, [shouldReload]);
 * }
 * ```
 * 
 * @param previousQuality - Quality tier of currently loaded resource (hd, sd, thumb, text-only)
 * @param currentQuality - Quality tier recommended by current network conditions
 * @param resourceState - Whether resource is 'loaded', 'loading', or 'stale'
 * @returns true if component should downgrade and re-fetch; false otherwise (safe default)
 */
export function shouldDowngradeResource(
  previousQuality: PayloadQuality,
  currentQuality: PayloadQuality,
  resourceState: 'loaded' | 'loading' | 'stale',
): boolean {
  // Quality hierarchy: hd > sd > thumb > text-only
  const qualityRank: Record<PayloadQuality, number> = {
    'hd': 4,
    'sd': 3,
    'thumb': 2,
    'text-only': 1,
  };

  // eslint-disable-next-line security/detect-object-injection
  const previousRank = qualityRank[previousQuality];
  // eslint-disable-next-line security/detect-object-injection
  const currentRank = qualityRank[currentQuality];

  // If already loaded, default is to NOT downgrade (good UX)
  if (resourceState === 'loaded') {
    // Only downgrade in extreme cases (e.g., 4g → 2g AND resource is video/animation)
    // Most static resources benefit from staying at original quality
    // Let component decide: this just provides the rank info
    return false; // Safe default: never auto-downgrade loaded content
  }

  // If currently loading, don't interrupt - let current request finish
  if (resourceState === 'loading') {
    return false;
  }

  // If stale, yes — re-fetch at current quality
  if (resourceState === 'stale' && currentRank < previousRank) {
    return true;
  }

  return false;
}


