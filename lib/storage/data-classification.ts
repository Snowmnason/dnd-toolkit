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
   * NON_SENSITIVE - App data, but not user-specific PII
   * Examples: world metadata, character templates, cached list of public worlds
   * Storage: FastCache (fast, unencrypted)
   * Retention: Can be cleared on app update
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
 * - PUBLIC/NON_SENSITIVE → FastCache (unencrypted, fast)
 * - SENSITIVE/PII → SecureStorage (encrypted, all platforms)
 * - If unsure, default to SENSITIVE
 */
export const DATA_CLASSIFICATIONS: Record<string, DataClassification> = {
  "app:version": {
    key: "app:version",
    sensitivity: DataSensitivity.PUBLIC,
    description: "Current app version",
  },

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

  "cache:worlds_list": {
    key: "cache:worlds_list",
    sensitivity: DataSensitivity.SENSITIVE,
    description: "User world list",
  },

  "cache:character_sheets": {
    key: "cache:character_sheets",
    sensitivity: DataSensitivity.SENSITIVE,
    description: "User character data",
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
