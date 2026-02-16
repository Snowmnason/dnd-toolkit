/**
 * Image Proxy Utilities
 * 
 * Handles CORS-safe image loading for external URLs
 * Uses a public CORS proxy for development/testing
 */

/**
 * CORS proxy URL - routes through a public proxy to bypass CORS restrictions
 * Note: This is for development. In production, consider:
 * - Hosting images on your own CDN
 * - Using a dedicated CORS proxy service
 * - Requesting CORS headers from original source
 */
// CORS proxy removed (unused). If needed, reintroduce via config.

/**
 * Check if URL is from an external domain (not our own server)
 */
export function isExternalUrl(url: string): boolean {
  try {
    const urlObj = new URL(url);
    const currentHost = typeof window !== 'undefined' ? window.location.hostname : null;
    return !!(currentHost && urlObj.hostname !== currentHost);
  } catch {
    return false;
  }
}

/**
 * Get a CORS-safe URL for external images
 * For now, returns the original URL - CORS proxies have limitations
 * 
 * Better approaches:
 * 1. Store images locally in assets/images
 * 2. Use a backend endpoint that fetches and serves images
 * 3. Request CORS headers from the original server
 */
export function getCorsImageUrl(url: string): string {
  // For external URLs, you could use a CORS proxy, but they have limitations
  // Instead, we recommend:
  // 1. Downloading images and serving locally
  // 2. Using your backend as a proxy
  // 3. Requesting CORS headers from Wizards of the Coast
  
  // For now, return original URL and let it fail gracefully
  return url;
}

/**
 * Local map images that don't require CORS
 * Consider downloading external images and storing them here
 */
export const LOCAL_MAP_IMAGES = [
  // Placeholder - add local images here instead of external URLs
  '/assets/images/placeholder-map.png',
];
