/**
 * Secure Storage Service — Middleware wrapper for system-level SecureStorage
 *
 * Provides lib modules with controlled access to SecureStorage operations.
 * This is the ONLY file in lib that imports SecureStorage directly.
 * All other lib modules call these functions instead.
 *
 * Responsibilities:
 * - Get all keys from SecureStorage (for logout, data clearing)
 * - Clear all keys with optional prefix filtering
 * - Provides a consistent API for storage introspection
 */

import { logger } from "@/lib/utils";
import { SecureStorage } from "@/system/Storage";

/**
 * Get all keys stored in SecureStorage.
 * Used during logout to clear user data, and by consent/analytics systems.
 */
export async function getAllSecureStorageKeys(): Promise<string[]> {
  try {
    const keys = await SecureStorage.getAllKeys();
    return keys || [];
  } catch (error) {
    logger.category("storage").error(
      "Failed to get all keys from SecureStorage",
      error,
    );
    return [];
  }
}

/**
 * Clear all keys from SecureStorage with optional prefix filtering.
 * Used during logout and account deletion.
 *
 * @param prefix - Optional prefix to filter keys (e.g., "analytics:" to clear only analytics keys)
 * @returns Number of keys removed
 */
export async function clearSecureStorageByPrefix(
  prefix?: string,
): Promise<number> {
  try {
    const allKeys = await getAllSecureStorageKeys();
    const keysToRemove = prefix
      ? allKeys.filter((key) => key.startsWith(prefix))
      : allKeys;

    for (const key of keysToRemove) {
      await SecureStorage.removeItem(key);
    }

    logger.category("storage").debug(
      `Cleared ${keysToRemove.length} keys from SecureStorage${prefix ? ` (prefix: ${prefix})` : ""}`,
    );
    return keysToRemove.length;
  } catch (error) {
    logger.category("storage").error(
      "Failed to clear SecureStorage keys",
      error,
    );
    return 0;
  }
}

/**
 * Clear all data from SecureStorage (completely empty it).
 * Used during complete logout/account deletion.
 */
export async function clearAllSecureStorage(): Promise<void> {
  try {
    const allKeys = await getAllSecureStorageKeys();
    for (const key of allKeys) {
      await SecureStorage.removeItem(key);
    }
    logger.category("storage").debug(`Cleared all keys from SecureStorage`);
  } catch (error) {
    logger.category("storage").error("Failed to clear all SecureStorage", error);
  }
}
