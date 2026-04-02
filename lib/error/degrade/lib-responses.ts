/**
 * Lib-level degradation response handlers.
 *
 * Centralized registry of what the LIB layer does when a capability degrades or recovers.
 * These handlers cover UI/domain concerns: showing banners, gating features,
 * switching modes, guarding navigation, updating state machines.
 *
 * For system-level responses (stopping processes, pausing queues),
 * see system/Degrade/responses/system-responses.ts.
 *
 * Each handler receives a DegradeResponseContext with:
 * - capability: which capability changed
 * - available: true = recovered, false = degraded
 * - reason: human-readable explanation
 * - source: 'bootstrap-crash' | 'runtime-fault' | 'recovery'
 * - isCrash: true if reportCrash() was called (unrecoverable failure)
 */

import { DegradeCapability, DegradeResponseContext } from '@/type-definitions/degrade';
import { getDisplayCallbacks, registerDegradeResponse } from './degrade-manager';

// ──────────────────────────────────────────────────────────
// Degradation report rate-limiting (for optional providers)
// ──────────────────────────────────────────────────────────
/**
 * Track last report timestamp for each capability to prevent spam.
 * Optional providers (ANALYTICS, ERROR_TRACKING) can degrade frequently
 * during screen transitions, so we debounce reports to avoid log noise.
 */
const lastDegradationReport = new Map<string, number>();

/** Minimum time (ms) between degradation reports for the same capability. 20 minutes. */
const DEGRADATION_REPORT_MIN_INTERVAL = 20 * 60 * 1000;

/**
 * Check if enough time has passed since last degradation report for this capability.
 * Prevents spam when optional providers fail repeatedly (e.g., on every screen transition).
 */
function shouldReportDegradation(capability: string): boolean {
  const lastReport = lastDegradationReport.get(capability);
  if (!lastReport) return true; // First time reporting

  const timeSinceLastReport = Date.now() - lastReport;
  return timeSinceLastReport >= DEGRADATION_REPORT_MIN_INTERVAL;
}

/**
 * Record that we reported degradation for this capability.
 */
function recordDegradationReport(capability: string): void {
  lastDegradationReport.set(capability, Date.now());
}

// ──────────────────────────────────────────────────────────
// Individual lib-level response handlers
// ──────────────────────────────────────────────────────────

function handleDatabaseResponse(ctx: DegradeResponseContext): void {
  const callbacks = getDisplayCallbacks();

  if (!ctx.available) {
    if (ctx.isCrash) {
      // Unrecoverable: show safe mode
      callbacks.showSafeMode?.(ctx.capability, ctx.reason);
    } else {
      // Recoverable: show toast
      // TODO: [Toast Redesign] Use `message` field when new toast component lands (title + detailed message)
      callbacks.showToast?.({
        title: 'Database Offline',
        severity: 'warning',
        message: 'Database connection unavailable. Working with cached data only. Changes will sync when connection returns.',
        duration: 5000,
      });
    }
  } else {
    // Recovered
    callbacks.showToast?.({
      title: 'Database Reconnected',
      severity: 'info',
      message: 'Database connection restored. Your changes are now syncing.',
      duration: 3000,
    });
  }
}

function handleAuthResponse(ctx: DegradeResponseContext): void {
  const callbacks = getDisplayCallbacks();

  if (!ctx.available) {
    if (ctx.isCrash) {
      // Unrecoverable: show safe mode
      callbacks.showSafeMode?.(ctx.capability, ctx.reason);
    } else {
      // Recoverable: show toast
      // TODO: [Toast Redesign] Use `message` field when new toast component lands (title + detailed message)
      callbacks.showToast?.({
        title: 'Authentication Unavailable',
        severity: 'error',
        message: 'Unable to verify authentication. Some features may be restricted. Please try again later.',
        duration: 5000,
      });
    }
  } else {
    // Recovered
    callbacks.showToast?.({
      title: 'Authentication Restored',
      severity: 'info',
      message: 'Your session has been restored.',
      duration: 3000,
    });
  }
}

