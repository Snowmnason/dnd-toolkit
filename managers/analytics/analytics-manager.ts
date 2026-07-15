/**
 * Analytics Manager — Public API
 * 
 * Entry point for tracking events and managing user context.
 * Delegates sanitization to helpers, queues events to lib analytics buffer.
 * Handles consent initialization during auth flows (bootstrap + sign-in).
 * 
 * Flow: Manager (orchestration) → lib (buffering/queueing) → (buffer auto-flushes via middleware)
 */

import { analyticsBufferService } from "@/lib/analytics/exporters/analytics-buffer";
import { getThreshold } from "@/lib/analytics/utils";
import { clearErrorUser, isTrackingEnabled, setErrorUser } from "@/lib/error";
import { logger } from "@/lib/utils";
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
   * Initialize analytics session and user context
   * Called when user logs in or logs out
   * Identifies user for error tracking and starts session tracking
   */
  initializeSession(userId?: string | null): void {
    // Identify user (or clear on logout)
    this.identify(userId ? { id: userId } : null);

    // Start new session if user logged in
    if (userId) {
      const { sessionManager } = require("@/lib/analytics/session");
      sessionManager.startSession(userId);
    }
  },

  /**
   * Track an analytics event
   * Props are sanitized before queuing (removes sensitive fields)
   * Events are queued to analytics buffer for offline support and automatic flushing
   * Fire-and-forget: doesn't block caller
   */
  track(event: string, props?: AnalyticsEventProps): void {
    const safeProps = sanitizeProps(props);
    const eventType = mapEventType(event);
    
    // Queue to buffer (lib layer) — fire-and-forget, buffer handles persistence + auto-flush in background
    analyticsBufferService.enqueue({
      eventType,
      payload: { name: event, properties: safeProps || {} },
      maxRetries: 5,
    }).catch((error) => {
      // Silently fail — queuing is best-effort, non-critical
      logger.category('analytics').debug('Failed to queue event', { event, error });
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
   */
  async updateConsentLevel(level: ConsentLevel): Promise<void> {
    try {
      const { AnalyticsConsent } = await import("@/lib/analytics/consent/consent");
      await AnalyticsConsent.setLevel(level);
      // Update global after lib operation succeeds
      setCurrentConsentLevel(level);
      logger.category("analytics").info("Consent level updated", { level });
    } catch (error) {
      logger.category("analytics").error("Failed to update consent level", {
        level,
        error: error instanceof Error ? error.message : String(error),
      });
      throw error;
    }
  },
};

export type { AnalyticsEventProps };

