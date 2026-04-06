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
  "dnd:feature_flags:v1": {
    key: "dnd:feature_flags:v1",
    sensitivity: DataSensitivity.PUBLIC,
    description:
      "Server-synced feature flags (non-user-specific, client-driven cache)",
    ttl: 24 * 60 * 60 * 1000, // 24h (soft TTL)
  },

  "dnd:entitlements:v1": {
    key: "dnd:entitlements:v1",
    sensitivity: DataSensitivity.SENSITIVE,
    description:
      "User premium entitlements with expiry and clock-safety checks",
    ttl: 7 * 24 * 60 * 60 * 1000, // 7 days
  },

  "dnd:clock_invalid": {
    key: "dnd:clock_invalid",
    sensitivity: DataSensitivity.NON_SENSITIVE,
    description:
      "Marker indicating device clock manipulation was detected (stale entitlements rejected)",
  },

  // ========== AUTHENTICATION & ACCOUNT (shared infrastructure) ==========
  "sno:auth:has_account": {
    key: "sno:auth:has_account",
    sensitivity: DataSensitivity.SENSITIVE,
    description: "Whether user has created an account",
  },

  "sno:auth:user_data": {
    key: "sno:auth:user_data",
    sensitivity: DataSensitivity.SENSITIVE,
    description: "User profile data (ID, email, etc.)",
  },

  "sno:auth:user_data_meta": {
    key: "sno:auth:user_data_meta",
    sensitivity: DataSensitivity.SENSITIVE,
    description: "Metadata for user profile cache (timestamp, version)",
  },

  "sno:auth:user_data_timestamp": {
    key: "sno:auth:user_data_timestamp",
    sensitivity: DataSensitivity.SENSITIVE,
    description: "Timestamp of last user data update",
  },

  "sno:auth:last_logged_in": {
    key: "sno:auth:last_logged_in",
    sensitivity: DataSensitivity.SENSITIVE,
    description: "Timestamp of last successful login",
  },

  "sno:auth:attempts": {
    key: "sno:auth:attempts",
    sensitivity: DataSensitivity.SENSITIVE,
    description: "Failed auth attempt tracking for brute-force protection",
    ttl: 15 * 60 * 1000, // 15 minutes
  },

  "sno:auth:session": {
    key: "sno:auth:session",
    sensitivity: DataSensitivity.PII,
    description:
      "Supabase session tokens (access + refresh) for web platform (persistSession=false workaround)",
    redactionPattern: /token=[a-z0-9]+/gi,
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

  // ========== UI PREFERENCES (shared infrastructure) ==========
  "sno:user:theme": {
    key: "sno:user:theme",
    sensitivity: DataSensitivity.NON_SENSITIVE,
    description:
      "User theme preference (classic, cyberpunk, etc.) - persists across restarts",
  },

  "sno:user:theme_mode": {
    key: "sno:user:theme_mode",
    sensitivity: DataSensitivity.NON_SENSITIVE,
    description: "User theme mode (light, dark) - persists across restarts",
  },

  "sno:user:scale": {
    key: "sno:user:scale",
    sensitivity: DataSensitivity.NON_SENSITIVE,
    description: "UI scale multiplier preference - persists across restarts",
  },

  // ========== DEV & DEBUG (shared infrastructure) ==========
  "sno:dev:mode": {
    key: "sno:dev:mode",
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

  // ========== ANALYTICS & TELEMETRY (shared infrastructure) ==========
  "sno:sentry:breadcrumb_queue": {
    key: "sno:sentry:breadcrumb_queue",
    sensitivity: DataSensitivity.SENSITIVE,
    description: "Offline queue of breadcrumbs (debug events) waiting to be sent to Sentry",
    ttl: 14 * 24 * 60 * 60 * 1000, // 14 days
  },

  "sno:sentry:sent_fingerprints": {
    key: "sno:sentry:sent_fingerprints",
    sensitivity: DataSensitivity.SENSITIVE,
    description: "Deduplication cache for sent breadcrumbs (fingerprint -> timestamp)",
    ttl: 24 * 60 * 60 * 1000, // 24 hours
  },

  // ========== RECOVERY & DIAGNOSTICS (shared infrastructure) ==========
  // Pattern: sno:recovery:* - recovery and diagnostic data
  "sno:recovery:*": {
    key: "sno:recovery:*",
    sensitivity: DataSensitivity.SENSITIVE,
    description: "Recovery and diagnostic data (pattern: sno:recovery:*)",
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
