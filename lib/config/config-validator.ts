/**
 * Configuration Validator - DND-Toolkit Specific
 * 
 * Validates app configuration at startup to ensure:
 * - All required fields for DND-Toolkit are present
 * - Required environment variables are set (Supabase, Analytics, etc.)
 * - Configuration is consistent for the current environment
 * - Feature flags and thresholds have valid values
 * - Prevents runtime failures from missing/invalid config
 * 
 * NOTE: This validator is tailored to DND-Toolkit's requirements.
 * When cloning for another app, you'll need to update this file to match that app's config schema.
 * 
 * This is integrated into the kernel initialization as a critical validation step.
 */

import { logger } from '@/lib/utils/logger';
import { AppSettings } from './loader';

/**
 * Result of config validation
 */
export interface ConfigValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * DND-Toolkit required environment variables
 * These must be present for the app to function properly
 */
const REQUIRED_ENV_VARS: Record<'production' | 'development', string[]> = {
  production: [
    // Supabase is required for production (backend, auth, storage)
    'EXPO_PUBLIC_SUPABASE_URL',
    'EXPO_PUBLIC_SUPABASE_ANON_KEY',
    // Environment identifier
    'EXPO_PUBLIC_ENVIRONMENT',
  ],
  development: [
    // Optional for dev - app can run with mock data
    'EXPO_PUBLIC_ENVIRONMENT',
  ],
};

/**
 * DND-Toolkit required features (must exist in config)
 */
const REQUIRED_FEATURES: (keyof AppSettings['features'])[] = [
  'consoleLogging',
  'devBypass',
  'mockData',
  'performanceMonitoring',
  'sentryEnabled',
];

/**
 * DND-Toolkit required overrides (must exist in config)
 */
const REQUIRED_OVERRIDES: (keyof AppSettings['overrides'])[] = [
  'mockSupabase',
  'verboseErrorMessages',
];

/**
 * DND-Toolkit required dev tools (must exist in config)
 */
const REQUIRED_DEV_TOOLS: (keyof AppSettings['devTools'])[] = [
  'enableConsoleLogger',
  'enableNetworkLogger',
  'enablePerformanceLogger',
  'enableReduxDevTools',
  'enableReactDevTools',
];

/**
 * DND-Toolkit required feature flags
 */
const REQUIRED_FEATURE_FLAGS = [
  'splashScreen',
  'debugLogs',
  'loggerCategories',
];

/**
 * Validate environment variables for DND-Toolkit
 */
function validateEnvironmentVariables(environment: 'development' | 'production'): ConfigValidationResult {
  const result: ConfigValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  const required = REQUIRED_ENV_VARS[environment as 'production' | 'development'] || [];

  for (const envVar of required) {
    // eslint-disable-next-line security/detect-object-injection
    if (!process.env[envVar]) {
      result.valid = false;
      result.errors.push(
        `Missing required environment variable: ${envVar}. ` +
        `This is critical for DND-Toolkit to function in ${environment} mode.`
      );
    }
  }

  // Warn if optional but important vars are missing
  if (environment === 'production') {
    if (!process.env.EXPO_PUBLIC_SENTRY_DSN) {
      result.warnings.push(
        'EXPO_PUBLIC_SENTRY_DSN is not set. Error tracking will not work. ' +
        'Set it in your deployment environment if you want production error monitoring.'
      );
    }
  }

  return result;
}

/**
 * Validate app settings structure for DND-Toolkit
 */