function handleSyncResponse(ctx: DegradeResponseContext): void {
  const callbacks = getDisplayCallbacks();

  if (!ctx.available) {
    // Sync failure is recoverable, show toast
    // TODO: [Toast Redesign] Use `message` field when new toast component lands (title + detailed message)
    callbacks.showToast?.({
      title: 'Sync Paused',
      severity: 'warning',
      message: 'Real-time synchronization is temporarily paused. Changes will sync when connection improves.',
      duration: 5000,
    });
  } else {
    // Recovered
    callbacks.showToast?.({
      title: 'Sync Resumed',
      severity: 'info',
      message: 'Synchronization has resumed. Your changes are being synced.',
      duration: 3000,
    });
  }
}

function handleConnectivityResponse(ctx: DegradeResponseContext): void {
  const callbacks = getDisplayCallbacks();

  if (!ctx.available) {
    // Offline: show toast
    // TODO: [Toast Redesign] Use `message` field when new toast component lands (title + detailed message)
    callbacks.showToast?.({
      title: 'Offline Mode',
      severity: 'warning',
      message: 'You are offline. Using cached data. Changes will sync when you\'re back online.',
      duration: 5000,
    });
  } else {
    // Back online: show toast
    callbacks.showToast?.({
      title: 'Back Online',
      severity: 'info',
      message: 'Connection restored. Syncing your changes now.',
      duration: 3000,
    });
  }
}

function handleStorageResponse(ctx: DegradeResponseContext): void {
  const callbacks = getDisplayCallbacks();

  if (!ctx.available) {
    if (ctx.isCrash) {
      // Unrecoverable: show safe mode
      callbacks.showSafeMode?.(ctx.capability, ctx.reason);
    } else {
      // Recoverable: show toast
      // TODO: [Toast Redesign] Use `message` field when new toast component lands (title + detailed message)
      callbacks.showToast?.({
        title: 'Storage Unavailable',
        severity: 'error',
        message: 'Local storage is unavailable. Preferences and data cannot be saved. Please check your device storage.',
        duration: 5000,
      });
    }
  } else {
    // Recovered
    callbacks.showToast?.({
      title: 'Storage Restored',
      severity: 'info',
      message: 'Local storage is available again.',
      duration: 3000,
    });
  }
}

function handleBackgroundJobsResponse(ctx: DegradeResponseContext): void {
  const callbacks = getDisplayCallbacks();

  if (!ctx.available) {
    if (ctx.isCrash) {
      // Unrecoverable: show safe mode
      callbacks.showSafeMode?.(ctx.capability, ctx.reason);
    } else {
      // Degraded: show toast
      // TODO: [Toast Redesign] Use `message` field when new toast component lands (title + detailed message)
      callbacks.showToast?.({
        title: 'Background Jobs Paused',
        severity: 'warning',
        message: 'Background tasks are paused. Syncing and automatic updates will resume when available.',
        duration: 5000,
      });
    }
  } else {
    // Recovered
    callbacks.showToast?.({
      title: 'Background Jobs Resumed',
      severity: 'info',
      message: 'Syncing and other background tasks have resumed.',
      duration: 3000,
    });
  }
}

function handleAnalyticsResponse(ctx: DegradeResponseContext): void {
  const callbacks = getDisplayCallbacks();

  // Skip entirely if analytics is disabled in config — don't report degradation for disabled providers
  try {
    const config = require('../../../config/appsettings.json');
    if (config?.services?.analytics?.enabled === false) {
      return; // Analytics disabled; no response needed
    }
  } catch {
    // If config load fails, proceed with handler (shouldn't happen)
  }

  if (!ctx.available) {
    // Analytics failures are invisible to users (no crash, no user-facing feature loss)
    // Rate-limit to prevent spam
    if (shouldReportDegradation('ANALYTICS')) {
      // TODO: [Toast Redesign] Use `message` field when new toast component lands (title + detailed message)
      callbacks.showToast?.({
        title: 'Analytics Unavailable',
        severity: 'info',
        message: 'Event tracking is temporarily unavailable. This does not affect app functionality.',
        duration: 3000,
      });
      recordDegradationReport('ANALYTICS');
    }
  } else {
    // Recovered
    callbacks.showToast?.({
      title: 'Analytics Restored',
      severity: 'info',
      message: 'Event tracking has resumed.',
      duration: 2000,
    });
    lastDegradationReport.delete('ANALYTICS'); // Reset timer on recovery
  }
}

