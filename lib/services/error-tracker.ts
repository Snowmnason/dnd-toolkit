/**
 * Error Tracker Provider Interface & Singleton
 *
 * Abstracts error tracking (captureException, captureMessage, addBreadcrumb, setUser)
 * enabling zero-friction swaps between Sentry, DataDog, Rollbar, etc.
 *
 * Design:
 * - ErrorTrackerProvider: interface for direct error tracking calls
 * - NoOpErrorTracker: silent fallback when no tracker is registered
 * - Singleton: registerErrorTracker() → getErrorTracker() (module-level state)
 * - Dev warnings: double-register, NoOp usage (production silent)
 * - PII safe: TrackerUser excludes email by default; callers shape payloads
 */

import { isDevelopment } from '@/lib/config/loader';

/**
 * Severity level for captured messages
 */
export type SeverityLevel = 'fatal' | 'error' | 'warning' | 'info';

/**
 * User identification object (PII-aware)
 * Email excluded by default — callers must explicitly include with full consent
 */
export interface TrackerUser {
  id: string;
  email?: string; // Optional; callers responsible for consent-gating
  [key: string]: any;
}

/**
 * Breadcrumb data structure for logging contextual events
 */
export interface TrackerBreadcrumb {
  category: string; // e.g., 'auth', 'api', 'analytics'
  message: string;
  level?: SeverityLevel;
  data?: Record<string, any>;
  timestamp?: number;
}

/**
 * Options for error capture (tags, extra context, consent-filtered data)
 * Maps to Sentry EventHint / ErrorEvent equivalents
 */
export interface ErrorCaptureOptions {
  tags?: Record<string, string>;
  extra?: Record<string, any>;
  level?: SeverityLevel;
  fingerprint?: string[];
  contexts?: Record<string, Record<string, any>>;
}

/**
 * Error tracking provider interface
 * Direct, synchronous calls to error tracking backend (not queued)
 *
 * Contrast with BreadcrumbProvider: BreadcrumbProvider handles *queued* breadcrumb delivery;
 * ErrorTrackerProvider handles *direct* calls (setUser, captureException, etc).
 */
export interface ErrorTrackerProvider {
  /**
   * Capture and report an exception
   * @param error Error to capture
   * @param options Optional tags, extra data, severity level
   */
  captureException(error: Error, options?: ErrorCaptureOptions): void;

  /**
   * Capture a message with severity level
   * @param message Message text
   * @param level Severity (fatal, error, warning, info)
   */
  captureMessage(message: string, level?: SeverityLevel): void;

  /**
   * Add a breadcrumb for context
   * @param breadcrumb Breadcrumb with category, message, optional data
   */
  addBreadcrumb(breadcrumb: TrackerBreadcrumb): void;

  /**
   * Set or clear user context
   * @param user User data (id, email optional) or null to clear
   */
  setUser(user: TrackerUser | null): void;

  /**
   * Check if tracker is enabled (e.g., Sentry configured and active)
   * @returns true if tracker will deliver events
   */
  isEnabled(): boolean;

  /**
   * Flush any pending events to the backend and optionally wait up to `timeoutMs` milliseconds.
   * Returns true if flush succeeded within the timeout, false otherwise.
   */
  flush?(timeoutMs?: number): Promise<boolean>;
}

/**
 * No-op error tracker fallback
 * Used when no provider is registered or when Sentry/tracking is disabled.
 * All methods silently no-op; dev-only warning logged once.
 */
export class NoOpErrorTracker implements ErrorTrackerProvider {
  private warningLogged = false;

  private logDevWarning(): void {
    // Log dev-only warning once per session
    if (
      isDevelopment() &&
      !this.warningLogged &&
      typeof console !== 'undefined' &&
      console.warn
    ) {
      this.warningLogged = true;
      console.warn(
        '[ErrorTracker] NoOp tracker in use — error tracking is disabled. Check if Sentry is configured.',
      );
    }
  }

  captureException(error: Error, options?: ErrorCaptureOptions): void {
    this.logDevWarning();
    // Silent no-op
  }

  captureMessage(message: string, level?: SeverityLevel): void {
    this.logDevWarning();
    // Silent no-op
  }

  addBreadcrumb(breadcrumb: TrackerBreadcrumb): void {
    this.logDevWarning();
    // Silent no-op
  }

  setUser(user: TrackerUser | null): void {
    this.logDevWarning();
    // Silent no-op
  }

  isEnabled(): boolean {
    return false;
  }

  async flush(_timeoutMs?: number): Promise<boolean> {
    // No-op: nothing to flush. Return true to indicate 'flushed'.
    return true;
  }
}

/**
 * Module-level singleton state
 */
let trackerInstance: ErrorTrackerProvider = new NoOpErrorTracker();
let trackerRegistered = false;

/**
 * Get the current error tracker
 * Always returns a non-null tracker (NoOp by default before registration)
 * Safe to call at any time; no startup ordering issues.
 */
export function getErrorTracker(): ErrorTrackerProvider {
  return trackerInstance;
}

/**
 * Register an error tracker provider (e.g., SentryErrorTracker)
 * Called during app bootstrap via service-initializer
 *
 * @param tracker Provider implementation (Sentry, DataDog, NoOp, etc.)
 * @throws Logs dev-only warning on double-registration (last-wins semantics)
 */
export function registerErrorTracker(tracker: ErrorTrackerProvider): void {
  if (trackerRegistered && isDevelopment()) {
    console.warn(
      '[ErrorTracker] Tracker already registered; replacing with new instance. This may indicate duplicate initialization.',
    );
  }

  trackerInstance = tracker;
  trackerRegistered = true;
}

/**
 * Reset tracker to NoOp (testing only)
 * @internal
 */
export function resetErrorTracker(): void {
  trackerInstance = new NoOpErrorTracker();
  trackerRegistered = false;
}
