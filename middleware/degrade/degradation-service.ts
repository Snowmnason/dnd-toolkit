/**
 * Degradation Service Middleware
 *
 * Thin wrapper for reporting degradation events via error-service.
 * Delegates precondition checks (network, consent, service readiness) to error-service.
 *
 * Only reports to error tracking (not analytics) — degradation is error-level telemetry.
 */

import { reportMessage, type SeverityLevel } from '@/middleware/services/error-service';
import { appDegrade } from '@/system/Degrade';
import { DegradeCapability, DegradeState } from '@/type-definitions/degrade';

/**
 * Report a degradation event via error tracking at specified severity level.
 *
 * Automatically delegates precondition checks to error-service:
 * - Network connectivity (errors dropped if offline; provider may buffer)
 * - Service readiness (waits for provider initialization)
 * - User consent (errors dropped if consent is 'none'; respects privacy choice)
 *
 * Severity levels:
 * - 'error': Unrecoverable failures (crashes that trigger safe mode)
 * - 'warning': Recoverable faults (runtime failures, app continues)
 * - 'info': State changes (recovery events, context only)
 *
 * Silent failures are acceptable—degradation reporting is optional telemetry.
 *
 * @param capability - The capability that degraded (e.g., 'database', 'auth')
 * @param reason - Brief description of why degradation occurred
 * @param severity - Severity level for error tracking (defaults to 'warning')
 */
export function reportDegradationEvent(
  capability: string,
  reason: string,
  severity: SeverityLevel = 'warning',
): void {
  // Quick check: degradation manager must be initialized
  if (!appDegrade?.isCapable) {
    return; // System not ready, silent failure
  }

  // Report via error-service (which handles network checks, consent, provider readiness)
  // Consent: If user opted out ('none'), error-service silently drops the report
  // Network: If offline, provider may buffer or drop depending on implementation
  // Either way, error-service respects the precondition checks — we don't rebuild that logic
  reportMessage(`[Degradation] ${capability}: ${reason}`, severity);
}

/**
 * Get current degradation state from system.
 * Safe fallback if system is not initialized.
 *
 * @returns Full degradation state or empty object if system not ready
 */
export function getDegradedState(): DegradeState {
  if (!appDegrade?.getState) {
    return {} as DegradeState;
  }
  return appDegrade.getState();
}

/**
 * Set capability degradation state in system.
 *
 * @param capability - The capability to update
 * @param available - true if operational, false if degraded
 * @param options - Source tracking metadata { source, reason, ...context }
 */
export function setCapabilityState(
  capability: DegradeCapability,
  available: boolean,
  options?: { source: string; reason: string; [key: string]: any },
): void {
  if (appDegrade?.set && options) {
    appDegrade.set(capability, available, { source: options.source, reason: options.reason });
  }
}

/**
 * Check if a capability is currently operational.
 *
 * @param capability - The capability to check
 * @returns true if operational, false if degraded or uninitialized
 */
export function getOperationalStatus(capability: DegradeCapability): boolean {
  if (!appDegrade?.isCapable) {
    return false;
  }
  return appDegrade.isCapable(capability);
}
