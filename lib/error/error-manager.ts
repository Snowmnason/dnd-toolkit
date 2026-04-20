/**
 * Error Manager — Domain wrapper for error reporting & tracking
 *
 * This is the ONLY file that lib modules should import for error tracking operations.
 * Routes all calls through the error-service middleware, which handles:
 * - Consent checks (analytics opt-out respected)
 * - Provider readiness (error tracker initialized)
 * - Network awareness (offline buffering)
 *
 * Architecture:
 *   lib modules → lib/error/error-manager → lib/middleware/services/error-service → system/Services/error-adapter
 *
 * What this provides:
 * - reportError / reportMessage — report errors/messages through middleware
 * - addBreadcrumb — add contextual breadcrumbs through middleware
 * - setUser / clearUser — manage user context (consent-aware)
 * - isTrackingEnabled — check if error tracking is active
 * - flushPendingErrors — flush buffered events
 *
 * Future:
 * - Hook system for lib modules to register error handlers
 * - Error recovery strategies (retry, fallback, circuit-break)
 * - Error aggregation and deduplication
 * - Structured error context propagation across modules
 */

// Lazy import to break circular dependency with analytics
function getErrorService() {
  return require("@/middleware/services/error-service") as typeof import("@/middleware/services/error-service");
}

// ─── Types ─────────────────────────────────────────────────────────

/**
 * Options for reporting an error through the error manager.
 * Mirrors ErrorCaptureOptions from the adapter but expressed as a domain type
 * so lib modules don't depend on adapter types.
 */
export interface ErrorReportOptions {
  /** Key-value tags for filtering/grouping (e.g., { module: 'auth', operation: 'login' }) */
  tags?: Record<string, string>;
  /** Extra context data attached to the error event */
  extra?: Record<string, any>;
  /** Severity level override */
  level?: 'fatal' | 'error' | 'warning' | 'info';
  /** Custom fingerprint for grouping (overrides default grouping) */
  fingerprint?: string[];
  /** Named context blocks (e.g., { request: { key, timeout } }) */
  contexts?: Record<string, Record<string, any>>;
  /** Breadcrumbs to attach to this specific error */
  breadcrumbs?: {
    message: string;
    data?: Record<string, any>;
    level?: 'fatal' | 'error' | 'warning' | 'info';
  }[];
}

/**
 * User identity for error context.
 * Only sent when consent allows PII (handled by middleware).
 */
export interface ErrorUser {
  id: string;
  email?: string;
  username?: string;
  [key: string]: any;
}

/**
 * Breadcrumb for contextual tracking.
 */
export interface ErrorBreadcrumb {
  category: string;
  message: string;
  level?: 'fatal' | 'error' | 'warning' | 'info';
  data?: Record<string, any>;
  timestamp?: number;
}

// ─── Error Reporting ───────────────────────────────────────────────

/**
 * Report an error through the middleware pipeline.
 * Consent, provider readiness, and network checks are handled by middleware.
 *
 * @param error - The error to report
 * @param options - Optional tags, extra context, severity level
 *
 * @example
 * ```ts
 * import { reportError } from '@/lib/error';
 *
 * try {
 *   await syncData();
 * } catch (error) {
 *   reportError(error instanceof Error ? error : new Error(String(error)), {
 *     tags: { module: 'sync-manager', operation: 'sync' },
 *   });
 * }
 * ```
 */
export function reportError(error: Error, options?: ErrorReportOptions): void {
  getErrorService().reportError(error, options);
}

/**
 * Report a message (non-exception event) through the middleware pipeline.
 *
 * @param message - Message text
 * @param level - Severity level (defaults to 'error')
 *
 * @example
 * ```ts
 * import { reportMessage } from '@/lib/error';
 * reportMessage('Unexpected state detected in world-sync', 'warning');
 * ```
 */
export function reportMessage(
  message: string,
  level: 'fatal' | 'error' | 'warning' | 'info' = 'error',
): void {
  getErrorService().reportMessage(message, level);
}

// ─── Breadcrumbs ───────────────────────────────────────────────────

/**
 * Add a breadcrumb for contextual error tracking.
 * Breadcrumbs are attached to subsequent error reports for debugging context.
 *
 * @param breadcrumb - Breadcrumb with category, message, optional data
 *
 * @example
 * ```ts
 * import { addBreadcrumb } from '@/lib/error';
 * addBreadcrumb({ category: 'auth', message: 'Session restored', data: { userId: '123' } });
 * ```
 */
export function addBreadcrumb(breadcrumb: ErrorBreadcrumb): void {
  getErrorService().addErrorBreadcrumb(breadcrumb);
}

// ─── User Context ──────────────────────────────────────────────────

/**
 * Set user context on the error tracker.
 * Middleware handles consent gating (PII requires 'full' consent).
 *
 * @param user - User identity data
 */
export function setErrorUser(user: ErrorUser): void {
  getErrorService().setErrorUser(user);
}

/**
 * Clear user context from the error tracker.
 * Always allowed regardless of consent level.
 */
export function clearErrorUser(): void {
  getErrorService().setErrorUser(null);
}

// ─── Status & Lifecycle ────────────────────────────────────────────

/**
 * Check if error tracking is currently enabled and delivering events.
 * Useful for gating expensive error-context computation.
 *
 * @returns true if error tracker is initialized and active
 *
 * @example
 * ```ts
 * import { isTrackingEnabled } from '@/lib/error';
 * if (isTrackingEnabled()) {
 *   // Build expensive error context only when tracking is active
 * }
 * ```
 */
export function isTrackingEnabled(): boolean {
  return getErrorService().isErrorTrackingEnabled();
}

/**
 * Flush any buffered error events to the backend.
 * Call before app shutdown or critical transitions to ensure delivery.
 *
 * @param timeoutMs - Maximum time to wait for flush (ms)
 * @returns true if flush completed within timeout
 */
export async function flushPendingErrors(timeoutMs?: number): Promise<boolean> {
  return getErrorService().flushErrors(timeoutMs);
}
