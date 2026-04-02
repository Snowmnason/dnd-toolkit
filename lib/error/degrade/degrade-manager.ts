/**
 * Degradation Manager — Domain wrapper for degradation reporting & tracking
 *
 * This is the ONLY file that lib modules and system handlers should import for degradation operations.
 * Routes all degradation events through the degradation-service middleware, which delegates
 * error telemetry to the error-service (network checks, consent, provider readiness all handled there).
 *
 * Architecture:
 *   handlers → lib/error/degrade/degrade-manager → lib/middleware/degrade/degradation-service → lib/error/error-manager
 *
 * What this provides:
 * - reportCrash — report unrecoverable bootstrap failure
 * - reportFault — report recoverable runtime failure
 * - reportRecovery — report when a capability recovers
 * - subscribe — listen to degradation state changes (for hooks)
 * - getState — get current degradation state
 * - isCapable — check if a capability is still operational
 *
 * Hook Integration:
 * - Subscriptions are stored and cleaned up properly
 * - Hooks can listen to specific capabilities or entire state
 * - State changes trigger subscriber callbacks with full degradation state
 *
 * Future:
 * - Recovery strategies per capability
 * - Automatic retry logic
 * - Degradation mode UI (reduced feature set)
 */

import { appDegrade } from '@/system/Degrade';
import { DegradeCapability, DegradeResponseContext, DegradeResponseHandler, DegradeState } from '@/type-definitions/degrade';

// ─── Priority Queue ────────────────────────────────────────────────

/**
 * Priority ordering for capabilities — lower number = processed/surfaced first.
 * Network is highest priority (all systems depend on it).
 * Premium features are lowest (optional enhancement).
 */
const PRIORITY_MAP = new Map<DegradeCapability, number>([
  [DegradeCapability.CONNECTIVITY, 0],
  [DegradeCapability.AUTH, 1],
  [DegradeCapability.STORAGE, 2],
  [DegradeCapability.SYNC, 3],
  [DegradeCapability.BACKGROUND_JOBS, 4],
  [DegradeCapability.ANALYTICS, 5],
  [DegradeCapability.ERROR_TRACKING, 6],
  [DegradeCapability.DATABASE, 7],
  [DegradeCapability.PREMIUM_FEATURES, 99],
]);

/** An active fault tracked in the priority queue */
export interface FaultRecord {
  capability: DegradeCapability;
  reason: string;
  /** Lower number = higher importance */
  priority: number;
  /** true if this fault triggered safe mode (crash-level) */
  isCrash: boolean;
  timestamp: number;
}

/** In-memory priority queue of active faults — sorted ascending by priority */
const activeFaults: FaultRecord[] = [];

function enqueueFault(
  capability: DegradeCapability,
  reason: string,
  isCrash: boolean,
): void {
  // Replace existing entry for this capability (deduplicate)
  const idx = activeFaults.findIndex((f) => f.capability === capability);
  if (idx !== -1) {
    activeFaults.splice(idx, 1);
  }
  activeFaults.push({
    capability,
    reason,
    priority: PRIORITY_MAP.get(capability) ?? 50,
    isCrash,
    timestamp: Date.now(),
  });
  // Ascending sort: lowest priority number first (highest importance)
  activeFaults.sort((a, b) => a.priority - b.priority);
}

function dequeueFault(capability: DegradeCapability): void {
  const idx = activeFaults.findIndex((f) => f.capability === capability);
  if (idx !== -1) {
    activeFaults.splice(idx, 1);
  }
}

/**
 * Get the highest-priority active fault, or null if all capabilities are healthy.
 * Useful for UI components that want to surface a single "primary issue" banner.
 */
export function getPrimaryFault(): FaultRecord | null {
  return activeFaults.length > 0 ? (activeFaults[0] ?? null) : null;
}

// Lazy import to break circular dependency with error-service
function getDegradationService() {
  return require('@/lib/middleware/degrade/degradation-service') as typeof import('@/lib/middleware/degrade/degradation-service');
}

// Lazy imports — avoids circular deps with safe-mode and kernel modules
function getSafeModeModule() {
  return require('@/lib/error/safemode/safe-mode') as typeof import('@/lib/error/safemode/safe-mode');
}

function getKernelManager() {
  return require('@/lib/kernel/kernel-manager') as typeof import('@/lib/kernel/kernel-manager');
}

// ─── Hook Subscription System ──────────────────────────────────────

type DegradationSubscriber = (state: DegradeState) => void;
const subscribers = new Set<DegradationSubscriber>();

// ─── Lib-Level Response Registry ───────────────────────────────────

/**
 * Lib-level response handlers — centralized registry.
 * Each capability maps to ONE handler that runs automatically when its degradation
 * state is reported via reportCrash/reportFault/reportRecovery.
 *
 * These are LIB-LEVEL responses: UI decisions, feature gating, mode switching,
 * banner display, navigation guards.
 *
 * For system-level responses (process stopping, queue pausing),
 * see system/Degrade/responses/system-responses.ts.
 */
