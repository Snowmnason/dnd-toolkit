/**
 * Crash Degradation Handlers
 *
 * Unrecoverable failure handlers. These represent situations where
 * the app CANNOT continue normally and must enter hard-fail or safe mode.
 *
 * Separated from fault-handlers.ts deliberately:
 * - fault-handlers: recoverable degradation (retry/fallback available)
 * - crash-handlers: unrecoverable failure (no fallback, app broken)
 *
 * Kept in system/Degrade for centralization. If a dedicated error/crash system
 * is built in the future, these functions are self-contained and easy to extract.
 *
 * Crash scenarios:
 * - STORAGE: persistent storage completely unavailable (no encrypted reads/writes possible)
 * - BOOTSTRAP_CONFIG: config phase failed — app has no valid configuration
 * - BOOTSTRAP_PRELOAD: preload phase failed — fonts/assets missing, renders will break
 * - BOOTSTRAP_JOBS: job registration failed during bootstrap (flagged but deferred)
 *
 * IMPORTANT: Crash handlers set the capability flag AND are expected to be
 * followed by a hard-fail path in the caller (error boundary, safe mode screen, etc.).
 * Setting the flag alone does NOT crash the app — the caller must act on it.
 */

import { degradeManager } from '../degrade-manager';
import { DegradeCapability } from '../types';

const SOURCE = 'crash-handler';

// ==========================================
// STORAGE (runtime + bootstrap)
// ==========================================

/**
 * Called when persistent storage becomes completely unavailable at any point.
 * This is unrecoverable — the app cannot safely read or write encrypted data.
 *
 * Sets STORAGE capability to false AND marks it as a crash-level event.
 *
 * Expected caller behavior:
 * 1. Call this function
 * 2. Trigger safe mode: setSafeMode(SafeModeReason.STORAGE_UNREADABLE)
 * 3. Show recovery screen (user must clear cache / reinstall)
 *
 * @param reason Storage error detail from classifyStorageError()
 * @param isCritical If true, quota-exceeded or corrupted (vs transient IO error)
 */
export function reportStorageCrash(reason: string, isCritical = true): void {
  degradeManager.set(DegradeCapability.STORAGE, false, {
    source: SOURCE,
    reason: isCritical ? `unrecoverable: ${reason}` : `storage unavailable: ${reason}`,
  });
}

// ==========================================
// BOOTSTRAP: CONFIG
// ==========================================

/**
 * Called when the config phase fails during bootstrap.
 * No valid app configuration = no safe defaults = the app cannot start.
 *
 * Sets multiple capabilities to false since config drives everything.
 *
 * Expected caller behavior:
 * 1. Call this function
 * 2. Crash to error boundary — config failure is non-recoverable
 *
 * @param reason Config failure detail
 */
export function reportConfigBootstrapCrash(reason: string): void {
  // Config failure affects everything — mark all capabilities degraded
  const allCrashCapabilities: DegradeCapability[] = [
    DegradeCapability.DATABASE,
    DegradeCapability.AUTH,
    DegradeCapability.SYNC,
    DegradeCapability.ANALYTICS,
    DegradeCapability.ERROR_TRACKING,
    DegradeCapability.PREMIUM_FEATURES,
  ];

  for (const capability of allCrashCapabilities) {
    degradeManager.set(capability, false, {
      source: SOURCE,
      reason: `config bootstrap failed: ${reason}`,
    });
  }
}

// ==========================================
// BOOTSTRAP: PRELOAD
// ==========================================

/**
 * Called when the preload phase fails during bootstrap.
 * Fonts/assets/themes failed to load — UI will be broken/unstyled.
 *
 * This is a crash-level event because rendered output will be visually broken.
 *
 * Expected caller behavior:
 * 1. Call this function
 * 2. Crash to error boundary with KERNEL_PRELOAD_FAILED reason
 *
 * @param reason Preload failure detail
 */
export function reportPreloadBootstrapCrash(reason: string): void {
  // Preload failure means UI is broken; no capabilities work reliably
  degradeManager.set(DegradeCapability.STORAGE, false, {
    source: SOURCE,
    reason: `preload bootstrap failed (assets unavailable): ${reason}`,
  });
}

// ==========================================
// BOOTSTRAP: JOBS
// ==========================================

/**
 * Called when background job registration fails during bootstrap.
 * Jobs are queued work — if registration fails, no background tasks will run.
 *
 * This sets BACKGROUND_JOBS to false. Recovery strategy is TBD (see plan).
 * Flagged here for visibility; the app continues — jobs are non-critical for bootstrap.
 *
 * Expected caller behavior:
 * 1. Call this function
 * 2. Log the failure, continue bootstrap (do NOT crash)
 * 3. Show degraded-jobs indicator in UI if desired (via useCapability hook)
 *
 * @param reason Job registration failure detail
 */
export function reportJobsBootstrapCrash(reason: string): void {
  degradeManager.set(DegradeCapability.BACKGROUND_JOBS, false, {
    source: SOURCE,
    reason: `job registration failed at bootstrap: ${reason}`,
  });
}
