/**
 * Storage Defaults Configuration
 *
 * Centralized definition of default values for all storage keys.
 * This makes it easy to:
 * - See the expected structure of each storage key at a glance
 * - Update defaults across the codebase in one place
 * - Understand what the "zero state" is for each feature
 * - Validate storage migrations
 */

/**
 * Default value type for each storage key
 * - string: JSON-serialized value to store
 * - null: Key should not be initialized (can be absent from storage)
 */
export type StorageDefaultValue = string | null;

/**
 * Storage defaults mapped by STORAGE_KEYS
 * Lazily constructed to avoid circular dependency on STORAGE_KEYS initialization
 *
 * Format:
 * - `string`: JSON-serialized default (will be stored as-is)
 * - `null`: Key is optional and should not be initialized
 */
function createStorageDefaults(): Record<string, StorageDefaultValue> {
  // Lazy-import to avoid circular dependency
  const { STORAGE_KEYS } = require("@/lib/storage");

  return {
    // World Management
    [STORAGE_KEYS.CONNECTED_WORLDS]: JSON.stringify([]),
    [STORAGE_KEYS.LAST_SELECTED_WORLD]: null,
    [STORAGE_KEYS.LAST_USER_ROLE]: null,

    // Authentication & Account
    [STORAGE_KEYS.HAS_ACCOUNT]: JSON.stringify(false),
    [STORAGE_KEYS.USER_DATA]: null,
    [STORAGE_KEYS.USER_DATA_TIMESTAMP]: JSON.stringify(0),
    [STORAGE_KEYS.LAST_LOGGED_IN]: JSON.stringify(null),
    [STORAGE_KEYS.AUTH_ATTEMPTS]: JSON.stringify(0),
    [STORAGE_KEYS.PENDING_INVITE]: null,

    // UI Preferences
    [STORAGE_KEYS.THEME_PREFERENCE]: JSON.stringify("classic"),
    [STORAGE_KEYS.THEME_MODE]: JSON.stringify("dark"),
    [STORAGE_KEYS.SCALE_PREFERENCE]: JSON.stringify(1),

    // Developer
    [STORAGE_KEYS.DEV_MODE]: JSON.stringify(false),
  };
}

// Lazy-load storage defaults on first access
let STORAGE_DEFAULTS_CACHE: Record<string, StorageDefaultValue> | null = null;

export function getStorageDefaults(): Record<string, StorageDefaultValue> {
  if (!STORAGE_DEFAULTS_CACHE) {
    STORAGE_DEFAULTS_CACHE = createStorageDefaults();
  }
  return STORAGE_DEFAULTS_CACHE;
}

/**
 * Get default value for a storage key
 * @param key The storage key
 * @returns The default value, or null if key is optional
 */
export function getStorageDefault(key: string): StorageDefaultValue {
  return getStorageDefaults()[key] ?? null;
}

/**
 * Check if a storage key should be initialized with a default value
 * @param key The storage key
 * @returns true if the key should be initialized, false if it's optional
 */
export function shouldInitializeStorageKey(key: string): boolean {
  return getStorageDefaults()[key] !== null;
}

/**
 * Get all keys that should be initialized
 * Useful for resetting storage to defaults or validating initial state
 */
export function getRequiredStorageKeys(): string[] {
  return Object.entries(getStorageDefaults())
    .filter(([, value]) => value !== null)
    .map(([key]) => key);
}

/**
 * Get all optional storage keys (can be absent)
 * Useful for cleanup or migration logic
 */
export function getOptionalStorageKeys(): string[] {
  return Object.entries(getStorageDefaults())
    .filter(([, value]) => value === null)
    .map(([key]) => key);
}
