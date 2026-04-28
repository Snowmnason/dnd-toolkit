/**
 * Image asset map — single source of truth for required image assets.
 *
 * Contains images that must be cached before first render (e.g., loading
 * spinner, map placeholder). Organized by usage category.
 *
 * Preloading:
 *   Asset.loadAsync(getRequiredImageAssets());
 *
 * Adding a new required image:
 *   1. Drop the image into assets/images/required/.
 *   2. Add the entry to REQUIRED_IMAGES below with a descriptive key.
 *
 * Buckets:
 *   required/  — Must be cached before first render (blocking bootstrap)
 *   background/ — Warm after app is ready (fire-and-forget)
 *   lazy/       — Load on-demand when the consuming screen mounts
 *   system/     — App store / OS icons (not used at runtime, not loaded)
 */

const REQUIRED_IMAGES = {
  /** Animated loading spinner — shown during bootstrap before app is ready. */
  loadingSpinner: require('../assets/images/required/load.gif'),
  /** Placeholder for world map when no image has been selected. */
  worldMapPlaceholder: require('../assets/images/required/Miku.png'),
} as const;

/**
 * Returns all required image assets as a flat array.
 * Pass this to Asset.loadAsync() during the bootstrap preload phase.
 */
export function getRequiredImageAssets(): number[] {
  return Object.values(REQUIRED_IMAGES) as number[];
}
