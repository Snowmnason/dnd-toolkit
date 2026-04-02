/**
 * Degradation Service Middleware
 *
 * Thin wrapper for reporting degradation events via error-service.
 * Delegates precondition checks (network, consent, service readiness) to error-service.
 *
 * Only reports to error tracking (not analytics) — degradation is error-level telemetry.
 */

import { reportMessage, type SeverityLevel } from '@/lib/middleware/services/error-service';
import { appDegrade } from '@/system/Degrade';

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
