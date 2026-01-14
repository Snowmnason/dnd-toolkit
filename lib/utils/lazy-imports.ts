/**
 * 🚀 Lazy Import Utilities
 * 
 * Consistent pattern for lazy-loading heavy modules on-demand
 * Reduces initial bundle size by deferring non-critical imports
 */

import { logger } from './logger';

/**
 * Safely lazy-load a module with error handling and timing
 * 
 * @example
 * const ComponentModule = await lazyLoad(() => import('./HeavyComponent'));
 * const Component = ComponentModule.default;
 */
export async function lazyLoad<T>(
  importFn: () => Promise<T>,
  moduleName: string = 'Module'
): Promise<T> {
  const startTime = Date.now();
  try {
    const module = await importFn();
    const duration = Date.now() - startTime;
    logger.debug('lazy-load', `✅ ${moduleName} loaded (${duration}ms)`);
    return module;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('lazy-load', `❌ Failed to load ${moduleName} (${duration}ms):`, error);
    throw error;
  }
}

/**
 * Load a module in the background without blocking
 * 
 * @example
 * lazyLoadInBackground(() => import('./HeavyComponent'), 'HeavyComponent');
 */
export function lazyLoadInBackground<T>(
  importFn: () => Promise<T>,
  moduleName: string = 'Module'
): Promise<T> {
  return lazyLoad(importFn, moduleName).catch((error) => {
    logger.warn('lazy-load', `Background load of ${moduleName} failed, will retry on demand`);
    // Return a rejected promise but don't throw - background loads are non-critical
    return Promise.reject(error);
  });
}

/**
 * Create a lazy-loadable component wrapper
 * Useful for React components that should load on-demand
 * 
 * @example
 * const LazyStyleDesktop = createLazyComponent(
 *   () => import('./StyleDesktop'),
 *   'StyleDesktop'
 * );
 */
export function createLazyComponent(
  importFn: () => Promise<any>,
  componentName: string = 'Component'
) {
  return async () => {
    const module = await lazyLoad(importFn, componentName);
    return module.default;
  };
}
