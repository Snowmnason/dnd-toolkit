/**
 * Storage Defaults Configuration
 *
 * Centralized definition of default values for all storage keys.
 * This makes it easy to:
 * - See the expected structure of each storage key at a glance
 * - Update defaults across the codebase in one place
 * - Understand what the "zero state" is for each feature
 * - Validate storage migrations
 *
 * NOTE: Storage keys are inlined to avoid circular dependency with lib/storage/index.ts
 * If updating keys, ensure both this file and STORAGE_KEYS in lib/storage/index.ts are in sync
 */

/**
 * Storage key constants (inlined to avoid circular dependency)
 * Must match STORAGE_KEYS in lib/storage/index.ts
 */
const STORAGE_KEY_CONSTANTS = {
  // World Management
  CONNECTED_WORLDS: "dnd:app:connected_worlds",
  LAST_SELECTED_WORLD: "dnd:app:last_selected_world",
  LAST_USER_ROLE: "dnd:app:last_user_role",

  // Authentication & Account
  HAS_ACCOUNT: "dnd:auth:has_account",
  USER_DATA: "dnd:auth:user_data",
  USER_DATA_TIMESTAMP: "dnd:auth:user_data_timestamp",
  LAST_LOGGED_IN: "dnd:auth:last_logged_in",
  AUTH_ATTEMPTS: "dnd:auth:attempts",
  PENDING_INVITE: "dnd:invite:pending",

  // UI Preferences
  THEME_PREFERENCE: "dnd:user:theme",
  THEME_MODE: "dnd:user:theme_mode",
  SCALE_PREFERENCE: "dnd:user:scale",

  // Developer
  DEV_MODE: "dnd:dev:mode",
} as const;

/**
 * Default value type for each storage key
 * - string: JSON-serialized value to store
 * - null: Key should not be initialized (can be absent from storage)
 */
export type StorageDefaultValue = string | null;

/**
 * Storage defaults mapped by key constant strings
 *
 * Format:
 * - `string`: JSON-serialized default (will be stored as-is)
 * - `null`: Key is optional and should not be initialized
 *
 * Built using inlined constants to avoid circular dependency on STORAGE_KEYS
 */
function createStorageDefaults(): Record<string, StorageDefaultValue> {
  return {
    // World Management
    [STORAGE_KEY_CONSTANTS.CONNECTED_WORLDS]: JSON.stringify([]),
    [STORAGE_KEY_CONSTANTS.LAST_SELECTED_WORLD]: null,
    [STORAGE_KEY_CONSTANTS.LAST_USER_ROLE]: null,

    // Authentication & Account
    [STORAGE_KEY_CONSTANTS.HAS_ACCOUNT]: JSON.stringify(false),
    [STORAGE_KEY_CONSTANTS.USER_DATA]: null,
    [STORAGE_KEY_CONSTANTS.USER_DATA_TIMESTAMP]: JSON.stringify(0),
    [STORAGE_KEY_CONSTANTS.LAST_LOGGED_IN]: JSON.stringify(null),
    [STORAGE_KEY_CONSTANTS.AUTH_ATTEMPTS]: JSON.stringify(0),
    [STORAGE_KEY_CONSTANTS.PENDING_INVITE]: null,

    // UI Preferences
    [STORAGE_KEY_CONSTANTS.THEME_PREFERENCE]: JSON.stringify("classic"),
    [STORAGE_KEY_CONSTANTS.THEME_MODE]: JSON.stringify("dark"),
    [STORAGE_KEY_CONSTANTS.SCALE_PREFERENCE]: JSON.stringify(1),

    // Developer
    [STORAGE_KEY_CONSTANTS.DEV_MODE]: JSON.stringify(false),
  };
}

// Cache storage defaults (immutable after first access)
const STORAGE_DEFAULTS_CACHE = createStorageDefaults();

export function getStorageDefaults(): Record<string, StorageDefaultValue> {
  return STORAGE_DEFAULTS_CACHE;
}

/**
 * Get default value for a storage key
 * @param key The storage key
 * @returns The default value, or null if key is optional
 */
export function getStorageDefault(key: string): StorageDefaultValue {
  return STORAGE_DEFAULTS_CACHE[key] ?? null;
}

/**
 * Check if a storage key should be initialized with a default value
 * @param key The storage key
 * @returns true if the key should be initialized, false if it's optional
 */
export function shouldInitializeStorageKey(key: string): boolean {
  return STORAGE_DEFAULTS_CACHE[key] !== null;
}

/**
 * Get all keys that should be initialized
 * Useful for resetting storage to defaults or validating initial state
 */
export function getRequiredStorageKeys(): string[] {
  return Object.entries(STORAGE_DEFAULTS_CACHE)
    .filter(([, value]) => value !== null)
    .map(([key]) => key);
}

/**
 * Get all optional storage keys (can be absent)
 * Useful for cleanup or migration logic
 */
export function getOptionalStorageKeys(): string[] {
  return Object.entries(STORAGE_DEFAULTS_CACHE)
    .filter(([, value]) => value === null)
    .map(([key]) => key);
}
