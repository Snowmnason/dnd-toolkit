/**
 * Storage Module
 *
 * Centralized storage access for all app data.
 *
 * All storage goes through SecureStorage which respects STORAGE_BACKEND_CONFIG:
 * - localStorage: Persistent auth/user data (sensitive, encrypted via EncryptedStorage)
 * - sessionStorage: Ephemeral query cache and metadata (faster, unencrypted)
 * - secure: Encrypted backend (default for sensitive data)
 *
 * Usage:
 * ```ts
 * import { SecureStorage, STORAGE_KEYS, getPrivacyStorageBackend } from '@/lib/storage';
 *
 * // Store data (backend routing is automatic)
 * await SecureStorage.setItem(STORAGE_KEYS.CONNECTED_WORLDS, worldIds);
 *
 * // Or route backend manually based on privacy classification
 * const backend = getPrivacyStorageBackend(STORAGE_KEYS.THEME_PREFERENCE);
 * await backend.setItem(STORAGE_KEYS.THEME_PREFERENCE, 'classic');
 *
 * // Store JSON
 * await SecureStorage.setJSON(STORAGE_KEYS.USER_PREFERENCES, { theme: 'dark' });
 *
 * // Retrieve data
 * const worldIds = await SecureStorage.getItem(STORAGE_KEYS.CONNECTED_WORLDS);
 * const prefs = await SecureStorage.getJSON(STORAGE_KEYS.USER_PREFERENCES);
 * ```
 *
 * Storage routing is defined in:
 * - STORAGE_BACKEND_CONFIG (storage-config.ts) - low-level backend routing
 * - DATA_CLASSIFICATIONS (data-classification.ts) - privacy-based routing (use this for app code)
 *
 * Add new keys to DATA_CLASSIFICATIONS when extending storage.
 */

export {
    DATA_CLASSIFICATIONS,
    DataSensitivity,
    validateClassifications,
    type DataClassification
} from "./data-classification";
export { FastCache } from "./FastCache";
export {
    classifyKey,
    clearAllUserData,
    getKeysBySensitivity,
    getStorageBackend as getPrivacyStorageBackend,
    getRetentionInfo,
    getSensitiveKeys,
    isSensitiveData,
    redactForLogs,
    shouldUseSecureStorage
} from "./privacy";
export { SecureStorage } from "./SecureStorage";
export { STORAGE_BACKEND_CONFIG, type StorageBackend } from "./storage-config";
export {
    batchStorageOperation,
    checkStorageHealth,
    classifyStorageError,
    handleStorageErrorGracefully,
    isStorageError,
    logStorageError,
    safeStorageGet,
    safeStorageGetJSON,
    safeStorageRemove,
    safeStorageSet,
    safeStorageSetJSON,
    shouldServeFallbackOnStorageError,
    type BatchStorageResult,
    type StorageErrorInfo,
    type StorageGracefulResult,
    type StorageOperation,
    type StorageOperationOptions
} from "./storage-error-handling";
export { updateStorageCache } from "./update-storage-cache";

/**
 * Storage Keys
 *
 * Centralized key constants with namespacing.
 * Format: dnd:<domain>:<key>
 *
 * NEVER use raw string keys - always use these constants.
 *
 * Backend routing for these keys is configured in STORAGE_BACKEND_CONFIG.
 * See storage-config.ts for the complete routing strategy.
 */
export const STORAGE_KEYS = {
  // ========== PERSISTENT (localStorage) - Sensitive Auth/User Data ==========

  // App-level data
  CONNECTED_WORLDS: "dnd:app:connected_worlds",
  CONNECTED_WORLDS_METADATA: "dnd:app:connected_worlds_metadata",

  // Auth-related data
  HAS_ACCOUNT: "dnd:auth:has_account",
  AUTH_SESSION: "dnd:auth:session", // Supabase session tokens (web platform workaround for persistSession=false)
  USER_DATA: "dnd:auth:user_data",
  USER_DATA_META: "dnd:auth:user_data_meta",
  USER_DATA_TIMESTAMP: "dnd:auth:user_data_timestamp",
  LAST_LOGGED_IN: "dnd:auth:last_logged_in", // Timestamp of last successful sign-in

  // Auth attempt rate limiting
  AUTH_ATTEMPTS: "dnd:auth:attempts",

  // Invites - important auth flow state
  PENDING_INVITE: "dnd:invite:pending",

  // Session email cache
  SESSION_USER_EMAIL: "dnd_session_user_email",

  // User preferences - must persist
  THEME_PREFERENCE: "dnd:user:theme",
  THEME_MODE: "dnd:user:theme_mode",
  SCALE_PREFERENCE: "dnd:user:scale",

  // Feature flags / dev settings
  DEV_MODE: "dnd:dev:mode",

  // ========== EPHEMERAL (sessionStorage) - Query Cache & Metadata ==========
  // Note: These are pattern prefixes; actual keys use these prefixes
  // See results.md for examples: query_cache_worlds:ids:*, world_access_*, etc.

  // Session state (volatile, refetchable)
  LAST_SELECTED_WORLD: "dnd:session:last_selected_world",
  LAST_USER_ROLE: "dnd:session:last_user_role",

  // Safe mode diagnostics (transient, cleared when user recovers or restarts)
  SAFE_MODE_DIAGNOSTICS: "dnd:session:safe_mode_diagnostics",

  // Offline request queue (persistent, survives app restart)
  OFFLINE_QUEUE: "dnd:api:offline_queue",

  // Network recovery state (retry count, backoff timing)
  NETWORK_RECOVERY_STATE: "dnd:network:recovery_state",

  // Feature flags and premium entitlements
  FEATURE_FLAGS: "dnd:feature_flags:v1",
  ENTITLEMENTS: "dnd:entitlements:v1",
  CLOCK_INVALID: "dnd:clock_invalid",

  // Add more keys as needed...
} as const;

/**
 * Legacy keys (for reference - DO NOT USE in new code)
 * These are old unrouted localStorage keys that should be migrated
 */
export const LEGACY_KEYS = {
  CONNECTED_WORLDS: "dnd_connected_worlds",
  HAS_ACCOUNT: "hasAccount",
  USER_DATA: "userData",
  USER_DATA_TIMESTAMP: "userDataTimestamp",
} as const;
