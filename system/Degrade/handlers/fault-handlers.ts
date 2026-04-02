/**
 * Fault Degradation Handlers
 *
 * ON-DEMAND functions — called from middleware error paths and bootstrap phases.
 * Each function updates the appDegrade flag when a system is unavailable
 * or recovers.
 *
 * Pattern: phase/middleware catches error → calls reportXxxFault() → appDegrade updated.
 * Logic lives here, centralized, not duplicated inline across phase or middleware files.
 *
 * Capabilities covered (on-demand):
 * - DATABASE: called when database provider check fails
 * - AUTH: called when auth provider is missing/unavailable
 * - ANALYTICS: called when no enabled exporters are found
 * - ERROR_TRACKING: called when error tracker is not ready
 * - PREMIUM_FEATURES: called when entitlement check fails
 * - CONNECTIVITY: called when network detection fails at bootstrap (different from
 *   connectivity-handler.ts which is an always-listening subscription)
 * - BACKGROUND_JOBS: called when job registration fails (non-critical fault,
 *   different from crash-handler's reportJobsBootstrapCrash for full infra failure)
 *
 * Note: SYNC subscription handler lives in lib/degrade/handlers/ (Track 4)
 * because it depends on lib-layer sync-manager.
 */

import { getAllServiceStatuses } from '@/system/Services/service-status';
import { DegradeCapability } from '@/type-definitions/degrade';
import { appDegrade } from '../app-degrade';

const SOURCE = 'fault-handler';

// ==========================================
// DATABASE
// ==========================================

/**
 * Called when a database middleware check fails at runtime.
 * Sets DATABASE capability to false so the app knows to use cached/offline data.
 *
 * @param reason Human-readable failure reason from the middleware
 */
export function reportDatabaseFault(reason: string): void {
  appDegrade.set(DegradeCapability.DATABASE, false, {
    source: SOURCE,
    reason,
  });
}

/**
 * Called when database service recovers (e.g., provider re-initialized).
 * Clears the fault so DATABASE capability is restored.
 */
export function reportDatabaseRecovery(): void {
  appDegrade.set(DegradeCapability.DATABASE, true, {
    source: SOURCE,
    reason: 'database provider available',
  });
}

// ==========================================
// AUTH
// ==========================================

/**
 * Called when auth provider is missing or unavailable in middleware.
 * Sets AUTH capability to false so app falls back to anonymous/cached session.
 *
 * @param reason Human-readable failure reason from the middleware
 */
export function reportAuthFault(reason: string): void {
  appDegrade.set(DegradeCapability.AUTH, false, {
    source: SOURCE,
    reason,
  });
}

/**
 * Called when auth provider becomes available again.
 */
export function reportAuthRecovery(): void {
  appDegrade.set(DegradeCapability.AUTH, true, {
    source: SOURCE,
    reason: 'auth provider available',
  });
}

// ==========================================
// ANALYTICS
// ==========================================

/**
 * Called when analytics dispatch finds no enabled exporters.
 * Sets ANALYTICS capability to false — events are silently dropped.
 * No user-visible impact; developer/ops concern only.
 *
 * @param reason Human-readable failure reason
 */
export function reportAnalyticsFault(reason: string): void {
  appDegrade.set(DegradeCapability.ANALYTICS, false, {
    source: SOURCE,
    reason,
  });
}

/**
 * Called when analytics exporter becomes available again.
 */
export function reportAnalyticsRecovery(): void {
  appDegrade.set(DegradeCapability.ANALYTICS, true, {
    source: SOURCE,
    reason: 'analytics exporter available',
  });
}

// ==========================================
// ERROR TRACKING
// ==========================================

/**
 * Called when error tracker is not ready or unavailable.
 * Sets ERROR_TRACKING to false — errors are logged locally only.
 * No user-visible impact; developer/ops concern only.
 *
 * @param reason Human-readable failure reason
 */
export function reportErrorTrackingFault(reason: string): void {
  appDegrade.set(DegradeCapability.ERROR_TRACKING, false, {
    source: SOURCE,
    reason,
  });
}

/**
 * Called when error tracker becomes available again.
 */
export function reportErrorTrackingRecovery(): void {
  appDegrade.set(DegradeCapability.ERROR_TRACKING, true, {
    source: SOURCE,
    reason: 'error tracker available',
  });
}

// ==========================================
// PREMIUM FEATURES
// ==========================================

