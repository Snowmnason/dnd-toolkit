/**
 * Analytics Manager — Public API
 * 
 * Entry point for tracking events and managing user context.
 * Delegates sanitization to helpers, queues events to the background job queue.
 * Handles consent initialization during auth flows (bootstrap + sign-in).
 * 
 * Flow: Manager (orchestration) → lib (JobsManager) → background job queue (persists + retries automatically)
 */

import { getConsentCategoryForEvent, shouldEmitEvent } from "@/lib/analytics/consent/consent-gating";
import { AnalyticsError as AnalyticsErrorClass, getThreshold } from "@/lib/analytics/utils";
import { addBreadcrumb, clearErrorUser, isTrackingEnabled, setErrorUser } from "@/lib/error";
import { JobsManager } from "@/lib/jobs/jobs-manager";
import { logger } from "@/lib/utils";
import { AnalyticsError as ErrorHandler } from "@/managers/error/module/analyticsError";
import { currentConsentLevel, setCurrentConsentLevel, type ConsentLevel } from "@/type-definitions/analytics-types";
import { mapEventType, sanitizeProps } from "./analytics-helpers";

type AnalyticsEventProps = Record<string, any>;

/**
 * Initialize analytics consent if not already initialized.
 * Skips if consent is already set to 'full' or 'none' (already initialized).
 * Only initializes if still at 'basic' (default/uninitialized state).
 * 
 * Call during auth flows (bootstrap sign-in, token restore).
 * Safe to call multiple times — idempotent.
 * 
 * Non-critical: Failures silently fall back to 'basic' (already set in global).
 */
