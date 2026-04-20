import { clearErrorUser, isTrackingEnabled, setErrorUser } from "@/lib/error";
import { logger } from "@/lib/utils";
import { AnalyticsConsent } from "./consent/consent";
import { getThreshold, sanitizeError } from "./utils";

type AnalyticsEventProps = Record<string, any>;

/**
 * Sanitize analytics properties before sending to Sentry
 *
 * Security: Removes potentially sensitive fields that may contain:
 * - User input or system paths (message, stack)
 * - Raw error objects with detailed context
 * - Any string representations of errors
 *
 * Only structured, predictable fields (error_name, error_code) are preserved
 * to prevent accidental leakage of sensitive information to analytics services.
 */
const sanitizeProps = (
  props?: AnalyticsEventProps | Error,
): AnalyticsEventProps | undefined => {
  if (!props) return undefined;
  if (props instanceof Error) {
    return sanitizeError(props) || {};
  }
  if (typeof props !== "object") return undefined;

  const cloned: any = { ...(props as any) };

  // Remove common sensitive fields that may contain user data or system paths
  if (typeof cloned.message === "string") delete cloned.message;
  if (typeof cloned.stack === "string") delete cloned.stack;

  if (cloned.error instanceof Error) {
    const sanitized = sanitizeError(cloned.error);
    if (sanitized) {
      cloned.error = sanitized;
    } else {
      delete cloned.error;
    }
  } else if (typeof cloned.error === "string") {
    delete cloned.error;
  }

  return cloned;
};

/**
 * Check if analytics system should be enabled
 * Analytics is enabled if EITHER error tracker is enabled OR exporters are available
 * This decouples the analytics system from any specific error tracking backend
 */
function isAnalyticsEnabled(): boolean {
  // Analytics is enabled if error tracker is available
  if (isTrackingEnabled()) return true;

  // For exporters: default to enabled so dispatch attempt runs
  // (exporters will check their own enabled status during dispatch)
  return true;
}

export const Analytics = {
  /**
   * Check if analytics is enabled
   * Returns true if Sentry is enabled OR exporters may be available
   * Allows pluggable exporters to work even when Sentry is disabled
   */
  enabled(): boolean {
    return isAnalyticsEnabled();
  },

  getThreshold,

  identify(user: { id?: string; username?: string } | null): void {
    // Only send user identification to error tracker if enabled
    // (exporters don't use this method, they get context from dispatch)
    if (isTrackingEnabled()) {
      try {
        const consentLevel = AnalyticsConsent.getLevel();
        if (user?.id) {
          // Per tiered reporting docs:
          // - 'none': no user context
          // - 'basic': minimal payload (error, message, stack, app version) — NO user context
          // - 'full': complete payload with user context (user id, username, breadcrumbs)
          if (consentLevel === 'full') {
            // Consent=full: send complete user context (both id and username)
            setErrorUser({ id: user.id, username: user.username });
            logger.category("analytics").debug("User identified in error tracker (full, consent=full)", { userId: user.id, username: user.username });
          } else {
            // Consent=none or basic: clear user context (both tiers exclude user info)
            clearErrorUser();
            logger.category("analytics").debug("User context cleared from error tracker (consent=none|basic)");
          }
        } else {
          clearErrorUser();
          logger.category("analytics").debug("User cleared from error tracker");
        }
      } catch (e) {
        logger.category("analytics").error("Failed to identify user in error tracker", { error: String(e) });
      }
    }
  },

  track(event: string, props?: AnalyticsEventProps): void {
    if (!this.enabled()) return;

    const safeProps = sanitizeProps(props);
    
    // Dispatch to all registered exporters asynchronously (fire-and-forget)
    // Sentry breadcrumbs are now routed through the SentryExporter
    // (exporter system respects analytics.exporters.sentry.enabled config)
    this._dispatchToExporters(event, safeProps);
  },

  /**
   * Private: Dispatch event to all registered exporters
   * Fire-and-forget: doesn't block Analytics.track() call
   * Errors are logged but don't affect the caller
   */
  _dispatchToExporters(eventName: string, props: AnalyticsEventProps | undefined): void {
    // Fire-and-forget: don't await, don't block
    Promise.resolve().then(() => {
      try {
        // Lazy require to break circular dependency: analytics → analytics-manager → analytics-service
        const { dispatchAnalyticsEvent, createAnalyticsExportContext } = require("@/middleware/services/analytics-service");
        
        // Create analytics event for exporter system
        const analyticsEvent = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Simple UUID
          timestamp: Date.now(),
          type: this._mapEventType(eventName),
          name: eventName,
          properties: props || {},
        };

        // Create context with current network status
        const context = createAnalyticsExportContext(); // NetworkDetection auto-detects offline status
        if (!context) return; // Preconditions not met

        // Dispatch to all registered exporters (fire-and-forget)
        // dispatchEvent uses Promise.allSettled internally, so it never rejects
        // due to exporter failures; errors are logged within dispatchEvent
        dispatchAnalyticsEvent(analyticsEvent, context);
        // Don't await or .catch() — exporter failures are isolated and logged internally
      } catch (error) {
        logger.category('analytics').debug(`Failed to dispatch to exporters: ${error}`);
        // Silently fail - don't let exporter issues affect Analytics.track()
      }
    });
  },

  /**
   * Private: Map Analytics.track() event names to exporter event types
   */
  _mapEventType(
    eventName: string
  ): 'pageview' | 'event' | 'error' | 'performance' | 'custom' {
    if (eventName === 'screen_view') return 'pageview';
    if (eventName.startsWith('performance')) return 'performance';
    if (eventName.includes('error')) return 'error';
    return 'event';
  },

  trackComponentUsage(params: {
    component: string;
    action: string;
    detail?: AnalyticsEventProps;
  }): void {
    const { component, action, detail } = params;
    this.track("component_usage", { component, action, ...detail });
  },
};

export { isAnalyticsEnabled, sanitizeError, sanitizeProps };

