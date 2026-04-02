/**
 * Error Service — Middleware between lib modules and System/Services error-adapter
 *
 * This is the ONLY file in lib that imports from the error adapter.
 * All other lib modules, hooks, components, and screens call these functions instead.
 *
 * Middleware Responsibilities:
 * - Precondition: Check network connectivity (if offline, error report is lost — acceptable)
 * - Precondition: Check provider is initialized (isServiceReady)
 * - Precondition: Check analytics consent before reporting user data
 * - Single entry point to error tracking adapter
 *
 * Does NOT:
 * - Validate data (modules validate their own data before calling here)
 * - Contain domain logic (that stays in lib/error/)
 */

import { logger } from '@/lib/utils/logger';
import { ConnectionQuality, NetworkDetection } from '@/system/Network';
import {
    getErrorTracker,
    isServiceReady,
    type ErrorCaptureOptions,
    type ErrorTrackerProvider,
    type SeverityLevel,
    type TrackerBreadcrumb,
    type TrackerUser,
} from '@/system/Services';

// Re-export types for consumers
export type { SeverityLevel };

// ─── Precondition Checks ───────────────────────────────────────────

/**
 * Check if error reporting preconditions are met.
 * Returns false if we should silently drop the report.
 */
function canReport(): boolean {
    // 1. Network available?
    const networkStatus = NetworkDetection.getStatus();
    if (networkStatus.connectionQuality === ConnectionQuality.OFFLINE) {
        // TODO: Queue error for later delivery? For now, still attempt — provider may buffer internally.
        logger.category('error').debug('[error-service] Network offline — attempting report anyway (provider may buffer)');
        // Don't block — let provider handle its own offline behavior
    }

    // 2. Analytics consent? (error tracking requires at least 'basic' consent)
    // Lazy import to break circular dependency between analytics and error services
    try {
        const { AnalyticsConsent } = require('@/lib/analytics/consent/consent') as typeof import('@/lib/analytics/consent/consent');
        const consentLevel = AnalyticsConsent.getLevel();
        if (consentLevel === 'none') {
            // User has explicitly opted out of all analytics — respect that
            logger.category('error').debug('[error-service] Consent level is "none" — dropping error report');
            return false;
        }
    } catch (e) {
        // Consent module failed to load (shouldn't happen, but safer to report than silently fail)
        logger.category('error').warn('[error-service] Failed to check consent', e);
        // Default to allowing report — don't block on consent check failure
    }    

    // 3. Provider initialized?
    if (!isServiceReady('errorTracker')) {
        // Service temporarily down (still initializing). 
        // FUTURE: Queue error for retry after initialization.
        // Current behavior: silently drop (acceptable since consent check already filters disabled services).
        logger.category('error').debug('[error-service] Error tracker not ready — dropping report');
        return false;
    }

    return true;
}

/**
 * Check if consent allows sending user context to error tracker.
 * Requires 'full' consent since it includes PII (user ID, email).
 */
function canSetUserContext(): boolean {
    try {
         
        const { AnalyticsConsent } = require('@/lib/analytics/consent/consent') as typeof import('@/lib/analytics/consent/consent');
        return AnalyticsConsent.getLevel() === 'full';
    } catch (e) {
        // Consent module failed to load — default to no user context for safety
        logger.category('error').warn('[error-service] Failed to check user context consent', e);
        return false;
    }
}

// ─── Error Reporting ───────────────────────────────────────────────

/**
 * Report an exception to the error tracking provider.
 * Data should already be validated by the calling module.
 * Checks network, provider readiness, and consent before sending.
 *
 * @param error - The error to report
 * @param options - Optional tags, extra context, severity level
 */
export function reportError(error: Error, options?: ErrorCaptureOptions): void {
    if (!canReport()) return;
    getErrorTracker().captureException(error, options);
}

/**
 * Report a message to the error tracking provider.
 * Checks network, provider readiness, and consent before sending.
 *
 * @param message - Message text
 * @param level - Severity level (defaults to 'error')
 */
export function reportMessage(message: string, level: SeverityLevel = 'error'): void {
    if (!canReport()) return;
    getErrorTracker().captureMessage(message, level);
}

// ─── Breadcrumbs ───────────────────────────────────────────────────

/**
 * Add a breadcrumb for contextual tracking.
 * Only checks provider readiness (breadcrumbs are low-cost local ops).
 *
 * @param breadcrumb - Breadcrumb with category, message, optional data
 */
export function addErrorBreadcrumb(breadcrumb: TrackerBreadcrumb): void {
    if (!isServiceReady('errorTracker')) return;
    getErrorTracker().addBreadcrumb(breadcrumb);
}

// ─── User Context ──────────────────────────────────────────────────

/**
 * Set or clear the user context on the error tracker.
 * Requires 'full' consent since user context includes PII.
 *
 * @param user - User data or null to clear
 */
export function setErrorUser(user: TrackerUser | null): void {
    if (!isServiceReady('errorTracker')) return;

    // Clearing user context is always allowed
    if (user === null) {
        getErrorTracker().setUser(null);
        return;
    }

    // Setting user context requires full consent (PII)
    if (!canSetUserContext()) {
        logger.category('error').debug('[error-service] Consent not "full" — skipping user context');
        return;
    }

    getErrorTracker().setUser(user);
}

// ─── Status ────────────────────────────────────────────────────────

/**
 * Check if the error tracker is enabled and delivering events.
 */
export function isErrorTrackingEnabled(): boolean {
    return isServiceReady('errorTracker') && getErrorTracker().isEnabled();
}

/**
 * Flush any pending error events to the backend.
 *
 * @param timeoutMs - Maximum time to wait for flush (ms)
 * @returns true if flush succeeded within timeout
 */
export async function flushErrors(timeoutMs?: number): Promise<boolean> {
    if (!isServiceReady('errorTracker')) return true;
    return getErrorTracker().flush?.(timeoutMs) ?? true;
}

// ─── Direct Access (escape hatch) ──────────────────────────────────

/**
 * Get the raw error tracker instance.
 * Prefer the wrapper functions above. Use this only when you need
 * direct access to the full ErrorTrackerProvider interface.
 * BYPASSES all middleware checks.
 *
 * @internal
 */
export function getErrorTrackerInstance(): ErrorTrackerProvider {
    return getErrorTracker();
}