export async function initializeConsentIfNeeded(): Promise<void> {
  // Skip if already initialized to 'full' or 'none'
  if (currentConsentLevel !== 'basic') {
    return;
  }

  try {
    const { AnalyticsConsent } = await import('@/lib/analytics/consent/consent');
    // Fire and forget — lib handles persistence, storage, and global update
    await AnalyticsConsent.initialize();
    logger.category('analytics').info('Consent initialized');
  } catch (error) {
    // Non-critical: fall back to 'basic' (already default in global)
    logger.category('analytics').warn('Consent initialization failed (non-critical)', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export const Analytics = {
  getThreshold,

  /**
   * Set user context for analytics and error tracking
   * Respects consent level: 'none'/'basic' no context, 'full' full context
   */
  identify(user: { id?: string; username?: string } | null): void {
    if (isTrackingEnabled()) {
      try {
        if (user?.id) {
          if (currentConsentLevel === 'full') {
            setErrorUser({ id: user.id, username: user.username });
            logger.category("analytics").debug("User identified", { userId: user.id, username: user.username });
          } else {
            clearErrorUser();
            logger.category("analytics").debug("User context cleared (consent=none|basic)");
          }
        } else {
          clearErrorUser();
          logger.category("analytics").debug("User cleared");
        }
      } catch (e) {
        logger.category("analytics").error("Failed to identify user", { error: String(e) });
      }
    }
  },

  /**
   * Track an error occurring within the current session.
   * Delegates to the session manager, which tracks error counts for the
   * active session lifecycle (surfaced when the session ends).
   * Safe to call even if no session is active (no-op).
   */
  trackSessionError(): void {
    const { sessionManager } = require("@/lib/analytics/session");
    sessionManager.trackError();
  },

  /**
   * Initialize analytics session and user context
   * Called when user logs in or logs out
   * Identifies user for error tracking and starts session tracking
   * Emits session breadcrumb for error tracking when session begins
   */
  initializeSession(userId?: string | null): void {
    // Identify user (or clear on logout)
    this.identify(userId ? { id: userId } : null);

    // Start new session if user logged in
    if (userId) {
      const { sessionManager } = require("@/lib/analytics/session");
      sessionManager.startSession(userId);

      // Emit session start breadcrumb for error tracking
      if (isTrackingEnabled()) {
        addBreadcrumb({
          category: 'analytics',
          message: 'session_started',
          data: { userId, timestamp: Date.now() },
          level: 'info',
        });
      }
    }
  },

  /**
   * Track an analytics event
   * Props are sanitized before queuing (removes sensitive fields)
   * Events are queued to analytics buffer for offline support and automatic flushing
   * Fire-and-forget: doesn't block caller
   */
  track(event: string, props?: AnalyticsEventProps): void {
    const consentCategory = getConsentCategoryForEvent(event);
    if (!shouldEmitEvent(consentCategory, currentConsentLevel)) {
      logger.category('analytics').debug(
        `Event '${event}' dropped (category=${consentCategory ?? 'unmapped'}, level=${currentConsentLevel})`,
      );
      return;
    }

    const safeProps = sanitizeProps(props);
    const eventType = mapEventType(event);

    // Enqueue as a background job — persists across restarts and retries
    // automatically on reconnect via the BackgroundJobQueue (#167).
    JobsManager.enqueue({
      type: 'analytics_send_event',
      payload: { eventType, name: event, properties: safeProps || {} },
      requiresNetwork: 'defer',
      maxRetries: 5,
    }).catch((error) => {
      // Silently fail — enqueueing is best-effort, non-critical
      logger.category('analytics').debug('Failed to enqueue event', { event, error });
    });
  },

  /**
   * Track component usage event
   * Convenience method for component tracking
   */
  trackComponentUsage(params: {
    component: string;
    action: string;
    detail?: AnalyticsEventProps;
  }): void {
    const { component, action, detail } = params;
    this.track("component_usage", { component, action, ...detail });
  },

  /**
   * Update analytics consent level (runtime)
   * Persists to SecureStorage and queues database sync
   * Updates global consent state for fast subsequent reads
   * 
   * Flow:
   * 1. Call lib/consent to persist change
   * 2. On error: catch AnalyticsError, call error handler to decide
   * 3. Log decision to error system (Sentry)
   * 4. If non-breaking: return error status, continue with old consent
   * 5. If breaking: throw to caller with context
   */
  async updateConsentLevel(level: ConsentLevel): Promise<void> {
    try {
      const { AnalyticsConsent } = await import("@/lib/analytics/consent/consent");
      const { downgraded } = await AnalyticsConsent.setLevel(level);
      // Update global after lib operation succeeds
      setCurrentConsentLevel(level);
      logger.category("analytics").info("Consent level updated", { level });

      // If consent was downgraded, clear any pending analytics send jobs (non-critical)
      if (downgraded) {
        try {
          const cleared = await JobsManager.clearByType('analytics_send_event');
          logger.category("analytics").info("Consent downgraded — cleared pending analytics send jobs", { level, cleared });
        } catch (error) {
          logger.category("analytics").warn("Failed to clear pending analytics jobs on consent downgrade (non-critical)", {
            level,
            error,
          });
        }
      }
    } catch (error) {
      // Catch lib/consent errors and delegate to error handler
      if (error instanceof AnalyticsErrorClass) {
        const decision = ErrorHandler.handle(error.code, error.context);
        
        // Log decision to error system (Sentry, etc.)
        logger.category("analytics").warn("Consent update failed, handled by error system", {
          level,
          code: error.code,
          decision: decision.action,
          message: decision.message,
        });

        // Execute decision:
        // - Non-breaking (fallback, ignore): Return gracefully, app continues with old consent
        // - Breaking (propagate): Re-throw so caller knows the change failed
        if (decision.action === 'propagate' || decision.action === 'safe_mode') {
          throw error;
        }
        // For fallback/ignore: silently return, consent remains at previous level
        return;
      }

      // Unknown error type — log and re-throw
      logger.category("analytics").error("Unexpected error during consent update", {
        level,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },

  /**
   * Performance measurement API - delegates to performance manager
   * Allows lib files to measure performance without direct dependency on performance-manager
   * @param label Operation label
   */
  startMeasure(label: string): void {
    const { Performance } = require("@/managers/analytics/performance-manager");
    Performance.startMeasure(label);
  },

  /**
   * End performance measurement - delegates to performance manager
   * @param label Operation label
   * @param warnMs Optional warning threshold
   */
  endMeasure(label: string, warnMs?: number): void {
    const { Performance } = require("@/managers/analytics/performance-manager");
    Performance.endMeasure(label, warnMs);
  },
};

export type { AnalyticsEventProps };

