/**
 * Degradation System - Barrel Export
 *
 * Central app degradation infrastructure for graceful failure handling.
 * Allows multiple systems to report capability degradation at runtime.
 *
 * Usage:
 * ```typescript
 * import { degradeManager, DegradeCapability } from '@/system/Degrade';
 *
 * // Report degradation
 * degradeManager.set('database', false, {
 *   source: 'services-phase',
 *   reason: 'database connection failed'
 * });
 *
 * // Check capability
 * if (degradeManager.isCapable('database')) {
 *   // Can query database
 * } else {
 *   // Use cached/offline fallback
 * }
 *
 * // Subscribe to changes
 * const unsubscribe = degradeManager.subscribe((state) => {
 *   console.log('Degradation state:', state.capabilities);
 * });
 * ```
 */

// Core manager + types
export { degradeManager, DegradeManager } from './degrade-manager';
export {
  DegradeCapability,
  type DegradeCapabilityState,
  type DegradeState,
  type DegradeSubscriber,
} from './types';

// Handlers: connectivity (always-listening subscription)
export { initializeConnectivityHandler } from './handlers/connectivity-handler';

// Handlers: fault (on-demand, called from middleware error paths)
export {
  reportDatabaseFault,
  reportDatabaseRecovery,
  reportAuthFault,
  reportAuthRecovery,
  reportAnalyticsFault,
  reportAnalyticsRecovery,
  reportErrorTrackingFault,
  reportErrorTrackingRecovery,
  reportPremiumFault,
  reportPremiumRecovery,
  syncServiceStatusesToDegradeManager,
  areCriticalCapabilitiesReady,
} from './handlers/fault-handlers';

// Handlers: crash (unrecoverable failures — follow with error boundary or safe mode)
export {
  reportStorageCrash,
  reportConfigBootstrapCrash,
  reportPreloadBootstrapCrash,
  reportJobsBootstrapCrash,
} from './handlers/crash-handlers';


