/**
 * Dev-only features with runtime guards.
 * 
 * These functions use runtime checks (isDevelopment()) to execute dev-only logic.
 * In production, they perform no-op operations with minimal overhead.
 * The functions remain in the bundle but are safe to call—they simply return early.
 *
 * Usage:
 *   import { useDevConsole } from '@/lib/config/dev-only';
 *   const logger = useDevConsole('MyModule');
 *   logger.log('This only logs in dev'); // No-op in production
 */

import { getAppConfig, isDevelopment } from './loader';

/**
 * Dev-only console logger.
 * In production, returns an object with no-op methods (minimal overhead).
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
 * Check if dev bypass mode is enabled (skips auth, feature gates, etc. during testing).
 * Only available in development; always returns false in production.
 */
export function isDevBypassEnabled(): boolean {
  if (!isDevelopment()) return false;

  const config = getAppConfig();
  return config.features.devBypass;
}

/**
 * Dev-only debug assertion.
 * Throws in dev if condition is false; returns immediately in production (no-op).
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
 * In production, returns a timer with a no-op `end()` method (minimal overhead).
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
