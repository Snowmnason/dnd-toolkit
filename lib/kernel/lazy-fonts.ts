/**
 * Lazy Fonts
 * 
 * Non-critical fonts loaded on-demand to avoid blocking bootstrap.
 * These fonts are not loaded during kernel initialization but can be
 * loaded dynamically when needed by specific components.
 * 
 * Usage:
 * ```tsx
 * import { loadLazyFont } from '@/lib/kernel';
 * 
 * // In a component that needs the Cyberpunk font:
 * useEffect(() => {
 *   loadLazyFont('Cyberpunk').catch(err => {
 *     console.warn('Failed to load Cyberpunk font', err);
 *   });
 * }, []);
 * ```
 */

import { logger } from '@/lib/utils/logger';
import * as Font from 'expo-font';

/**
 * Registry of lazy-loadable fonts
 * Add new fonts here that should be loaded on-demand
 */
export const lazyFonts = {
  Cyberpunk: require('../../assets/fonts/Cyberpunk.ttf'),
  // Add more lazy fonts here as needed
  // Example: Eurostile: require('../../assets/fonts/Eurostile.ttf'),
} as const;

export type LazyFontName = keyof typeof lazyFonts;

// Track which fonts have been loaded to avoid duplicate loads
const loadedFonts = new Set<LazyFontName>();

// Track in-progress font loads to prevent concurrent loads of the same font
const inProgressLoads = new Map<LazyFontName, Promise<void>>();

/**
 * Load a specific lazy font on-demand
 * Safe to call multiple times - will only load once per font
 * Handles concurrent calls for the same font by returning the same promise
 */
export async function loadLazyFont(fontName: LazyFontName): Promise<void> {
  // If already loaded, return immediately
  if (loadedFonts.has(fontName)) {
    logger.category('bootstrap').debug(`Lazy font ${fontName} already loaded, skipping`);
    return;
  }

  // If already loading, return the same promise to prevent concurrent loads
  if (inProgressLoads.has(fontName)) {
    logger.category('bootstrap').debug(`Lazy font ${fontName} is already loading, returning existing promise`);
    return inProgressLoads.get(fontName)!;
  }

  // Create the load promise and track it
  const loadPromise = (async () => {
    try {
      logger.category('bootstrap').debug(`Loading lazy font: ${fontName}`);
      // eslint-disable-next-line security/detect-object-injection
      const fontSource = lazyFonts[fontName];
      await Font.loadAsync({ [fontName]: fontSource });
      loadedFonts.add(fontName);
      logger.category('bootstrap').info(`Lazy font loaded successfully: ${fontName}`);
    } catch (error) {
      logger.category('bootstrap').error(`Failed to load lazy font: ${fontName}`, {
        error: (error as Error).message,
      });
      throw error;
    } finally {
      // Clean up the in-progress tracking
      inProgressLoads.delete(fontName);
    }
  })();

  inProgressLoads.set(fontName, loadPromise);
  return loadPromise;
}

/**
 * Check if a lazy font has been loaded
 */
export function isLazyFontLoaded(fontName: LazyFontName): boolean {
  return loadedFonts.has(fontName);
}

/**
 * Preload all lazy fonts in background (optional)
 * Useful for warming up fonts before they're needed
 */
export async function preloadAllLazyFonts(): Promise<void> {
  logger.category('bootstrap').debug('Preloading all lazy fonts in background');
  const fontNames = Object.keys(lazyFonts) as LazyFontName[];
  
  await Promise.allSettled(
    fontNames.map(fontName => loadLazyFont(fontName))
  );
  
  logger.category('bootstrap').info('Lazy fonts preload complete', {
    loaded: Array.from(loadedFonts),
    total: fontNames.length,
  });
}