function handleErrorTrackingResponse(ctx: DegradeResponseContext): void {
  const callbacks = getDisplayCallbacks();

  // Skip entirely if error tracking is disabled in config — don't report degradation for disabled providers
  try {
    const config = require('../../../config/appsettings.json');
    if (config?.services?.errorProvider?.enabled === false) {
      return; // Error tracking disabled; no response needed
    }
  } catch {
    // If config load fails, proceed with handler (shouldn't happen)
  }

  if (!ctx.available) {
    // Error tracking failures are invisible to users (no crash, no user-facing feature loss)
    // Rate-limit to prevent spam
    if (shouldReportDegradation('ERROR_TRACKING')) {
      // TODO: [Toast Redesign] Use `message` field when new toast component lands (title + detailed message)
      callbacks.showToast?.({
        title: 'Error Reporting Unavailable',
        severity: 'info',
        message: 'Error reporting is temporarily unavailable. Errors will be stored locally and reported later.',
        duration: 3000,
      });
      recordDegradationReport('ERROR_TRACKING');
    }
  } else {
    // Recovered
    callbacks.showToast?.({
      title: 'Error Reporting Restored',
      severity: 'info',
      message: 'Error reporting has resumed.',
      duration: 2000,
    });
    lastDegradationReport.delete('ERROR_TRACKING'); // Reset timer on recovery
  }
}

function handlePremiumFeaturesResponse(ctx: DegradeResponseContext): void {
  const callbacks = getDisplayCallbacks();

  if (!ctx.available) {
    // Premium feature verification degraded: gate premium UI
    // TODO: [Toast Redesign] Use `message` field when new toast component lands (title + detailed message)
    callbacks.showToast?.({
      title: 'Premium Features Unavailable',
      severity: 'warning',
      message: 'Premium features are temporarily unavailable. Your subscription status cannot be verified.',
      duration: 5000,
    });
  } else {
    // Recovered: unlock premium UI
    callbacks.showToast?.({
      title: 'Premium Features Restored',
      severity: 'info',
      message: 'Premium features are available again.',
      duration: 3000,
    });
  }
}

// ──────────────────────────────────────────────────────────
// Registration
// ──────────────────────────────────────────────────────────

/**
 * Handler map — maps each capability to its lib-level response function.
 * Using Map for safe key lookup (no prototype pollution).
 */
const LIB_RESPONSE_MAP: Map<DegradeCapability, (ctx: DegradeResponseContext) => void> = new Map([
  [DegradeCapability.DATABASE, handleDatabaseResponse],
  [DegradeCapability.AUTH, handleAuthResponse],
  [DegradeCapability.SYNC, handleSyncResponse],
  [DegradeCapability.CONNECTIVITY, handleConnectivityResponse],
  [DegradeCapability.STORAGE, handleStorageResponse],
  [DegradeCapability.BACKGROUND_JOBS, handleBackgroundJobsResponse],
  [DegradeCapability.ANALYTICS, handleAnalyticsResponse],
  [DegradeCapability.ERROR_TRACKING, handleErrorTrackingResponse],
  [DegradeCapability.PREMIUM_FEATURES, handlePremiumFeaturesResponse],
]);

/**
 * Register all lib-level degradation response handlers.
 * Call once during app initialization (after degrade-manager is available).
 *
 * @returns Cleanup function that unregisters all handlers
 */
export function registerAllLibResponses(): () => void {
  const unregisters: (() => void)[] = [];

  for (const [capability, handler] of LIB_RESPONSE_MAP) {
    const unregister = registerDegradeResponse(capability, handler);
    unregisters.push(unregister);
  }

  return () => {
    for (const unregister of unregisters) {
      unregister();
    }
  };
}