/**
 * Called when entitlement or feature flag check fails at runtime.
 * Sets PREMIUM_FEATURES to false — premium UI hidden, basic features only.
 *
 * This uses a "safe fail" approach: if we can't verify entitlements,
 * lock premium rather than unlock it (security-first).
 *
 * @param reason Human-readable failure reason
 */
export function reportPremiumFault(reason: string): void {
  appDegrade.set(DegradeCapability.PREMIUM_FEATURES, false, {
    source: SOURCE,
    reason,
  });
}

/**
 * Called when entitlements are successfully verified again.
 */
export function reportPremiumRecovery(): void {
  appDegrade.set(DegradeCapability.PREMIUM_FEATURES, true, {
    source: SOURCE,
    reason: 'entitlements verified',
  });
}

// ==========================================
// CONNECTIVITY (bootstrap fault — not runtime)
// ==========================================

/**
 * Called when network detection initialization fails at bootstrap.
 * This is NOT the same as going offline at runtime (that's connectivity-handler.ts).
 * This means the NetworkDetection system itself couldn't start.
 *
 * The app continues — it defaults to "assumed online" and works offline-first.
 *
 * @param reason Network detection failure detail
 */
export function reportConnectivityBootstrapFault(reason: string): void {
  appDegrade.set(DegradeCapability.CONNECTIVITY, false, {
    source: 'network-phase',
    reason,
  });
}

// ==========================================
// BACKGROUND JOBS (registration faults)
// ==========================================

/**
 * Called when individual job handler registration or subscription activation fails.
 * Non-critical — the app continues but some background tasks won't execute.
 *
 * Different from crash-handler's reportJobsBootstrapCrash() which is for
 * complete job infrastructure failure (queue can't initialize at all).
 *
 * @param reason Registration failure detail (e.g., "Job handler registration failed: syncJob")
 */
export function reportBackgroundJobsFault(reason: string): void {
  appDegrade.set(DegradeCapability.BACKGROUND_JOBS, false, {
    source: 'registration-phase',
    reason,
  });
}

/**
 * Called when background jobs recover (e.g., re-registration succeeds).
 */
export function reportBackgroundJobsRecovery(): void {
  appDegrade.set(DegradeCapability.BACKGROUND_JOBS, true, {
    source: 'registration-phase',
    reason: 'job handlers registered',
  });
}

// ==========================================
// COMPOSITE: Sync service statuses → capabilities
// ==========================================

/**
 * Reads all service statuses from the service registry and maps them
 * to appDegrade capability flags.
 *
 * Call this after bootstrap completes to sync initial service health state
 * into the appDegrade. Subsequent changes should use the individual
 * report* functions above.
 *
 * Maps:
 * - database: 'failed' | 'disabled' → DATABASE false
 * - auth: 'failed' | 'disabled'     → AUTH false
 * - analytics: 'failed' | 'disabled' → ANALYTICS false
 * - errorTracker: 'failed' | 'disabled' → ERROR_TRACKING false
 */
export function syncServiceStatusesToDegradeManager(): void {
  const statuses = getAllServiceStatuses();

  for (const [service, detail] of Object.entries(statuses)) {
    const degraded = detail.status === 'failed' || detail.status === 'disabled';

    switch (service) {
      case 'database':
        appDegrade.set(DegradeCapability.DATABASE, !degraded, {
          source: 'service-status-sync',
          reason: degraded ? (detail.message ?? `database ${detail.status}`) : 'database ready',
        });
        break;

      case 'auth':
        appDegrade.set(DegradeCapability.AUTH, !degraded, {
          source: 'service-status-sync',
          reason: degraded ? (detail.message ?? `auth ${detail.status}`) : 'auth ready',
        });
        break;

      case 'analytics':
        appDegrade.set(DegradeCapability.ANALYTICS, !degraded, {
          source: 'service-status-sync',
          reason: degraded ? (detail.message ?? `analytics ${detail.status}`) : 'analytics ready',
        });
        break;

      case 'errorTracker':
        appDegrade.set(DegradeCapability.ERROR_TRACKING, !degraded, {
          source: 'service-status-sync',
          reason: degraded ? (detail.message ?? `error tracker ${detail.status}`) : 'error tracker ready',
        });
        break;

      // Other services (e.g., future ones) are ignored — no matching capability
    }
  }
}

/**
 * Quick health check: are critical services (database + auth) capable?
 * Convenience wrapper over appDegrade.isCapable() for both at once.
 */
export function areCriticalCapabilitiesReady(): boolean {
  return (
    appDegrade.isCapable(DegradeCapability.DATABASE) &&
    appDegrade.isCapable(DegradeCapability.AUTH)
  );
}
