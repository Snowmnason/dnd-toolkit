/**
 * Privacy & Data-Lifecycle Helpers
 *
 * Provides storage backend selection, data redaction, and coordinated
 * data clearing for logout/account deletion workflows.
 *
 * See docs/issues/MileStone 2/168 - Privacy PII Data/PRIVACY.md for policy documentation.
 */

import { logger } from "@/lib";
import { DATA_CLASSIFICATIONS, DataSensitivity } from "./data-classification";
import { FastCache } from "./FastCache";
import { SecureStorage } from "./SecureStorage";

/**
 * Classify data by key to determine handling.
 * Returns the sensitivity level or null if key is not registered.
 */
export function classifyKey(key: string): DataSensitivity | null {
  // eslint-disable-next-line security/detect-object-injection
  const classification = DATA_CLASSIFICATIONS[key];
  return classification?.sensitivity ?? null;
}

/**
 * Determine which storage backend to use for a key.
 * SENSITIVE and PII data → SecureStorage (encrypted)
 * PUBLIC and NON_SENSITIVE → FastCache (unencrypted, fast)
 */
export function shouldUseSecureStorage(key: string): boolean {
  const sensitivity = classifyKey(key);
  return (
    sensitivity === DataSensitivity.SENSITIVE ||
    sensitivity === DataSensitivity.PII
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
 */
export function redactForLogs(value: unknown, key?: string): string {
  if (value === null || value === undefined) return "";

  let str = typeof value === "string" ? value : JSON.stringify(value);

  // If specific key provided, use its redaction pattern
  if (key) {
    // eslint-disable-next-line security/detect-object-injection
    const classification = DATA_CLASSIFICATIONS[key];
    if (classification?.redactionPattern) {
      str = str.replace(classification.redactionPattern, "[REDACTED]");
    }
  }

  // Apply global redaction patterns for common PII
  const piiPatterns = [
    /\bemail["\s:=]+(["\']?[\w\.-]+@[\w\.-]+\.\w+)/gi, // email
    /\btoken["\s:=]+(["\']?[a-z0-9]+)/gi, // tokens
    /\bsession["\s:=]+(["\']?[a-z0-9\-]+)/gi, // session IDs
    /\buserid["\s:=]+(["\']?[a-z0-9\-]+)/gi, // user IDs
    /\bid["\s:=]+(["\']?[a-f0-9\-]{36})/gi, // UUIDs
  ];

  for (const pattern of piiPatterns) {
    str = str.replace(pattern, "[REDACTED]");
  }

  return str;
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
 * Call on logout, account deletion, or user data deletion requests.
 *
 * Errors are logged but don't throw—best-effort clearing.
 */
export async function clearAllUserData(): Promise<void> {
  const keysToDelete = Object.keys(DATA_CLASSIFICATIONS).filter((key) => {
    const sensitivity = classifyKey(key);
    // Clear sensitive and PII data; keep public/non-sensitive
    return (
      sensitivity === DataSensitivity.SENSITIVE ||
      sensitivity === DataSensitivity.PII
    );
  });

  let successCount = 0;
  let failureCount = 0;

  // Clear from both backends (best-effort on both)
  for (const key of keysToDelete) {
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
      logger.error(
        "privacy",
        `Failed to clear key ${key}: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  logger.info(
    "privacy",
    `Cleared user data: ${successCount} keys cleared, ${failureCount} failures`,
  );
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
