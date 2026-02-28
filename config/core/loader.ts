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

// Eagerly import migrations to ensure the migration functions are available
// in test and runtime environments that may not resolve dynamic require() of .ts files.
import { CURRENT_CONFIG_VERSION, migrateConfig } from './migrations';
// Import only platform detection here; apply merging locally so tests can mock
// platform detection without having to provide a merge helper export.
import Constants from "expo-constants";
import { getPlatformName } from './platform-config';

// Lazy import logger to avoid circular dependency with lib/utils/logger
let cachedLogger: any = null;
function getLogger() {
  if (!cachedLogger) {
    cachedLogger = require('@/lib/utils/logger').logger;
  }
  return cachedLogger;
}

export interface AppSettings {
  version: number;
  description: string;
  environment: "development" | "production";
  platformNotes?: string; // Documentation for platform-specific overrides
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
  auth?: {
    provider?: string; // "supabase" | "firebase" | "custom"
    description?: string;
  };
  devTools: {
    enableConsoleLogger: boolean;
    enableNetworkLogger: boolean;
    enablePerformanceLogger: boolean;
    enableReduxDevTools: boolean;
    enableReactDevTools: boolean;
  };
  backgroundJobs?: {
    reconnectDebounceMs?: number;
    pollIntervalMs?: number;
    description?: string;
  };
  network?: {
    pingIntervalMs?: number;
    pingTimeoutMs?: number;
    statusCheckTimeoutMs?: number;
    debounceStatusChangeMs?: number;
    adaptivePayload?: {
      enabled?: boolean;
      compressionEnabled?: boolean;
      compressionThresholdKb?: number;
      qualityTiers?: {
        fast?: { latencyMs?: number; useFullPayload?: boolean };
        good?: { latencyMs?: number; useFullPayload?: boolean };
        slow?: { latencyMs?: number; skipOptionalFields?: boolean };
        verySlow?: { latencyMs?: number; skipOptionalFields?: boolean };
      };
      description?: string;
    };
    description?: string;
  };
  api?: {
    requestTimeoutMs?: number;
    retryDelayMs?: number;
    staleTimeMs?: number;
    cacheTimeMs?: number;
    cleanupIntervalMs?: number;
    staleThresholdMs?: number;
    description?: string;
  };
  circuitBreaker?: {
    failures?: number;
    ratePercent?: number;
    rateWindowMs?: number;
    baseTimeoutMs?: number;
    maxTimeoutMs?: number;
    treatNetworkErrors?: boolean;
    description?: string;
  };
  sync?: {
    debounceMs?: number;
    retryBaseMs?: number;
    description?: string;
  };
  offline?: {
    enabled?: boolean;
    maxQueueSize?: number;
    maxRetries?: number;
    retryIntervalMs?: number;
    circuitBreakerThreshold?: number;
    circuitBreakerResetMs?: number;
    description?: string;
  };
  storage?: {
    cleanupIntervalMs?: number;
    description?: string;
  };
  ui?: {
    toastDurationMs?: number;
    syncToastDurationMs?: number;
    description?: string;
  };
  analytics?: {
    consent?: {
      defaultLevel?: string; // 'none' | 'basic' | 'full'
      description?: string;
    };
    buffer?: {
      enabled?: boolean;
      maxSize?: number;
      maxRetries?: number;
      batchSize?: number;
      retryBaseMs?: number;
      debounceMs?: number;
      batchDelayMs?: number;
      endpoint?: string | null;
      description?: string;
    };
    breadcrumbs?: {
      enabled?: boolean;
      provider?: string;
      maxBreadcrumbs?: number;
      batchSize?: number;
      maxRetries?: number;
      retryBaseMs?: number;
      debounceMs?: number;
      breadcrumbRetentionDays?: number;
      description?: string;
    };
    dispatch?: {
      async?: boolean;
      debounceMs?: number;
      queueSize?: number;
      timeout?: number;
      description?: string;
    };
    performanceBaseline?: {
      maxSamplesPerOp?: number;
      warmupSamples?: number;
      regressionThresholdPct?: number;
      percentileForCompare?: number;
      description?: string;
    };
    exporters?: {
      [exporterName: string]: any;
      description?: string;
    };
    description?: string;
  };
  thresholds?: {
    slowScreenMs?: number;
    slowRequestMs?: number;
  };
  remoteConfig?: {
    clockSkewToleranceMs?: number;
    entitlementPollIntervalMs?: number;
    description?: string;
  };
  safeMode?: {
    kernelTimeoutMs?: number;
    syncFailureThreshold?: number;
    storageHealthCheckIntervalMs?: number;
    authHealthCheckIntervalMs?: number;
    autoRecoveryAttempts?: number;
    autoRecoveryDelayMs?: number;
    description?: string;
  };
  entitlements?: {
    gracePeriodDays?: number;
    reminderWindowDays?: number;
    rereminderIntervalHours?: number;
    maxRemindersPerExpiry?: number;
    dryRunMode?: boolean;
    debugLogging?: boolean;
    description?: string;
  };
  featureFlags: Record<
    string,
    {
      enabled: boolean;
      description?: string;
      kind?: "free" | "premium" | "beta";
      dependsOn?: string[]; // Soft dependencies: array of flag names
      // Phase 3: Cohort membership (allow-list, OR logic: user must be in at least ONE of the listed cohorts)
      cohorts?: string[]; // E.g., ["beta_testers", "enterprise"] — flag enabled if user in ANY listed cohort; requires userId context
      // Phase 1: Simple conditions (AND logic)
      conditions?: {
        platform?: string; // 'web' | 'ios' | 'android' | 'desktop'
        environment?: string; // 'development' | 'production'
        userRole?: string; // Role name (e.g., 'admin', 'moderator')
      };
      // Phase 3: Advanced condition logic (OR, NOT, nested, custom evaluators)
      // Supports nested logical expressions with AND/OR/NOT operators
      conditionLogic?: {
        operator: "AND" | "OR" | "NOT";
        conditions?: any[]; // Nested conditions (recursive structure)
        condition?: any; // For NOT operator (unary)
      };
    } & Record<string, any> // Allow additional properties for specific flags
  >;
  services?: {
    auth?: {
      provider?: string; // 'supabase' (default) | future providers
      enabled?: boolean;
      description?: string;
    };
    database?: {
      provider?: string; // 'supabase' (default) | future: 'postgres', 'firebase'
      enabled?: boolean;
      description?: string;
    };
    analytics?: {
      provider?: string; // 'sentry' (default) | future providers
      enabled?: boolean;
      description?: string;
    };
    errorProvider?: {
      provider?: string; // 'sentry' (default) | future providers
      enabled?: boolean;
      description?: string;
    };
  };
  platforms?: {
    web?: Partial<AppSettings>;
    ios?: Partial<AppSettings>;
    android?: Partial<AppSettings>;
    desktop?: Partial<AppSettings>;
  };
}

