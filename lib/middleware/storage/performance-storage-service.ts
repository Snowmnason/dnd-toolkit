/**
 * Performance Storage Service — Middleware wrapper for performance metrics storage
 *
 * Provides performance tracking with controlled access to SecureStorage.
 * Part of the analytics-storage-service family of sub-middlewares.
 *
 * Responsibilities:
 * - Load/save performance baseline data
 * - Persist performance metrics to encrypted storage
 */

import { logger } from "@/lib/utils";
import { SecureStorage } from "@/system/Storage";

/**
 * Load performance baseline data from storage.
 */
export async function loadPerformanceMetrics(
  storageKey: string,
): Promise<string | null> {
  try {
    return await SecureStorage.getItem(storageKey);
  } catch (error) {
    logger.category("performance").error(
      `Failed to load performance metrics (${storageKey}):`,
      error,
    );
    return null;
  }
}

/**
 * Save performance baseline data to storage.
 */
export async function persistPerformanceMetrics(
  storageKey: string,
  data: string,
): Promise<void> {
  try {
    await SecureStorage.setItem(storageKey, data);
  } catch (error) {
    logger.category("performance").error(
      `Failed to persist performance metrics (${storageKey}):`,
      error,
    );
    throw error;
  }
}
