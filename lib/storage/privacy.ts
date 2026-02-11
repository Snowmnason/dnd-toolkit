/**
 * Privacy & Data-Lifecycle Helpers
 *
 * Provides storage backend selection, data redaction, and coordinated
 * data clearing for logout/account deletion workflows.
 *
 * See docs/issues/MileStone 2/168 - Privacy PII Data/PRIVACY.md for policy documentation.
 */

import { DATA_CLASSIFICATIONS, DataSensitivity } from "./data-classification";
import { FastCache } from "./FastCache";
import { SecureStorage } from "./SecureStorage";

/**
 * Classify data by key to determine handling.
 * Returns the sensitivity level or null if key is not registered.
 *
 * Supports pattern matching for dynamic keys:
 * - Exact match first (e.g., "secure:user_email")
 * - Wildcard match (e.g., "world_access_123" matches pattern "world_access_*")
 *
 * This ensures dynamic keys like world_access_${worldId} are classified correctly.
 */
export function classifyKey(key: string): DataSensitivity | null {
  // Exact match first

  if (key in DATA_CLASSIFICATIONS) {
    // eslint-disable-next-line security/detect-object-injection
    return DATA_CLASSIFICATIONS[key].sensitivity;
  }

  // Wildcard pattern match (e.g., "world_access_*" matches "world_access_123")
  for (const registryKey of Object.keys(DATA_CLASSIFICATIONS)) {
    if (registryKey.endsWith("*")) {
      const prefix = registryKey.slice(0, -1);
      if (key.startsWith(prefix)) {
        // eslint-disable-next-line security/detect-object-injection
        return DATA_CLASSIFICATIONS[registryKey].sensitivity;
      }
    }
  }

  // No match found
  return null;
}

/**
 * Determine which storage backend to use for a key.
 * SENSITIVE, PII, and NON_SENSITIVE → SecureStorage (encrypted + persistent)
 * PUBLIC only → FastCache (unencrypted, session-only, temporary)
 */
export function shouldUseSecureStorage(key: string): boolean {
  const sensitivity = classifyKey(key);
  return (
    sensitivity === DataSensitivity.SENSITIVE ||
    sensitivity === DataSensitivity.PII ||
    sensitivity === DataSensitivity.NON_SENSITIVE
  );
}

/**
 * Get the appropriate storage backend for a key based on classification.
 */
export function getStorageBackend(
  key: string,
): typeof SecureStorage | typeof FastCache {
  return shouldUseSecureStorage(key) ? SecureStorage : FastCache;
}

/**
 * Redact sensitive data from string for logging.
 * Replaces PII patterns with [REDACTED].
 *
 * If a specific key is provided, uses its redaction pattern first,
 * then applies global patterns for common PII.
 *
 * Uses comprehensive PII patterns from lib/utils/pii-redaction:
 * - Prefixed patterns: email: ..., token: ..., userid: ..., etc.
 * - Standalone patterns: bare email addresses, JWT tokens, UUIDs, API keys
 */
