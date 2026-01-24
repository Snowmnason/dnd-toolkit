/**
 * Config Module - Barrel Export
 *
 * Environment-aware configuration management with validation and dev-only utilities.
 * See README.md for comprehensive API documentation.
 */

// Loader: Environment-aware config loading
export { getAppConfig, isDevelopment, isProduction } from "./loader";
export type { AppSettings } from "./loader";

// Validator: Configuration validation at app startup
export { logValidationResults, validateConfig } from "./config-validator";
export type { ConfigValidationResult } from "./config-validator";

// Dev-Only: Safe dev utilities with no-op production versions
export {
    createDevTimer, devAssert, isDevBypassEnabled, useDevConsole
} from "./dev-only";

