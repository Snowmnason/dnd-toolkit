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
import { registerDegradeResponse } from './degrade-manager';

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
  if (!ctx.available) {
    // TODO: Show "offline mode" banner or toast via lib/toast
    // TODO: Gate features that require live database (world creation, settings sync)
    // TODO: Switch data reads to cache-only mode via QueryCache
    // TODO: If isCrash, consider navigating to safe mode screen
    console.warn(`[LibResponse] DATABASE ${ctx.isCrash ? 'CRASHED' : 'degraded'} — reason: ${ctx.reason}`);
  } else {
    // TODO: Hide offline banner
    // TODO: Un-gate database-dependent features
    // TODO: Trigger stale data refresh for any cached reads
    console.info('[LibResponse] DATABASE recovered');
  }
}

function handleAuthResponse(ctx: DegradeResponseContext): void {
  if (!ctx.available) {
    // TODO: Show "session expired" banner or redirect to login
    // TODO: Gate operations that require authenticated state
    // TODO: If isCrash, force navigation to login screen
    // TODO: Preserve unsaved user work before redirecting
    console.warn(`[LibResponse] AUTH ${ctx.isCrash ? 'CRASHED' : 'degraded'} — reason: ${ctx.reason}`);
  } else {
    // TODO: Hide session expired banner
    // TODO: Restore authenticated feature access
    // TODO: Re-validate world access if user was in a world
    console.info('[LibResponse] AUTH recovered');
  }
}

function handleSyncResponse(ctx: DegradeResponseContext): void {
  if (!ctx.available) {
    // TODO: Show "sync unavailable" indicator in UI
    // TODO: Mark data as potentially stale (show timestamps on last-synced data)
    // TODO: Disable real-time collaboration features
    // TODO: If isCrash, show persistent warning about data consistency
    console.warn(`[LibResponse] SYNC ${ctx.isCrash ? 'CRASHED' : 'degraded'} — reason: ${ctx.reason}`);
  } else {
    // TODO: Hide sync unavailable indicator
    // TODO: Clear stale data markers
    // TODO: Re-enable real-time collaboration
    console.info('[LibResponse] SYNC recovered');
  }
}

function handleConnectivityResponse(ctx: DegradeResponseContext): void {
  if (!ctx.available) {
    // TODO: Show persistent "no connection" banner at top of screen
    // TODO: Switch entire app to offline-first mode
    // TODO: Disable features that absolutely require network (world joining, account creation)
    // TODO: Show cached data with "offline" watermark
    console.warn(`[LibResponse] CONNECTIVITY degraded — reason: ${ctx.reason}`);
  } else {
    // TODO: Hide "no connection" banner
    // TODO: Trigger data sync for any changes made while offline
    // TODO: Re-enable network-dependent features
    // TODO: Show brief "back online" toast
    console.info('[LibResponse] CONNECTIVITY recovered');
  }
}

function handleStorageResponse(ctx: DegradeResponseContext): void {
  if (!ctx.available) {
    // TODO: Show critical warning — storage failures affect data persistence
    // TODO: Disable features that write to storage (settings, preferences, world data)
    // TODO: If isCrash, navigate to safe mode (data loss risk)
    console.warn(`[LibResponse] STORAGE ${ctx.isCrash ? 'CRASHED' : 'degraded'} — reason: ${ctx.reason}`);
  } else {
    // TODO: Hide storage warning
    // TODO: Re-enable storage-dependent features
    // TODO: Verify data integrity after recovery
    console.info('[LibResponse] STORAGE recovered');
  }
}

function handleBackgroundJobsResponse(ctx: DegradeResponseContext): void {
  if (!ctx.available) {
    // TODO: Show subtle indicator that background processing is paused
    // TODO: Warn user that scheduled operations (auto-save, sync) are delayed
    // TODO: If jobs are user-visible (export, import), show specific status
    console.warn(`[LibResponse] BACKGROUND_JOBS degraded — reason: ${ctx.reason}`);
  } else {
    // TODO: Hide background processing indicator
    // TODO: Show brief "operations resumed" toast if user was waiting
    console.info('[LibResponse] BACKGROUND_JOBS recovered');
  }
}

function handleAnalyticsResponse(ctx: DegradeResponseContext): void {
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
    // Rate-limit degradation reports to prevent spam (e.g., on every screen transition)
    if (shouldReportDegradation('ANALYTICS')) {
      // Analytics degradation is invisible to users — no UI response needed
      // TODO: Log internally for debugging purposes only
      console.warn(`[LibResponse] ANALYTICS degraded — reason: ${ctx.reason}`);
      recordDegradationReport('ANALYTICS');
    }
  } else {
    // Always report recovery (user gets service back)
    console.info('[LibResponse] ANALYTICS recovered');
    lastDegradationReport.delete('ANALYTICS'); // Reset timer on recovery
  }
}

function handleErrorTrackingResponse(ctx: DegradeResponseContext): void {
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
    // Rate-limit degradation reports to prevent spam (e.g., on every screen transition)
    if (shouldReportDegradation('ERROR_TRACKING')) {
      // Error tracking degradation is invisible to users — no UI response needed
      // TODO: Log internally; consider buffering critical errors for later submission
      console.warn(`[LibResponse] ERROR_TRACKING degraded — reason: ${ctx.reason}`);
      recordDegradationReport('ERROR_TRACKING');
    }
  } else {
    // Always report recovery (user gets service back)
    console.info('[LibResponse] ERROR_TRACKING recovered');
    lastDegradationReport.delete('ERROR_TRACKING'); // Reset timer on recovery
  }
}

function handlePremiumFeaturesResponse(ctx: DegradeResponseContext): void {
  if (!ctx.available) {
    // TODO: Gate premium UI features (lock icons, upgrade prompts)
    // TODO: Show "premium unavailable" messaging if user had active subscription
    // TODO: Gracefully hide premium-only screens/components
    console.warn(`[LibResponse] PREMIUM_FEATURES degraded — reason: ${ctx.reason}`);
  } else {
    // TODO: Unlock premium UI features
    // TODO: Refresh entitlements display
    console.info('[LibResponse] PREMIUM_FEATURES recovered');
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