export function redactForLogs(value: unknown, key?: string): string {
  if (value === null || value === undefined) return "";

  let str: string;
  if (typeof value === "string") {
    str = value;
  } else if (value instanceof Error) {
    // JSON.stringify(new Error('x')) => '{}', which destroys useful debugging info.
    // Preserve common fields while still running through our redaction pipeline.
    str = JSON.stringify({
      name: value.name,
      message: value.message,
      stack: value.stack,
    });
  } else {
    try {
      str = JSON.stringify(value);
    } catch {
      str = String(value);
    }
  }

  // If specific key provided, use its redaction pattern
  if (key) {
    // eslint-disable-next-line security/detect-object-injection
    const classification = DATA_CLASSIFICATIONS[key];
    if (classification?.redactionPattern) {
      str = str.replace(classification.redactionPattern, "[REDACTED]");
    }
  }

  // Apply global redaction patterns for common PII
  // Lazy import to avoid circular dependencies
  try {
    const { redactPII } = require("@/lib/utils/pii-redaction");
    return redactPII(str);
  } catch {
    // Fallback if import fails - apply basic patterns
    const basicPatterns = [
      /\bemail["\s:=]+(["\']?[\w\.\-\+]+@[\w\.\-]+\.\w+)/gi,
      /\btoken["\s:=]+(["\']?[A-Za-z0-9_\-\.]+)/gi,
      /\bsession["\s:=]+(["\']?[a-zA-Z0-9\-_\.]+)/gi,
      /\b(userid|user_id)["\s:=]+(["\']?[a-zA-Z0-9\-_\.]+)/gi,
      /\bid["\s:=]+(["\']?[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})/gi,
    ];

    for (const pattern of basicPatterns) {
      str = str.replace(pattern, "[REDACTED]");
    }

    return str;
  }
}

/**
 * Check if data classified as sensitive or PII.
 * These are keys that require special handling (encryption, redaction, clearing on logout).
 */
export function isSensitiveData(key: string): boolean {
  const sensitivity = classifyKey(key);
  return (
    sensitivity === DataSensitivity.SENSITIVE ||
    sensitivity === DataSensitivity.PII
  );
}

/**
 * Clear all user data across both storage backends per privacy policy.
 * Removes SENSITIVE and PII data; retains PUBLIC and NON_SENSITIVE.
 *
 * Handles both static keys (e.g., "secure:user_email") and dynamic keys
 * (e.g., "world_access_123" matching pattern "world_access_*").
 *
 * Call on logout, account deletion, or user data deletion requests.
 *
 * Errors are logged but don't throw—best-effort clearing.
 */
export async function clearAllUserData(): Promise<void> {
  // 1. Get registry keys that need clearing (includes patterns like "world_access_*")
  const registryKeysToDelete = Object.keys(DATA_CLASSIFICATIONS).filter(
    (key) => {
      const sensitivity = classifyKey(key);
      return (
        sensitivity === DataSensitivity.SENSITIVE ||
        sensitivity === DataSensitivity.PII
      );
    },
  );

  // 2. Get actual keys from storage backends to find dynamic/pattern-matched keys
  let allStorageKeys: string[] = [];
  try {
    const [secureKeys, fastKeys] = await Promise.all([
      SecureStorage.getAllKeys().catch(() => []),
      // FastCache doesn't have getAllKeys(), so we'll remove by pattern instead
      Promise.resolve([] as string[]),
    ]);
    allStorageKeys = [...new Set([...secureKeys, ...fastKeys])]; // Deduplicate
  } catch (error) {
    // Log error but continue with registry-only cleanup
    import("@/lib/utils/logger")
      .then(({ logger }) => {
        logger.warn("privacy", "Failed to get storage keys", error);
      })
      .catch(() => {
        // Ignore logger import errors
      });
  }

  // 3. Match actual storage keys against patterns and add to deletion list
  const allKeysToDelete = new Set<string>();

  // Add static/registry keys (exact matches and patterns as-is)
  for (const key of registryKeysToDelete) {
    allKeysToDelete.add(key);
  }

  // Match dynamic storage keys against pattern entries
  for (const storageKey of allStorageKeys) {
    // Check if this storage key matches any pattern in the registry
    for (const registryKey of registryKeysToDelete) {
      if (registryKey.endsWith("*")) {
        const prefix = registryKey.slice(0, -1);
        if (storageKey.startsWith(prefix)) {
          allKeysToDelete.add(storageKey);
          break; // Already matched, no need to check other patterns
        }
      }
    }
  }

  let successCount = 0;
  let failureCount = 0;

  // 4. Delete keys from both backends (best-effort on both)
  for (const key of allKeysToDelete) {
    try {
      // Try to remove from SecureStorage
      await SecureStorage.removeItem(key).catch(() => {
        // Silent fail if key doesn't exist
      });

      // Try to remove from FastCache
      await FastCache.removeItem(key).catch(() => {
        // Silent fail if key doesn't exist
      });

      successCount++;
    } catch (error) {
      failureCount++;
      // Lazy import logger to avoid circular dependency
      import("@/lib/utils/logger")
        .then(({ logger }) => {
          logger.error(
            "privacy",
            `Failed to clear key ${key}: ${error instanceof Error ? error.message : String(error)}`,
          );
        })
        .catch(() => {
          // Ignore logger import errors
        });
    }
  }

  // 5. Delete pattern-prefixed keys from FastCache using removeByPrefix
  // (FastCache doesn't have getAllKeys, so we proactively remove by pattern)
  for (const registryKey of registryKeysToDelete) {
    if (registryKey.endsWith("*")) {
      const prefix = registryKey.slice(0, -1);
      try {
        await FastCache.removeByPrefix(prefix);
      } catch (error) {
        // Log error but continue
        import("@/lib/utils/logger")
          .then(({ logger }) => {
            logger.warn(
              "privacy",
              `Failed to clear prefix ${prefix}: ${error instanceof Error ? error.message : String(error)}`,
            );
          })
          .catch(() => {
            // Ignore logger import errors
          });
      }
    }
  }

  // 6. Log completion
  import("@/lib/utils/logger")
    .then(({ logger }) => {
      logger.info(
        "privacy",
        `Cleared user data: ${successCount} keys cleared, ${failureCount} failures`,
      );
    })
    .catch(() => {
      // Ignore logger import errors
    });
}

/**
 * Get data retention and handling info for a key.
 * Useful for showing data lifecycle info in settings/account pages.
 */
export function getRetentionInfo(key: string): {
  ttl: number | null;
  clearOnLogout: boolean;
  description: string;
} | null {
  // eslint-disable-next-line security/detect-object-injection
  const classification = DATA_CLASSIFICATIONS[key];
  if (!classification) return null;

  return {
    ttl: classification.ttl ?? null,
    clearOnLogout:
      classification.sensitivity === DataSensitivity.SENSITIVE ||
      classification.sensitivity === DataSensitivity.PII,
    description: classification.description,
  };
}

/**
 * Get all keys that match a sensitivity level.
 * Useful for auditing or bulk operations.
 */
export function getKeysBySensitivity(sensitivity: DataSensitivity): string[] {
  return Object.entries(DATA_CLASSIFICATIONS)
    .filter(([, classification]) => classification.sensitivity === sensitivity)
    .map(([key]) => key);
}

/**
 * List all keys that will be cleared on logout/account deletion.
 * (SENSITIVE and PII keys)
 */
export function getSensitiveKeys(): string[] {
  return Object.keys(DATA_CLASSIFICATIONS).filter((key) =>
    isSensitiveData(key),
  );
}
