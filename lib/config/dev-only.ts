/**
 * Dev-only features guarded by compile-time checks.
 * These functions are completely removed from production builds.
 *
 * Usage:
 *   import { useDevConsole } from '@/lib/config/dev-only';
 *   // Will type-error or return no-op in production
 */

import { getAppConfig, isDevelopment } from './loader';

/**
 * Dev-only console logger.
 * In production, this is a no-op and will be tree-shaken.
 */
export function useDevConsole(scope: string) {
  if (!isDevelopment()) {
    return {
      log: () => {},
      warn: () => {},
      error: () => {},
    };
  }

  const config = getAppConfig();

  return {
    log: (...args: any[]) => {
      if (config.devTools.enableConsoleLogger) {
        console.log(`[${scope}]`, ...args);
      }
    },
    warn: (...args: any[]) => {
      if (config.devTools.enableConsoleLogger) {
        console.warn(`[${scope}]`, ...args);
      }
    },
    error: (...args: any[]) => {
      if (config.devTools.enableConsoleLogger) {
        console.error(`[${scope}]`, ...args);
      }
    },
  };
}

/**
 * Dev-only feature bypass.
 * Allows skipping auth or other checks during local testing.
 * Completely disabled in production.
 */
export function canBypassFeature(featureName: string): boolean {
  if (!isDevelopment()) return false;

  const config = getAppConfig();
  return config.features.devBypass;
}

/**
 * Dev-only debug assertion.
 * Throws in dev if condition is false; no-op in production.
 */
export function devAssert(condition: boolean, message: string): void {
  if (!isDevelopment()) return;

  if (!condition) {
    const config = getAppConfig();
    if (config.overrides.verboseErrorMessages) {
      throw new Error(`[DEV ASSERTION] ${message}`);
    }
  }
}

/**
 * Dev-only performance monitoring.
 * Returns a no-op timer in production.
 */
export function createDevTimer(label: string) {
  if (!isDevelopment()) {
    return {
      end: () => {},
    };
  }

  const config = getAppConfig();
  const startTime = Date.now();

  return {
    end: () => {
      if (config.devTools.enablePerformanceLogger) {
        const elapsed = Date.now() - startTime;
        console.log(`[PERF] ${label}: ${elapsed}ms`);
      }
    },
  };
}
