/**
 * Fault Degradation Handlers
 *
 * ON-DEMAND functions — called from middleware error paths, NOT always-listening.
 * Each function checks a specific capability and sets the degradeManager flag
 * when the system is unavailable.
 *
 * Pattern: middleware catches error → calls checkXxxHealth() → degradeManager updated.
 * Logic lives here, centralized, not duplicated inline across middleware files.
 *
 * Capabilities covered (on-demand):
 * - DATABASE: called when database provider check fails in middleware
 * - AUTH: called when auth provider is missing/unavailable in middleware
 * - ANALYTICS: called when no enabled exporters are found
 * - ERROR_TRACKING: called when error tracker is not ready
 * - PREMIUM_FEATURES: called when entitlement check fails
 *
 * Note: SYNC and BACKGROUND_JOBS subscription handlers live in lib/degrade/handlers/
 * because they depend on lib-layer systems (sync-manager, job-service).
 */

import { getAllServiceStatuses } from '@/system/Services/service-status';
import { degradeManager } from '../degrade-manager';
import { DegradeCapability } from '../types';

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
  degradeManager.set(DegradeCapability.DATABASE, false, {
    source: SOURCE,
    reason,
  });
}

/**
 * Called when database service recovers (e.g., provider re-initialized).
 * Clears the fault so DATABASE capability is restored.
 */
export function reportDatabaseRecovery(): void {
  degradeManager.set(DegradeCapability.DATABASE, true, {
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
  degradeManager.set(DegradeCapability.AUTH, false, {
    source: SOURCE,
    reason,
  });
}

/**
 * Called when auth provider becomes available again.
 */
export function reportAuthRecovery(): void {
  degradeManager.set(DegradeCapability.AUTH, true, {
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
  degradeManager.set(DegradeCapability.ANALYTICS, false, {
    source: SOURCE,
    reason,
  });
}

/**
 * Called when analytics exporter becomes available again.
 */
export function reportAnalyticsRecovery(): void {
  degradeManager.set(DegradeCapability.ANALYTICS, true, {
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
  degradeManager.set(DegradeCapability.ERROR_TRACKING, false, {
    source: SOURCE,
    reason,
  });
}

/**
 * Called when error tracker becomes available again.
 */
export function reportErrorTrackingRecovery(): void {
  degradeManager.set(DegradeCapability.ERROR_TRACKING, true, {
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
  degradeManager.set(DegradeCapability.PREMIUM_FEATURES, false, {
    source: SOURCE,
    reason,
  });
}

/**
 * Called when entitlements are successfully verified again.
 */
export function reportPremiumRecovery(): void {
  degradeManager.set(DegradeCapability.PREMIUM_FEATURES, true, {
    source: SOURCE,
    reason: 'entitlements verified',
  });
}

// ==========================================
// COMPOSITE: Sync service statuses → capabilities
// ==========================================

/**
 * Reads all service statuses from the service registry and maps them
 * to degradeManager capability flags.
 *
 * Call this after bootstrap completes to sync initial service health state
 * into the degradeManager. Subsequent changes should use the individual
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
        degradeManager.set(DegradeCapability.DATABASE, !degraded, {
          source: 'service-status-sync',
          reason: degraded ? (detail.message ?? `database ${detail.status}`) : 'database ready',
        });
        break;

      case 'auth':
        degradeManager.set(DegradeCapability.AUTH, !degraded, {
          source: 'service-status-sync',
          reason: degraded ? (detail.message ?? `auth ${detail.status}`) : 'auth ready',
        });
        break;

      case 'analytics':
        degradeManager.set(DegradeCapability.ANALYTICS, !degraded, {
          source: 'service-status-sync',
          reason: degraded ? (detail.message ?? `analytics ${detail.status}`) : 'analytics ready',
        });
        break;

      case 'errorTracker':
        degradeManager.set(DegradeCapability.ERROR_TRACKING, !degraded, {
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
 * Convenience wrapper over degradeManager.isCapable() for both at once.
 */
export function areCriticalCapabilitiesReady(): boolean {
  return (
    degradeManager.isCapable(DegradeCapability.DATABASE) &&
    degradeManager.isCapable(DegradeCapability.AUTH)
  );
}