const libResponses: Map<DegradeCapability, DegradeResponseHandler> = new Map();

/**
 * Register a lib-level response handler for a capability.
 * Only ONE handler per capability — last registration wins.
 * Handler fires automatically when reportCrash/reportFault/reportRecovery is called.
 *
 * @returns Unregister function
 *
 * @example
 * ```ts
 * import { registerDegradeResponse, DegradeCapability } from '@/lib/error/degrade';
 *
 * const unregister = registerDegradeResponse(DegradeCapability.DATABASE, (ctx) => {
 *   if (!ctx.available) {
 *     showOfflineBanner();
 *   } else {
 *     hideOfflineBanner();
 *   }
 * });
 * ```
 */
export function registerDegradeResponse(
  capability: DegradeCapability,
  handler: DegradeResponseHandler,
): () => void {
  libResponses.set(capability, handler);
  return () => {
    if (libResponses.get(capability) === handler) {
      libResponses.delete(capability);
    }
  };
}

/**
 * Execute the registered lib response for a capability.
 * Internal — called by reportCrash/reportFault/reportRecovery.
 * Wrapped in try/catch — response errors must never break degradation reporting.
 */
function executeLibResponse(context: DegradeResponseContext): void {
  const handler = libResponses.get(context.capability);
  if (!handler) return;

  try {
    handler(context);
  } catch (error) {
    console.error(`[DegradeManager] Lib response error for ${context.capability}:`, error);
  }
}

/**
 * Get count of registered lib response handlers (for debugging/testing)
 */
export function getLibResponseCount(): number {
  return libResponses.size;
}

/**
 * Clear all lib response handlers.
 * Called during testing or app reset.
 */
export function clearLibResponses(): void {
  libResponses.clear();
}

/**
 * Subscribe to degradation state changes.
 * Called by hooks to listen for capability degradation/recovery.
 *
 * @param callback - Function invoked with full degradation state on any change
 * @returns Unsubscribe function
 *
 * @example
 * ```ts
 * import { subscribeToDegradation } from '@/lib/error/degrade';
 *
 * const unsubscribe = subscribeToDegradation((state) => {
 *   if (!state.database.value) {
 *     showOfflineMode();
 *   }
 * });
 *
 * // Later, clean up
 * unsubscribe();
 * ```
 */
export function subscribeToDegradation(callback: DegradationSubscriber): () => void {
  subscribers.add(callback);

  // Return unsubscribe function
  return () => {
    subscribers.delete(callback);
  };
}

/**
 * Get current degradation state.
 * Used by hooks to read the current state before subscribing,
 * or to manually check state without setting up subscription.
 *
 * @returns Current full degradation state
 *
 * @example
 * ```ts
 * import { getDegradationState } from '@/lib/error/degrade';
 *
 * const state = getDegradationState();
 * if (!state.database.value) {
 *   // Database is degraded
 * }
 * ```
 */
export function getDegradationState(): DegradeState {
  if (!appDegrade?.getState) {
    return {} as DegradeState;
  }
  return appDegrade.getState();
}

/**
 * Check if a specific capability is operational.
 * Equivalent to checking `state.capability.value === true`.
 *
 * @param capability - Capability to check
 * @returns true if capability is fully operational
 *
 * @example
 * ```ts
 * import { isCapableOf, DegradeCapability } from '@/lib/error/degrade';
 *
 * if (isCapableOf(DegradeCapability.DATABASE)) {
 *   await syncData();
 * } else {
 *   useLocalCache();
 * }
 * ```
 */
export function isCapableOf(capability: DegradeCapability): boolean {
  if (!appDegrade?.isCapable) {
    return false; // System not initialized, assume degraded
  }
  return appDegrade.isCapable(capability);
}

// ─── Degradation Reporting ────────────────────────────────────────

/**
 * Trigger kernel safe mode for critical crash-level capabilities.
 * Only capabilities with a defined safe mode mapping will trigger safe mode.
 */
function triggerSafeModeForCrash(
  capability: DegradeCapability,
  reason: string,
  context?: Record<string, any>,
): void {
  try {
    const { createSafeModeState, SafeModeReason } = getSafeModeModule();
    const { setSafeMode } = getKernelManager();
    const reasonMap = new Map<DegradeCapability, typeof SafeModeReason[keyof typeof SafeModeReason]>([
      [DegradeCapability.STORAGE, SafeModeReason.STORAGE_UNREADABLE],
      [DegradeCapability.AUTH, SafeModeReason.AUTH_EXPIRED],
      [DegradeCapability.SYNC, SafeModeReason.NETWORK_CASCADE],
    ]);
    const safeModeReason = reasonMap.get(capability);
    if (!safeModeReason) return;
    setSafeMode(createSafeModeState(safeModeReason, {
      details: reason,
      originalError: context?.originalError as Error | undefined,
    }));
  } catch (err) {
    console.error('[DegradeManager] Failed to trigger safe mode for crash:', err);
  }
}

