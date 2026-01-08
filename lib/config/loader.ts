/**
 * Environment-aware config loader
 *
 * Loads either appsettings.dev.json or appsettings.json based on EXPO_PUBLIC_ENVIRONMENT.
 * This is a compile-time selection to ensure dev features are completely stripped from production builds.
 *
 * **Design notes:**
 * - Config is loaded lazily on first call to getAppConfig() and cached thereafter
 * - Safe to import from any module; multiple imports will use the cached config
 * - Environment must be set (via EXPO_PUBLIC_ENVIRONMENT) BEFORE the app initializes
 * - Dev-only features should use isDevelopment() from this module for runtime guards
 *
 * Usage:
 *   const config = getAppConfig();
 *   if (config.features.consoleLogging) enableLogging();
 */

export interface AppSettings {
  description: string;
  environment: 'development' | 'production';
  features: {
    consoleLogging: boolean;
    devBypass: boolean;
    mockData: boolean;
    performanceMonitoring: boolean;
  };
  overrides: {
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
 * 
 * Throws if the required appsettings file is missing or malformed.
 */
export function getAppConfig(): AppSettings {
  if (cachedConfig) return cachedConfig;

  const environment = process.env.EXPO_PUBLIC_ENVIRONMENT || 'production';
  let config: AppSettings;

  try {
    if (environment === 'development') {
      config = require('../../config/appsettings.dev.json') as AppSettings;
    } else {
      config = require('../../config/appsettings.json') as AppSettings;
    }
  } catch (err) {
    const configFile = environment === 'development' 
      ? 'config/appsettings.dev.json' 
      : 'config/appsettings.json';
    const errorMessage = err instanceof Error ? err.message : String(err);
    
    const failureMsg = 
      environment === 'development'
        ? `[AppConfig] Failed to load development settings (${configFile}). ` +
          'Ensure the file exists and is valid JSON. ' +
          'Common causes: missing file, syntax error, or incorrect strip-dev-appsettings cleanup.\n' +
          `Original error: ${errorMessage}`
        : `[AppConfig] Failed to load production settings (${configFile}). ` +
          'This file is required and should be present in all production builds.\n' +
          `Original error: ${errorMessage}`;
    
    console.error(failureMsg);
    throw new Error(failureMsg);
  }

  // Validate that the loaded config has the expected structure
  if (!config.environment || !config.features || !config.overrides || !config.devTools) {
    const missingFields = [];
    if (!config.environment) missingFields.push('environment');
    if (!config.features) missingFields.push('features');
    if (!config.overrides) missingFields.push('overrides');
    if (!config.devTools) missingFields.push('devTools');

    const configFile = environment === 'development' 
      ? 'config/appsettings.dev.json' 
      : 'config/appsettings.json';
    const validationMsg =
      `[AppConfig] ${configFile} is missing required fields: ${missingFields.join(', ')}. ` +
      'Ensure the file matches the AppSettings interface.';
    
    console.error(validationMsg);
    throw new Error(validationMsg);
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
