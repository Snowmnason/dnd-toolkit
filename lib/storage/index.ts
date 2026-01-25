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
 * import { SecureStorage, STORAGE_KEYS } from '@/lib/storage';
 *
 * // Store data (backend routing is automatic)
 * await SecureStorage.setItem(STORAGE_KEYS.CONNECTED_WORLDS, worldIds);
 *
 * // Store JSON
 * await SecureStorage.setJSON(STORAGE_KEYS.USER_PREFERENCES, { theme: 'dark' });
 *
 * // Retrieve data
 * const worldIds = await SecureStorage.getItem(STORAGE_KEYS.CONNECTED_WORLDS);
 * const prefs = await SecureStorage.getJSON(STORAGE_KEYS.USER_PREFERENCES);
 * ```
 *
 * Storage routing is defined in STORAGE_BACKEND_CONFIG (storage-config.ts).
 * Add new keys there when extending storage.
 */

export { FastCache } from "./FastCache";
export { SecureStorage } from "./SecureStorage";
export {
  getStorageBackend,
  STORAGE_BACKEND_CONFIG,
  type StorageBackend
} from "./storage-config";
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

  // Auth-related data
  HAS_ACCOUNT: "dnd:auth:has_account",
  USER_DATA: "dnd:auth:user_data",
  USER_DATA_META: "dnd:auth:user_data_meta",
  USER_DATA_TIMESTAMP: "dnd:auth:user_data_timestamp",
  LAST_LOGGED_IN: "dnd:auth:last_logged_in", // Timestamp of last successful sign-in

  // Auth attempt rate limiting
  AUTH_ATTEMPTS: "dnd:auth:attempts",

  // Invites - important auth flow state
  PENDING_INVITE: "dnd:invite:pending",

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
