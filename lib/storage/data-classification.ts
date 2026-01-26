/**
 * Data Classification System
 *
 * Defines sensitivity levels for all user data stored in the app.
 * Every storage key must be registered here to ensure consistent handling
 * across SecureStorage, FastCache, logging, and data deletion workflows.
 *
 * See docs/issues/MileStone 2/168 - Privacy PII Data/PRIVACY.md for policy documentation.
 */

/**
 * Data sensitivity levels determine storage backend and handling.
 */
export enum DataSensitivity {
  /**
   * PUBLIC - Non-sensitive, okay to cache, no PII
   * Examples: app version, feature flags (non-user-specific), theme preference
   * Storage: FastCache (fast, unencrypted)
   * Retention: No retention limit
   * Logging: Safe to log
   */
  PUBLIC = "public",

  /**
   * NON_SENSITIVE - App data that doesn't contain user-specific PII
   * Must persist across app restarts (encrypted + persistent storage)
   * Examples: user's theme preference, UI scale, world metadata, character templates
   * Storage: SecureStorage (encrypted, persists across restarts)
   * Retention: Persists until user clears app data or logs out
   * Logging: Safe to log (no user IDs embedded)
   */
  NON_SENSITIVE = "non-sensitive",

  /**
   * SENSITIVE - User-scoped data, but not highly personal
   * Examples: user's world list, character sheet data, entitlements
   * Storage: SecureStorage (encrypted on all platforms)
   * Retention: Clear on logout
   * Logging: Redact user IDs, world names from logs
   */
  SENSITIVE = "sensitive",

  /**
   * PII - Personally identifiable information, highly sensitive
   * Examples: email, password hash, authentication tokens, session ID
   * Storage: SecureStorage only, encrypted
   * Retention: Clear immediately on logout
   * Logging: Never log (redact completely)
   */
  PII = "pii",
}

export interface DataClassification {
  key: string; // storage key (e.g., 'feature_flags:v1')
  sensitivity: DataSensitivity;
  description: string;
  ttl?: number; // time-to-live in ms; null = no expiry
  redactionPattern?: RegExp; // regex to redact value in logs
}

/**
 * Master classification registry.
 * Every storage key used in the app must be registered here.
 *
 * Guidelines:
 * - PUBLIC → FastCache (unencrypted, session-only)
 * - SENSITIVE, PII, NON_SENSITIVE → SecureStorage (encrypted, persists)
 * - If unsure, default to SENSITIVE
 */
