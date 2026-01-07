/**
 * Environment-aware config loader
 *
 * Loads either appsettings.dev.json or appsettings.json based on EXPO_PUBLIC_ENVIRONMENT.
 * This is a compile-time selection to ensure dev features are completely stripped from production builds.
 *
 * **IMPORTANT**: This file should ONLY be imported at app initialization in the root component (_layout.tsx).
 * Dev-only features must be guarded with compile-time checks (process.env.NODE_ENV or similar).
 *
 * Usage:
 *   const config = getAppConfig();
 *   if (config.features.debugLogs) console.log(...);
 */

export interface AppSettings {
  description: string;
  environment: 'development' | 'production';
  features: {
    debugLogs: boolean;
    consoleLogging: boolean;
    devBypass: boolean;
    mockData: boolean;
    performanceMonitoring: boolean;
  };
  overrides: {
    skipAuth: boolean;
    mockSupabase: boolean;
    verboseErrorMessages: boolean;
  };
  devTools: {
    enableConsoleLogger: boolean;
    enableNetworkLogger: boolean;
    enablePerformanceLogger: boolean;
    enableReduxDevTools: boolean;
    enableReactDevTools: boolean;
  };
  featureFlags: Record<
    string,
    {
      enabled: boolean;
      description?: string;
      kind?: 'free' | 'premium' | 'beta';
    }
  >;
}

let cachedConfig: AppSettings | null = null;

/**
 * Get the current app settings.
 * Respects EXPO_PUBLIC_ENVIRONMENT; defaults to 'production' for safety.
 * Result is cached after first call.
 */
export function getAppConfig(): AppSettings {
  if (cachedConfig) return cachedConfig;

  const environment = process.env.EXPO_PUBLIC_ENVIRONMENT || 'production';
  let config: AppSettings;

  if (environment === 'development') {
    config = require('../../config/appsettings.dev.json') as AppSettings;
  } else {
    config = require('../../config/appsettings.json') as AppSettings;
  }

  cachedConfig = config;
  return config;
}

/**
 * Checks if we're in development mode.
 * Useful for compile-time guards.
 */
export function isDevelopment(): boolean {
  return process.env.EXPO_PUBLIC_ENVIRONMENT === 'development';
}

/**
 * Checks if we're in production mode.
 * Use this to ensure code paths are safe for production.
 */
export function isProduction(): boolean {
  return (process.env.EXPO_PUBLIC_ENVIRONMENT || 'production') === 'production';
}