/**
 * Report an unrecoverable failure. Sets the capability's degradation flag and
 * triggers kernel safe mode for critical capabilities (STORAGE, AUTH, SYNC).
 *
 * @param capability - The capability that failed
 * @param reason - Brief description of the failure
 * @param context - Optional context data; `originalError` key forwarded to safe mode
 *
 * @example
 * ```ts
 * import { reportCrash, DegradeCapability } from '@/lib/error/degrade';
 *
 * reportCrash(DegradeCapability.SYNC, 'cascade-detected', { details: '3 consecutive failures' });
 * ```
 */
export function reportCrash(
  capability: DegradeCapability,
  reason: string,
  context?: Record<string, any>,
): void {
  // Track in priority queue (crash-level)
  enqueueFault(capability, reason, true);

  // Set degradation flag immediately
  if (appDegrade?.set) {
    appDegrade.set(capability, false, { reason, source: 'bootstrap-crash', ...context });
  }

  // Execute lib-level response (UI decisions, feature gating)
  executeLibResponse({ capability, available: false, reason, source: 'bootstrap-crash', isCrash: true });

  // Report as ERROR severity (Sentry): unrecoverable failure
  getDegradationService().reportDegradationEvent(capability, reason, 'error');

  // Trigger safe mode for critical crash-level capabilities
  triggerSafeModeForCrash(capability, reason, context);

  // Report via middleware (which delegates to error-service)
  getDegradationService().reportDegradationEvent(capability, reason);

  // Notify subscribers
  notifySubscribers();
}

/**
 * Report a recoverable runtime fault.
 * Sets degradation flag but allows app to continue with reduced functionality.
 *
 * Called when a service fails at runtime (e.g., database connection lost,
 * auth provider temporarily unavailable) but the app can still function.
 *
 * @param capability - The capability that faulted
 * @param reason - Brief description of the fault (e.g., 'network timeout')
 * @param context - Optional context data for debugging
 *
 * @example
 * ```ts
 * import { reportFault, DegradeCapability } from '@/lib/error/degrade';
 *
 * try {
 *   await fetchUser();
 * } catch (error) {
 *   reportFault(
 *     DegradeCapability.AUTH,
 *     'Failed to refresh user session',
 *     { error: error instanceof Error ? error.message : String(error) }
 *   );
 *   // App continues with cached user data
 * }
 * ```
 */
export function reportFault(
  capability: DegradeCapability,
  reason: string,
  context?: Record<string, any>,
): void {
  // Track in priority queue (recoverable fault)
  enqueueFault(capability, reason, false);

  // Set degradation flag immediately
  if (appDegrade?.set) {
    appDegrade.set(capability, false, { reason, source: 'runtime-fault', ...context });
  }

  // Execute lib-level response (UI decisions, feature gating)
  executeLibResponse({ capability, available: false, reason, source: 'runtime-fault', isCrash: false });

  // Report as WARNING severity (Sentry): recoverable fault
  getDegradationService().reportDegradationEvent(capability, reason, 'warning');

  // Report via middleware
  // (Note: reportDegradationEvent already handles it, but keeping this for audit trail if needed)
  // getDegradationService().reportDegradationEvent(capability, reason);


  // Notify subscribers
  notifySubscribers();
}

/**
 * Report that a degraded capability has recovered.
 * Clears degradation flag and notifies UI to restore full functionality.
 *
 * @param capability - The capability that recovered
 * @param reason - Brief description of recovery (e.g., 'network restored')
 * @param context - Optional context data for debugging
 *
 * @example
 * ```ts
 * import { reportRecovery, DegradeCapability } from '@/lib/error/degrade';
 *
 * onNetworkOnline(() => {
 *   reportRecovery(DegradeCapability.CONNECTIVITY, 'Network connection restored');
 * });
 * ```
 */
export function reportRecovery(
  capability: DegradeCapability,
  reason: string,
  context?: Record<string, any>,
): void {
  // Remove from priority queue
  dequeueFault(capability);

  // Clear degradation flag
  if (appDegrade?.set) {
    appDegrade.set(capability, true, { reason, source: 'recovery', ...context });
  }

  // Execute lib-level response (restore UI, re-enable features)
  executeLibResponse({ capability, available: true, reason, source: 'recovery', isCrash: false });

  // Report as INFO severity (Sentry): context only, not an error
  getDegradationService().reportDegradationEvent(capability, `[Recovery] ${reason}`, 'info');

  // Notify subscribers
  notifySubscribers();
}

// ─── Internal Helpers ──────────────────────────────────────────────

/**
 * Notify all subscribers of state change.
 * Called internally whenever a degradation event is reported.
 */
function notifySubscribers(): void {
  const state = getDegradationState();
  subscribers.forEach(callback => {
    try {
      callback(state);
    } catch (error) {
      // Log but don't propagate — one bad subscriber shouldn't break others
      console.error('[DegradeManager] Subscriber error:', error);
    }
  });
}