function validateAppSettings(config: AppSettings): ConfigValidationResult {
  const result: ConfigValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  // Check required top-level fields
  const requiredFields: (keyof AppSettings)[] = [
    'environment',
    'features',
    'overrides',
    'devTools',
    'featureFlags',
    'thresholds',
  ];

  for (const field of requiredFields) {
    // eslint-disable-next-line security/detect-object-injection
    const value = config[field];
    if (value === undefined || value === null) {
      result.valid = false;
      result.errors.push(`Missing required config field: ${field}`);
    }
  }

  // Validate environment field
  if (config.environment !== 'production' && config.environment !== 'development') {
    result.valid = false;
    result.errors.push(
      `Invalid environment: ${config.environment}. Must be either "production" or "development".`
    );
  }

  // Check environment matches EXPO_PUBLIC_ENVIRONMENT
  const envFromVar = process.env.EXPO_PUBLIC_ENVIRONMENT || 'production';
  if (config.environment !== envFromVar) {
    result.valid = false;
    result.errors.push(
      `Config environment mismatch: env variable is "${envFromVar}" but config says "${config.environment}". ` +
      'Ensure you are loading the correct config file (appsettings.dev.json vs appsettings.json).'
    );
  }

  // Validate features
  if (typeof config.features !== 'object' || config.features === null) {
    result.valid = false;
    result.errors.push('features must be an object');
  } else {
    for (const feature of REQUIRED_FEATURES) {
      if (!(feature in config.features)) {
        result.valid = false;
        result.errors.push(`Missing required feature: features.${feature}`);
      }
    }
  }

  // Validate overrides
  if (typeof config.overrides !== 'object' || config.overrides === null) {
    result.valid = false;
    result.errors.push('overrides must be an object');
  } else {
    for (const override of REQUIRED_OVERRIDES) {
      if (!(override in config.overrides)) {
        result.valid = false;
        result.errors.push(`Missing required override: overrides.${override}`);
      }
    }
  }

  // Validate devTools
  if (typeof config.devTools !== 'object' || config.devTools === null) {
    result.valid = false;
    result.errors.push('devTools must be an object');
  } else {
    for (const tool of REQUIRED_DEV_TOOLS) {
      if (!(tool in config.devTools)) {
        result.valid = false;
        result.errors.push(`Missing required dev tool: devTools.${tool}`);
      }
    }
  }

  // Validate feature flags
  if (typeof config.featureFlags !== 'object' || config.featureFlags === null) {
    result.valid = false;
    result.errors.push('featureFlags must be an object');
  } else {
    // Check required feature flags exist
    for (const flagName of REQUIRED_FEATURE_FLAGS) {
      if (!(flagName in config.featureFlags)) {
        result.valid = false;
        result.errors.push(`Missing required feature flag: featureFlags.${flagName}`);
      }
    }

    // Validate each feature flag structure
    for (const [flagName, flagConfig] of Object.entries(config.featureFlags)) {
      if (typeof flagConfig !== 'object' || flagConfig === null) {
        result.valid = false;
        result.errors.push(`Invalid feature flag "${flagName}": must be an object`);
      } else if (!('enabled' in flagConfig)) {
        result.valid = false;
        result.errors.push(`Feature flag "${flagName}" missing required "enabled" field`);
      }

      // Validate loggerCategories structure specifically
      if (flagName === 'loggerCategories' && flagConfig && typeof flagConfig === 'object') {
        const flagWithCategories = flagConfig as any;
        const categories = flagWithCategories.categories;
        if (categories && typeof categories === 'object') {
          const requiredCategories = [
            'auth', 'navigation', 'api', 'performance', 'storage', 'ui',
            'analytics', 'security', 'bootstrap', 'error', 'other'
          ];
          for (const cat of requiredCategories) {
            if (!(cat in categories)) {
              result.valid = false;
              result.errors.push(
                `Feature flag "loggerCategories" missing required category: ${cat}`
              );
            }
          }
        }
      }
    }
  }

  // Validate thresholds
  if (config.thresholds) {
    if (typeof config.thresholds !== 'object') {
      result.valid = false;
      result.errors.push('thresholds must be an object');
    }
  }

  // Warn if dev features are enabled in production
  if (config.environment === 'production') {
    if (config.features.devBypass) {
      result.warnings.push(
        '⚠️ devBypass is ENABLED in production - this is a critical security risk! ' +
        'Users can bypass authentication. This should NEVER be true in production.'
      );
      result.valid = false; // Treat as error
    }
    if (config.features.mockData) {
      result.warnings.push(
        '⚠️ mockData is ENABLED in production - this will serve incorrect game data! ' +
        'Players will see mock worlds and campaigns instead of real data.'
      );
      result.valid = false; // Treat as error
    }
    if (config.overrides.verboseErrorMessages) {
      result.warnings.push(
        '⚠️ verboseErrorMessages is ENABLED in production - ' +
        'this may expose sensitive information to end users.'
      );
    }
    if (config.devTools.enableConsoleLogger) {
      result.warnings.push(
        'Development console logging is enabled in production config. ' +
        'This is usually fine but review for any PII that might be logged.'
      );
    }
  }

  return result;
}

/**
 * Validate the complete app configuration for DND-Toolkit
 * Called during kernel initialization (Phase 0, before preload)
 */
export function validateConfig(config: AppSettings): ConfigValidationResult {
  const result: ConfigValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
  };

  // Validate environment variables
  const envResult = validateEnvironmentVariables(config.environment);
  result.errors.push(...envResult.errors);
  result.warnings.push(...envResult.warnings);

  // Validate app settings
  const settingsResult = validateAppSettings(config);
  result.errors.push(...settingsResult.errors);
  result.warnings.push(...settingsResult.warnings);

  // Set valid flag - must pass both checks
  result.valid = envResult.valid && settingsResult.valid;

  return result;
}

/**
 * Log validation results using the logger system
 * Errors prevent app startup, warnings are logged but don't block
 */
export function logValidationResults(result: ConfigValidationResult): void {
  if (result.errors.length > 0) {
    logger.category('bootstrap').error(
      `Configuration validation FAILED with ${result.errors.length} error(s):`
    );
    for (const error of result.errors) {
      logger.category('bootstrap').error(`  ❌ ${error}`);
    }
  }

  if (result.warnings.length > 0) {
    logger.category('bootstrap').warn(
      `Configuration validation has ${result.warnings.length} warning(s):`
    );
    for (const warning of result.warnings) {
      logger.category('bootstrap').warn(`  ⚠️ ${warning}`);
    }
  }

  if (result.valid && result.errors.length === 0) {
    logger.category('bootstrap').info(
      '✅ Configuration validated successfully'
    );
  }
}
