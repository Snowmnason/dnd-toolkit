/**
 * Config Module - Barrel Export
 *
 * Environment-aware configuration management with validation and dev-only utilities.
 * See README.md for comprehensive API documentation.
 */

// Loader: Environment-aware config loading + validation
export { getAppConfig, isDevelopment, isProduction, logValidationResults, resetCachedConfig, validateAppSettings, validateConfig } from "./core/loader";
export type { AppSettings, ConfigValidationResult } from "./core/loader";

// Dev: Runtime dev utilities + config hot-reload (no-ops in production)
export {
    ConfigHotReload, createDevConsole, createDevTimer, devAssert, getHotReload, initializeHotReload, isDevBypassEnabled, isHotReloadAvailable
} from "./dev/dev";

// Tools: Schema drift detection and config comparison
export { getConfigDiff, mapExpectedDifferences, validateConfigSchema } from "./dev/tools/config-diff";
export type { DiffEntry, SchemaIssue } from "./dev/tools/config-diff";

export { getPlatformName, mergeConfigForPlatform } from "./core/platform-config";


// Routing Module: Route authentication configuration and path validation.
export * from "./routing-auth-config";
// Storage Config
export { getStorageBackend, STORAGE_BACKEND_CONFIG, type StorageBackend } from "./storage-backends-config";
// Database Request Defaults
export { dbRequestOptions } from "./database-request-defaults";
// Offline Sync Defaults
export { OFFLINE_SYNC_DEFAULTS } from "./offline-defaults";
// Analytics Defaults
export { ANALYTICS_RETRY_DEFAULTS, CONSENT_SYNC_DEFAULTS } from "./analytics-defaults";

