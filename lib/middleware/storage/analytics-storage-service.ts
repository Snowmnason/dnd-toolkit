/**
 * Analytics Storage Service — Middleware wrapper for analytics queue/buffer storage
 *
 * Provides analytics modules with controlled access to SecureStorage for queue persistence.
 * This is the ONLY file in lib that imports SecureStorage for analytics queue operations.
 * All analytics modules call these functions instead.
 *
 * Responsibilities:
 * - Persist analytics event queues to encrypted storage
 * - Load queues on app startup
 * - Clear queue data during logout or consent withdrawal
 */

import { logger } from "@/lib/utils";
import { SecureStorage } from "@/system/Storage";

/**
 * Save analytics queue (breadcrumbs or events) to storage.
 */
export async function persistAnalyticsQueue(
  storageKey: string,
  data: string,
): Promise<void> {
  try {
    await SecureStorage.setItem(storageKey, data);
  } catch (error) {
    logger.category("analytics").error(
      `Failed to persist analytics queue (${storageKey}):`,
      error,
    );
    throw error;
  }
}

/**
 * Load analytics queue from storage.
 */
export async function loadAnalyticsQueue(
  storageKey: string,
): Promise<string | null> {
  try {
    return await SecureStorage.getItem(storageKey);
  } catch (error) {
    logger.category("analytics").error(
      `Failed to load analytics queue (${storageKey}):`,
      error,
    );
    return null;
  }
}

/**
 * Load analytics queue as JSON.
 */
export async function loadAnalyticsQueueJSON<T>(
  storageKey: string,
): Promise<T | null> {
  try {
    return await SecureStorage.getJSON<T>(storageKey);
  } catch (error) {
    logger.category("analytics").error(
      `Failed to load analytics queue JSON (${storageKey}):`,
      error,
    );
    return null;
  }
}

/**
 * Save analytics queue as JSON.
 */
export async function persistAnalyticsQueueJSON<T>(
  storageKey: string,
  data: T,
): Promise<void> {
  try {
    await SecureStorage.setJSON(storageKey, data);
  } catch (error) {
    logger.category("analytics").error(
      `Failed to persist analytics queue JSON (${storageKey}):`,
      error,
    );
    throw error;
  }
}

/**
 * Clear analytics queue from storage.
 */
export async function clearAnalyticsQueue(storageKey: string): Promise<void> {
  try {
    await SecureStorage.removeItem(storageKey);
  } catch (error) {
    logger.category("analytics").warn(
      `Failed to clear analytics queue (${storageKey}):`,
      error,
    );
  }
}
