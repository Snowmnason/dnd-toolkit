/**
 * Degradation System - Barrel Export
 *
 * Central app degradation infrastructure for graceful failure handling.
 * Allows multiple systems to report capability degradation at runtime.
 *
 * Usage:
 * ```typescript
 * import { appDegrade, DegradeCapability } from '@/system/Degrade';
 *
 * // Report degradation
 * appDegrade.set('database', false, {
 *   source: 'services-phase',
 *   reason: 'database connection failed'
 * });
 *
 * // Check capability
 * if (appDegrade.isCapable('database')) {
 *   // Can query database
 * } else {
 *   // Use cached/offline fallback
 * }
 *
 * // Subscribe to changes
 * const unsubscribe = appDegrade.subscribe((state) => {
 *   console.log('Degradation state:', state.capabilities);
 * });
 * ```
 */

// Core manager + types
export { appDegrade, DegradeManager } from './app-degrade';

// Handlers: connectivity (always-listening subscription)
export { initializeConnectivityHandler } from './handlers/connectivity-handler';

// Handlers: fault (on-demand, called from middleware error paths)
export {
    areCriticalCapabilitiesReady, reportAnalyticsFault,
    reportAnalyticsRecovery, reportAuthFault,
    reportAuthRecovery, reportDatabaseFault,
    reportDatabaseRecovery, reportErrorTrackingFault,
    reportErrorTrackingRecovery,
    reportPremiumFault,
    reportPremiumRecovery,
    syncServiceStatusesToDegradeManager
} from './handlers/fault-handlers';

// Handlers: crash (unrecoverable failures — follow with error boundary or safe mode)
export {
    reportConfigBootstrapCrash, reportJobsBootstrapCrash, reportPreloadBootstrapCrash, reportStorageCrash
} from './handlers/crash-handlers';

// System-level response handlers (registered during bootstrap)
export { registerAllSystemResponses } from './responses/system-responses';


