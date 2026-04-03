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
 * Crash handlers:
 * 1. Set the capability flag on appDegrade (state tracking)
 * 2. Notify the registered crash callback (so the kernel/lib can trigger safe mode)
 * 3. The CALLER still controls whether to throw/continue — handlers don't crash the app
 *
 * Callback pattern: system/ can't import lib/ safe-mode types, so we export a
 * registrable callback. The kernel registers it during bootstrap to bridge the gap.
 */

import { DegradeCapability } from '@/type-definitions/degrade';
import { appDegrade } from '../app-degrade';

const SOURCE = 'crash-handler';

// ==========================================
// CRASH CALLBACK REGISTRY
// ==========================================

/**
 * Structured crash notification sent to the registered callback.
 * Contains enough info for the kernel/lib layer to decide how to respond
 * (trigger safe mode, show error boundary, or continue with degradation).
 */
export interface CrashNotification {
  /** Which capability crashed */
  capability: DegradeCapability;
  /** Human-readable reason for the crash */
  reason: string;
  /** Whether this is a critical crash (true) or a flagged non-critical (false) */
  isCritical: boolean;
  /**
   * Suggested response action:
   * - 'safe-mode': trigger SafeModeScreen with appropriate reason
   * - 'error-boundary': let the error propagate to AppErrorBoundary
   * - 'continue': flag is set but app should continue (non-critical crash)
   */
  suggestedAction: 'safe-mode' | 'error-boundary' | 'continue';
}

/**
 * Callback type for crash notifications.
 * Registered by the kernel or lib layer to bridge system/ → lib/ boundary.
 */
export type CrashCallback = (notification: CrashNotification) => void;

/** Registered crash callback — null until kernel registers one */
let crashCallback: CrashCallback | null = null;

/**
 * Register a callback to receive crash notifications.
 * Called by the kernel during bootstrap to wire crash handlers → safe mode.
 *
 * Only one callback is supported — subsequent calls replace the previous one.
 * Returns an unregister function.
 *
 * @param callback Function to call when a crash is reported
 * @returns Unregister function
 */
export function registerCrashCallback(callback: CrashCallback): () => void {
  crashCallback = callback;
  return () => {
    if (crashCallback === callback) {
      crashCallback = null;
    }
  };
}

/**
 * Internal: notify crash callback if registered
 */
function notifyCrash(notification: CrashNotification): void {
  if (crashCallback) {
    try {
      crashCallback(notification);
    } catch {
      // Crash callback itself failed — nothing we can safely do here.
      // The flag is already set on appDegrade, so state is tracked.
    }
  }
}

// ==========================================
// STORAGE (runtime + bootstrap)
// ==========================================

/**
 * Called when persistent storage becomes completely unavailable at any point.
 * This is unrecoverable — the app cannot safely read or write encrypted data.
 *
 * Actions:
 * 1. Sets STORAGE capability to false on appDegrade
 * 2. Notifies crash callback → kernel triggers safe mode (STORAGE_UNREADABLE)
 *
 * Caller still controls the throw — this function does NOT throw.
 *
 * @param reason Storage error detail from classifyStorageError()
 * @param isCritical If true, quota-exceeded or corrupted (vs transient IO error)
 */
export function reportStorageCrash(reason: string, isCritical = true): void {
  appDegrade.set(DegradeCapability.STORAGE, false, {
    source: SOURCE,
    reason: isCritical ? `unrecoverable: ${reason}` : `storage unavailable: ${reason}`,
  });

  notifyCrash({
    capability: DegradeCapability.STORAGE,
    reason,
    isCritical,
    suggestedAction: isCritical ? 'safe-mode' : 'continue',
  });
}

// ==========================================
// BOOTSTRAP: CONFIG
// ==========================================

/**
 * Called when the config phase fails during bootstrap.
 * No valid app configuration = no safe defaults = the app cannot start.
 *
 * Actions:
 * 1. Sets ALL downstream capabilities to false (config is the root dependency)
 * 2. Notifies crash callback → kernel lets error boundary catch the throw
 *
 * The config phase always re-throws after calling this, so the error
 * propagates to AppErrorBoundary. The callback is informational.
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
    appDegrade.set(capability, false, {
      source: SOURCE,
      reason: `config bootstrap failed: ${reason}`,
    });
  }

  notifyCrash({
    capability: DegradeCapability.DATABASE, // Use DATABASE as representative — all are down
    reason: `config bootstrap failed: ${reason}`,
    isCritical: true,
    suggestedAction: 'error-boundary',
  });
}

// ==========================================
// BOOTSTRAP: PRELOAD
// ==========================================

/**
 * Called when the preload phase fails during bootstrap.
 * Fonts/assets/themes failed to load — UI will use fallback fonts.
 *
 * Actions:
 * 1. Does NOT degrade any capability — preload is about UI assets, not persistent storage
 * 2. Does NOT notify — no capability change means nothing for the system to do
 *
 * Preload failures are survivable and don't indicate any system capability issue.
 * The app continues with system fallback fonts and renders correctly.
 * Failures are logged as warnings in preload-phase.ts but don't trigger degradation.
 *
 * @param reason Preload failure detail
 */
export function reportPreloadBootstrapCrash(reason: string): void {
  // Preload failures are UI-level only; no capability degradation needed
  // No appDegrade.set() call — preload is not a capability issue
  // No notifyCrash() call — nothing for the crash handler to do
  // (Logging happens in preload-phase.ts; this function is a no-op)
}

// ==========================================
// BOOTSTRAP: JOBS
// ==========================================

/**
 * Called when background job infrastructure or registration fails during bootstrap.
 * Jobs are queued work — if registration fails, no background tasks will run.
 *
 * Actions:
 * 1. Sets BACKGROUND_JOBS capability to false
 * 2. Notifies crash callback (non-critical — app continues without background jobs)
 *
 * The app continues — jobs are non-critical for core functionality.
 * Users may notice missing auto-refresh, but manual actions still work.
 *
 * @param reason Job registration failure detail
 */
export function reportJobsBootstrapCrash(reason: string): void {
  appDegrade.set(DegradeCapability.BACKGROUND_JOBS, false, {
    source: SOURCE,
    reason: `job registration failed at bootstrap: ${reason}`,
  });

  notifyCrash({
    capability: DegradeCapability.BACKGROUND_JOBS,
    reason,
    isCritical: false,
    suggestedAction: 'continue',
  });
}