export const DATA_CLASSIFICATIONS: Record<string, DataClassification> = {
  // ========== APP & VERSION ==========
  "app:version": {
    key: "app:version",
    sensitivity: DataSensitivity.PUBLIC,
    description: "Current app version",
  },

  // ========== FEATURE FLAGS & ENTITLEMENTS ==========
  "feature_flags:v1": {
    key: "feature_flags:v1",
    sensitivity: DataSensitivity.NON_SENSITIVE,
    description: "Cached feature flags (non-user-specific)",
    ttl: 24 * 60 * 60 * 1000, // 24h
  },

  "secure:entitlements": {
    key: "secure:entitlements",
    sensitivity: DataSensitivity.SENSITIVE,
    description: "User premium entitlements",
    ttl: 7 * 24 * 60 * 60 * 1000, // 7 days
  },

  // ========== AUTHENTICATION & ACCOUNT ==========
  "dnd:auth:has_account": {
    key: "dnd:auth:has_account",
    sensitivity: DataSensitivity.SENSITIVE,
    description: "Whether user has created an account",
  },

  "dnd:auth:user_data": {
    key: "dnd:auth:user_data",
    sensitivity: DataSensitivity.SENSITIVE,
    description: "User profile data (ID, email, etc.)",
  },

  "dnd:auth:user_data_meta": {
    key: "dnd:auth:user_data_meta",
    sensitivity: DataSensitivity.SENSITIVE,
    description: "Metadata for user profile cache (timestamp, version)",
  },

  "dnd:auth:user_data_timestamp": {
    key: "dnd:auth:user_data_timestamp",
    sensitivity: DataSensitivity.SENSITIVE,
    description: "Timestamp of last user data update",
  },

  "dnd:auth:last_logged_in": {
    key: "dnd:auth:last_logged_in",
    sensitivity: DataSensitivity.SENSITIVE,
    description: "Timestamp of last successful login",
  },

  "dnd:auth:attempts": {
    key: "dnd:auth:attempts",
    sensitivity: DataSensitivity.SENSITIVE,
    description: "Failed auth attempt tracking for brute-force protection",
    ttl: 15 * 60 * 1000, // 15 minutes
  },

  "dnd:invite:pending": {
    key: "dnd:invite:pending",
    sensitivity: DataSensitivity.SENSITIVE,
    description: "Pending world invite data (token, world name)",
    ttl: 24 * 60 * 60 * 1000, // 24 hours
  },

  dnd_session_user_email: {
    key: "dnd_session_user_email",
    sensitivity: DataSensitivity.PII,
    description: "Session email cache",
    redactionPattern: /[\w\.-]+@[\w\.-]+\.\w+/g,
  },

  "secure:auth_token": {
    key: "secure:auth_token",
    sensitivity: DataSensitivity.PII,
    description: "JWT session token",
    redactionPattern: /token=[a-z0-9]+/gi,
  },

  "secure:user_email": {
    key: "secure:user_email",
    sensitivity: DataSensitivity.PII,
    description: "User email address",
    redactionPattern: /[\w\.-]+@[\w\.-]+\.\w+/g,
  },

  // ========== WORLD & APP STATE ==========
  "dnd:app:connected_worlds": {
    key: "dnd:app:connected_worlds",
    sensitivity: DataSensitivity.SENSITIVE,
    description: "List of world IDs user has access to",
  },

  "dnd:session:last_selected_world": {
    key: "dnd:session:last_selected_world",
    sensitivity: DataSensitivity.NON_SENSITIVE,
    description: "Last world selected by user (session state)",
  },

  "dnd:session:last_user_role": {
    key: "dnd:session:last_user_role",
    sensitivity: DataSensitivity.NON_SENSITIVE,
    description: "Last user role in world (session state)",
  },

  // ========== DYNAMIC WORLD ACCESS CACHE ==========
  // Pattern: world_access_{worldId} - user access flag for a world
  // Pattern: world_access_{worldId}_meta - access metadata (timestamp, version)
  "world_access_*": {
    key: "world_access_*",
    sensitivity: DataSensitivity.SENSITIVE,
    description:
      "Dynamic cache keys for user world access (pattern: world_access_{worldId})",
  },

  "world_access_*_meta": {
    key: "world_access_*_meta",
    sensitivity: DataSensitivity.SENSITIVE,
    description:
      "Metadata for world access cache (pattern: world_access_{worldId}_meta)",
  },

  // ========== UI PREFERENCES ==========
  "dnd:user:theme": {
    key: "dnd:user:theme",
    sensitivity: DataSensitivity.NON_SENSITIVE,
    description:
      "User theme preference (classic, cyberpunk, etc.) - persists across restarts",
  },

  "dnd:user:theme_mode": {
    key: "dnd:user:theme_mode",
    sensitivity: DataSensitivity.NON_SENSITIVE,
    description: "User theme mode (light, dark) - persists across restarts",
  },

  "dnd:user:scale": {
    key: "dnd:user:scale",
    sensitivity: DataSensitivity.NON_SENSITIVE,
    description: "UI scale multiplier preference - persists across restarts",
  },

  // ========== DEV & DEBUG ==========
  "dnd:dev:mode": {
    key: "dnd:dev:mode",
    sensitivity: DataSensitivity.PUBLIC,
    description: "Developer mode flag",
  },

  // ========== CACHE KEYS ==========
  "cache:worlds_list": {
    key: "cache:worlds_list",
    sensitivity: DataSensitivity.SENSITIVE,
    description: "User world list cache",
  },

  "cache:character_sheets": {
    key: "cache:character_sheets",
    sensitivity: DataSensitivity.SENSITIVE,
    description: "User character data cache",
  },

  // ========== OFFLINE & JOB QUEUE ==========
  // Pattern: job:* - offline job state persistence
  "job:*": {
    key: "job:*",
    sensitivity: DataSensitivity.SENSITIVE,
    description: "Dynamic job state keys (pattern: job:*)",
  },

  // ========== RECOVERY & DIAGNOSTICS ==========
  // Pattern: dnd:recovery:* - recovery and diagnostic data
  "dnd:recovery:*": {
    key: "dnd:recovery:*",
    sensitivity: DataSensitivity.SENSITIVE,
    description: "Recovery and diagnostic data (pattern: dnd:recovery:*)",
  },
};

/**
 * Validate that all classified keys are properly typed.
 * Throws at runtime if registry is malformed.
 */
export function validateClassifications(): void {
  for (const [key, classification] of Object.entries(DATA_CLASSIFICATIONS)) {
    if (key !== classification.key) {
      throw new Error(
        `Data classification mismatch: registry key "${key}" does not match classification.key "${classification.key}"`,
      );
    }

    if (!Object.values(DataSensitivity).includes(classification.sensitivity)) {
      throw new Error(
        `Invalid sensitivity level for key "${key}": ${classification.sensitivity}`,
      );
    }

    if (
      classification.redactionPattern &&
      !(classification.redactionPattern instanceof RegExp)
    ) {
      throw new Error(
        `Invalid redactionPattern for key "${key}": must be RegExp`,
      );
    }
  }
}
