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
  version: number;
  description: string;
  environment: "development" | "production";
  features: {
    consoleLogging: boolean;
    devBypass: boolean;
    mockData: boolean;
    performanceMonitoring: boolean;
    sentryEnabled: boolean;
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
  backgroundJobs?: {
    reconnectDebounceMs?: number;
    pollIntervalMs?: number;
    description?: string;
  };
  network?: {
    pingIntervalMs?: number;
    pingTimeoutMs?: number;
    statusCheckTimeoutMs?: number;
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
  storage?: {
    cleanupIntervalMs?: number;
    description?: string;
  };
  ui?: {
    toastDurationMs?: number;
    syncToastDurationMs?: number;
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
    } & Record<string, any> // Allow additional properties for specific flags
  >;
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
    const { migrateConfig, CURRENT_CONFIG_VERSION } = require("./migrations");
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

  // Apply platform-specific config overrides
  try {
    const { mergeConfigForPlatform } = require("./platform-config");
    config = mergeConfigForPlatform(config as AppSettings);
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
  return process.env.EXPO_PUBLIC_ENVIRONMENT === "development";
}

/**
 * Checks if we're in production mode.
 * Use this to ensure code paths are safe for production.
 */
export function isProduction(): boolean {
  return (process.env.EXPO_PUBLIC_ENVIRONMENT || "production") === "production";
}
