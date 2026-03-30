/**
 * Kernel: Clock Integrity Verification
 *
 * Generic device clock manipulation detector, phase-agnostic.
 * Stores and validates timestamps to detect if a user has tampered with
 * their device clock (e.g., to extend trial periods or premium features).
 *
 * Design:
 *   - Stores last known timestamp in SecureStorage
 *   - On each check, compares stored timestamp vs current time
 *   - If current time is significantly BEFORE stored time → clock was set back
 *   - Records the invalid state in STORAGE_KEYS.CLOCK_INVALID
 *
 * Any module (entitlements, feature flags, subscriptions) can use this to
 * verify clock integrity before granting time-sensitive access.
 *
 * Lives in system/Kernel/ because it's a foundational security check that
 * can trigger safe mode and is used across multiple domains.
 */
import { getAppConfig } from "@/config";
import { StorageManager } from "@/lib/storage";
import { logger } from "@/lib/utils";
import { STORAGE_KEYS } from "@/maps";

// ─── Configuration ───────────────────────────────────────────────────────────

function getClockSkewToleranceMs(): number {
  const config = getAppConfig();
  return config.remoteConfig?.clockSkewToleranceMs || 60 * 1000; // default 60s
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Check if the device clock has been flagged as invalid.
 * Reads the persisted CLOCK_INVALID flag from storage.
 *
 * @returns true if clock is invalid (manipulation detected), false if valid
 */
export async function isClockInvalid(): Promise<boolean> {
  try {
    const clockInvalid = await StorageManager.get<{ detected: number; skew: number }>(
      STORAGE_KEYS.CLOCK_INVALID,
    );
    return !!clockInvalid;
  } catch {
    return false;
  }
}

/**
 * Verify the device clock has not been tampered with.
 *
 * Compares the last stored timestamp against the current time.
 * If the current time is significantly before the stored time (beyond tolerance),
 * flags the clock as invalid.
 *
 * @returns true if clock is valid, false if manipulation detected
 */
export async function verifyDeviceClock(): Promise<boolean> {
  try {
    const lastCheck = await StorageManager.get<{ timestamp: number }>(
      STORAGE_KEYS.LAST_CLOCK_CHECK,
    );

    if (!lastCheck?.timestamp) {
      // First check — store current timestamp as baseline
      await StorageManager.set(STORAGE_KEYS.LAST_CLOCK_CHECK, { timestamp: Date.now() });
      return true;
    }

    const now = Date.now();
    const skew = lastCheck.timestamp - now;
    const tolerance = getClockSkewToleranceMs();

    if (skew > tolerance) {
      logger.category("security").error("Clock manipulation detected", { skew, tolerance });
      await StorageManager.set(STORAGE_KEYS.CLOCK_INVALID, { detected: now, skew });
      return false;
    }

    // Clock is valid — update the stored timestamp
    await StorageManager.set(STORAGE_KEYS.LAST_CLOCK_CHECK, { timestamp: now });
    return true;
  } catch (error) {
    logger.category("security").error("Clock verification failed", error);
    return true; // Default to valid (don't block on verification error)
  }
}

/**
 * Clear the clock invalid flag (e.g., after user re-syncs their clock).
 * Also resets the last clock check timestamp.
 */
export async function clearClockInvalidState(): Promise<void> {
  try {
    await StorageManager.remove(STORAGE_KEYS.CLOCK_INVALID);
    await StorageManager.remove(STORAGE_KEYS.LAST_CLOCK_CHECK);
  } catch (error) {
    logger.category("security").warn("Failed to clear clock invalid state", error);
  }
}