let cachedConfig: AppSettings | null = null;

/**
 * Get the current app settings.
 * Respects EXPO_PUBLIC_ENVIRONMENT; defaults to 'production' for safety.
 * Result is cached after first call.
 *
 * **Migration Flow:**
 * 1. Load config file (JSON)
 * 2. Detect and validate version field (required)
 * 3. Auto-migrate to current version if version mismatch
 * 4. Validate migrated config structure
 * 5. Cache and return
 *
 * Throws if the required appsettings file is missing, malformed, version invalid, migration fails, or validation fails.
 */
export function getAppConfig(): AppSettings {
  if (cachedConfig) return cachedConfig;

  const environment = process.env.EXPO_PUBLIC_ENVIRONMENT || "production";
  let config: any;

  try {
    if (environment === "development") {
      config = require("../../config/appsettings.dev.json") as any;
    } else {
      config = require("../../config/appsettings.json") as any;
    }
  } catch (err) {
    const configFile =
      environment === "development"
        ? "config/appsettings.dev.json"
        : "config/appsettings.json";
    const errorMessage = err instanceof Error ? err.message : String(err);

    const failureMsg =
      environment === "development"
        ? `[AppConfig] Failed to load development settings (${configFile}). ` +
          "Ensure the file exists and is valid JSON. " +
          "Common causes: missing file, syntax error, or incorrect strip-dev-appsettings cleanup.\n" +
          `Original error: ${errorMessage}`
        : `[AppConfig] Failed to load production settings (${configFile}). ` +
          "This file is required and should be present in all production builds.\n" +
          `Original error: ${errorMessage}`;

    console.error(failureMsg);
    throw new Error(failureMsg);
  }

  // Detect config version (required field)
  const detectedVersion = config.version;
  // Validate version: must be a finite integer >= 1
  if (
    typeof detectedVersion !== "number" ||
    !Number.isFinite(detectedVersion) ||
    !Number.isInteger(detectedVersion) ||
    detectedVersion < 1
  ) {
    throw new Error(
      `[AppConfig] Invalid config version: ${String(detectedVersion)}. ` +
        "Expected a finite integer >= 1. " +
        `File: ${environment === "development" ? "config/appsettings.dev.json" : "config/appsettings.json"}`
    );
  }

  // Auto-migrate config to current version
  try {
    // Use the eagerly-imported migration helpers
    config = migrateConfig(config, detectedVersion, CURRENT_CONFIG_VERSION);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const configFile =
      environment === "development"
        ? "config/appsettings.dev.json"
        : "config/appsettings.json";

    const migrationFailMsg =
      `[AppConfig] Configuration migration failed (v${detectedVersion}). ` +
      `File: ${configFile}. ` +
      `Error: ${errorMessage}`;

    console.error(migrationFailMsg);
    throw new Error(migrationFailMsg);
  }

  // Apply platform-specific config overrides (merge locally to keep getAppConfig sync)
  try {
    const targetPlatform = getPlatformName();

    // If platforms section exists and platform is known, apply deep merge
    if (config.platforms && targetPlatform !== 'unknown') {
      const platformOverrides = (config.platforms as Record<string, Partial<AppSettings> | undefined>)[
        targetPlatform as string
      ];

      if (platformOverrides) {
        // Local deep merge implementation (non-mutating)
        const deepMergeConfigs = <T extends Record<string, any>>(base: T, override: Partial<T> | undefined): T => {
          if (!override) return { ...base };
          const result: any = { ...base };
          /* eslint-disable security/detect-object-injection -- safe: merging config keys from trusted config files */
          for (const key in override) {
            if (!Object.prototype.hasOwnProperty.call(override, key)) continue;
            const overrideValue = (override as any)[key];
            if (overrideValue === null || overrideValue === undefined) continue;

            if (
              typeof overrideValue === 'object' &&
              !Array.isArray(overrideValue) &&
              typeof result[key] === 'object' &&
              !Array.isArray(result[key]) &&
              result[key] !== null
            ) {
               
              result[key] = deepMergeConfigs(result[key], overrideValue as any);
            } else {
               
              result[key] = overrideValue;
            }
          }

          return result as T;
        };

        config = deepMergeConfigs(config as AppSettings, platformOverrides as Partial<AppSettings>);
      }
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    const configFile =
      environment === "development"
        ? "config/appsettings.dev.json"
        : "config/appsettings.json";

    const platformMergeFailMsg =
      `[AppConfig] Platform config merge failed. ` +
      `File: ${configFile}. ` +
      `Error: ${errorMessage}`;

    console.error(platformMergeFailMsg);
    throw new Error(platformMergeFailMsg);
  }

  // Validate that the migrated config has the expected structure
  const versionValid =
    typeof config.version === "number" &&
    Number.isFinite(config.version) &&
    Number.isInteger(config.version) &&
    config.version >= 1;

  const environmentValid = !!config.environment;
  const featuresValid = !!config.features;
  const overridesValid = !!config.overrides;
  const devToolsValid = !!config.devTools;

  if (!versionValid || !environmentValid || !featuresValid || !overridesValid || !devToolsValid) {
    const missingFields = [];
    if (!versionValid) missingFields.push("version (invalid or missing)");
    if (!environmentValid) missingFields.push("environment");
    if (!featuresValid) missingFields.push("features");
    if (!overridesValid) missingFields.push("overrides");
    if (!devToolsValid) missingFields.push("devTools");

    const configFile =
      environment === "development"
        ? "config/appsettings.dev.json"
        : "config/appsettings.json";
    const validationMsg =
      `[AppConfig] ${configFile} validation failed after migration. Missing required fields: ${missingFields.join(", ")}. ` +
      "Ensure the file matches the AppSettings interface and migration completed successfully.";

    console.error(validationMsg);
    throw new Error(validationMsg);
  }

  cachedConfig = config as AppSettings;
  return cachedConfig;
}

/**
 * Checks if we're in development mode.
 * Useful for compile-time guards.
 */
export function isDevelopment(): boolean {
  // Prefer build-time bundler flag when available (React Native/Expo):
  // `__DEV__` is set in development builds by Metro/Expo bundler. Use it
  // to surface dev-only warnings even when EXPO_PUBLIC_ENVIRONMENT isn't set.
  // Fallbacks:
  //  - EXPO_PUBLIC_ENVIRONMENT env var
  //  - already-loaded cached config (if getAppConfig() was called)
  // This makes the helper robust for both dev builds and dev-config scenarios.
  try {
    const devFlag = (typeof (global as any).__DEV__ !== "undefined" && (global as any).__DEV__ === true) ||
      (typeof __DEV__ !== "undefined" && __DEV__ === true);
    if (devFlag) return true;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  } catch (e) {
    // ignore - globals might not be available in some test environments
  }

  if (process.env.EXPO_PUBLIC_ENVIRONMENT === "development") return true;
  if (cachedConfig && cachedConfig.environment === "development") return true;
  return false;
}

/**
 * Checks if we're in production mode.
 * Use this to ensure code paths are safe for production.
 */
export function isProduction(): boolean {
  return (process.env.EXPO_PUBLIC_ENVIRONMENT || "production") === "production";
}

/**
 * Reset the cached config (dev-only utility)
 * Used by config validation tools to reload config for different environments.
 * Not intended for production use.
 * @internal
 */
export function resetCachedConfig(): void {
  cachedConfig = null;
}

// =============================================================================
// Configuration Validation
// (Previously config-validator.ts — merged here as validation is tightly coupled
//  with loading and runs immediately after getAppConfig())
// =============================================================================

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
 */
const REQUIRED_ENV_VARS: Record<"production" | "development", string[]> = {
  production: [
    "EXPO_PUBLIC_SUPABASE_URL",
    "EXPO_PUBLIC_SUPABASE_ANON_KEY",
  ],
  development: [],
};

const REQUIRED_FEATURES: (keyof AppSettings["features"])[] = [
  "consoleLogging",
  "devBypass",
  "mockData",
  "performanceMonitoring",
];

const REQUIRED_OVERRIDES: (keyof AppSettings["overrides"])[] = [
  "mockSupabase",
  "verboseErrorMessages",
];

const REQUIRED_DEV_TOOLS: (keyof AppSettings["devTools"])[] = [
  "enableConsoleLogger",
  "enableNetworkLogger",
  "enablePerformanceLogger",
  "enableReduxDevTools",
  "enableReactDevTools",
];

const REQUIRED_FEATURE_FLAGS = [
  "splashScreen",
  "debugLogs",
  "loggerCategories",
];

function validateEnvironmentVariables(
  environment: "development" | "production",
): ConfigValidationResult {
  const result: ConfigValidationResult = { valid: true, errors: [], warnings: [] };
  const required = REQUIRED_ENV_VARS[environment as "production" | "development"] || [];
  const expoExtra = Constants.expoConfig?.extra || {};

  for (const envVar of required) {
     
    const envValue = (process.env as Record<string, string | undefined>)[envVar];
    let hasValue = !!envValue;
    if (!hasValue && envVar === "EXPO_PUBLIC_SUPABASE_URL") {
      hasValue = !!(expoExtra.supabaseUrl && expoExtra.supabaseUrl.length > 0);
    }
    if (!hasValue && envVar === "EXPO_PUBLIC_SUPABASE_ANON_KEY") {
      hasValue = !!(expoExtra.supabaseAnonKey && expoExtra.supabaseAnonKey.length > 0);
    }
    if (!hasValue) {
      result.valid = false;
      result.errors.push(
        `Missing required environment variable: ${envVar}. ` +
          `This is critical for DND-Toolkit to function in ${environment} mode.`,
      );
    }
  }

  if (environment === "production" && !process.env.EXPO_PUBLIC_SENTRY_DSN) {
    result.warnings.push(
      "EXPO_PUBLIC_SENTRY_DSN is not set. Error tracking will not work. " +
        "Set it in your deployment environment if you want production error monitoring.",
    );
  }

  return result;
}

/**
 * Validates app settings structure and values
 */
export function validateAppSettings(config: AppSettings): ConfigValidationResult {
  const result: ConfigValidationResult = { valid: true, errors: [], warnings: [] };

  const requiredFields: (keyof AppSettings)[] = [
    "environment", "features", "overrides", "devTools", "featureFlags", "thresholds",
  ];
  for (const field of requiredFields) {
     
    const value = config[field];
    if (value === undefined || value === null) {
      result.valid = false;
      result.errors.push(`Missing required config field: ${field}`);
    }
  }

  if (config.environment !== "production" && config.environment !== "development") {
    result.valid = false;
    result.errors.push(
      `Invalid environment: ${config.environment}. Must be either "production" or "development".`,
    );
  }

  const envFromVar = process.env.EXPO_PUBLIC_ENVIRONMENT || "production";
  if (process.env.EXPO_PUBLIC_ENVIRONMENT && config.environment !== envFromVar) {
    result.valid = false;
    result.errors.push(
      `Config environment mismatch: env variable is "${envFromVar}" but config says "${config.environment}". ` +
        "Ensure you are loading the correct config file (appsettings.dev.json vs appsettings.json).",
    );
  }

  if (typeof config.features !== "object" || config.features === null) {
    result.valid = false;
    result.errors.push("features must be an object");
  } else {
    for (const feature of REQUIRED_FEATURES) {
      if (!(feature in config.features)) {
        result.valid = false;
        result.errors.push(`Missing required feature: features.${feature}`);
      }
    }
  }

  if (typeof config.overrides !== "object" || config.overrides === null) {
    result.valid = false;
    result.errors.push("overrides must be an object");
  } else {
    for (const override of REQUIRED_OVERRIDES) {
      if (!(override in config.overrides)) {
        result.valid = false;
        result.errors.push(`Missing required override: overrides.${override}`);
      }
    }
  }

  if (typeof config.devTools !== "object" || config.devTools === null) {
    result.valid = false;
    result.errors.push("devTools must be an object");
  } else {
    for (const tool of REQUIRED_DEV_TOOLS) {
      if (!(tool in config.devTools)) {
        result.valid = false;
        result.errors.push(`Missing required dev tool: devTools.${tool}`);
      }
    }
  }

  if (typeof config.featureFlags !== "object" || config.featureFlags === null) {
    result.valid = false;
    result.errors.push("featureFlags must be an object");
  } else {
    for (const flagName of REQUIRED_FEATURE_FLAGS) {
      if (!(flagName in config.featureFlags)) {
        result.valid = false;
        result.errors.push(`Missing required feature flag: featureFlags.${flagName}`);
      }
    }
    for (const [flagName, flagConfig] of Object.entries(config.featureFlags)) {
      if (typeof flagConfig !== "object" || flagConfig === null) {
        result.valid = false;
        result.errors.push(`Invalid feature flag "${flagName}": must be an object`);
      } else if (!("enabled" in flagConfig)) {
        result.valid = false;
        result.errors.push(`Feature flag "${flagName}" missing required "enabled" field`);
      }
      if (flagName === "loggerCategories" && flagConfig && typeof flagConfig === "object") {
        const categories = (flagConfig as any).categories;
        if (categories && typeof categories === "object") {
          const requiredCategories = [
            "auth", "navigation", "api", "performance", "storage", "ui",
            "analytics", "security", "bootstrap", "error", "feature_flags",
            "database", "offline", "jobs", "buckets", "realtime", "other",
          ];
          for (const cat of requiredCategories) {
            if (!(cat in categories)) {
              result.valid = false;
              result.errors.push(`Feature flag "loggerCategories" missing required category: ${cat}`);
            }
          }
        }
      }
    }
  }

  if (config.thresholds && typeof config.thresholds !== "object") {
    result.valid = false;
    result.errors.push("thresholds must be an object");
  }

  const VALID_PLATFORM_NAMES = ["web", "ios", "android", "desktop"];
  if (config.platforms) {
    if (typeof config.platforms !== "object") {
      result.valid = false;
      result.errors.push("platforms must be an object");
    } else {
      for (const platformName of Object.keys(config.platforms)) {
        if (!VALID_PLATFORM_NAMES.includes(platformName)) {
          result.valid = false;
          result.errors.push(
            `Invalid platform name: "${platformName}". Valid platforms are: ${VALID_PLATFORM_NAMES.join(", ")}.`
          );
        }
         
        const platformConfig = (config.platforms as any)[platformName];
        if (platformConfig !== undefined && typeof platformConfig !== "object") {
          result.valid = false;
          result.errors.push(`platforms.${platformName} must be an object (Partial<AppSettings>)`);
        }
      }
    }
  }

  if (config.environment === "production") {
    if (config.features.devBypass) {
      result.warnings.push(
        "⚠️ devBypass is ENABLED in production - this is a critical security risk! " +
          "Users can bypass authentication. This should NEVER be true in production.",
      );
      result.valid = false;
    }
    if (config.features.mockData) {
      result.warnings.push(
        "⚠️ mockData is ENABLED in production - this will serve incorrect game data! " +
          "Players will see mock worlds and campaigns instead of real data.",
      );
      result.valid = false;
    }
    if (config.overrides.verboseErrorMessages) {
      result.warnings.push(
        "⚠️ verboseErrorMessages is ENABLED in production - " +
          "this may expose sensitive information to end users.",
      );
    }
    if (config.devTools.enableConsoleLogger) {
      result.warnings.push(
        "Development console logging is enabled in production config. " +
          "This is usually fine but review for any PII that might be logged.",
      );
    }
  }

  return result;
}

/**
 * Validate the complete app configuration for DND-Toolkit.
 * Called during kernel initialization (Phase 0, before preload).
 */
export function validateConfig(config: AppSettings): ConfigValidationResult {
  const result: ConfigValidationResult = { valid: true, errors: [], warnings: [] };
  const envResult = validateEnvironmentVariables(config.environment);
  const settingsResult = validateAppSettings(config);
  result.errors.push(...envResult.errors, ...settingsResult.errors);
  result.warnings.push(...envResult.warnings, ...settingsResult.warnings);
  result.valid = envResult.valid && settingsResult.valid;
  return result;
}

/**
 * Log validation results using the logger system.
 * Errors prevent app startup; warnings are logged but don't block.
 */
export function logValidationResults(result: ConfigValidationResult): void {
  if (result.errors.length > 0) {
    getLogger().category("bootstrap").error(
      `Configuration validation FAILED with ${result.errors.length} error(s):`,
    );
    for (const error of result.errors) {
      getLogger().category("bootstrap").error(`  ❌ ${error}`);
    }
  }
  if (result.warnings.length > 0) {
    getLogger().category("bootstrap").warn(
      `Configuration validation has ${result.warnings.length} warning(s):`,
    );
    for (const warning of result.warnings) {
      getLogger().category("bootstrap").warn(`  ⚠️ ${warning}`);
    }
  }
  if (result.valid && result.errors.length === 0) {
    getLogger().category("bootstrap").info("✅ Configuration validated successfully");
  }
}
