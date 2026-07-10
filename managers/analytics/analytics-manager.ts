/**
 * Analytics Manager — Public API
 * 
 * Entry point for tracking events and managing user context.
 * Delegates sanitization and dispatch to helpers.
 */

import { getThreshold } from "@/lib/analytics/utils";
import { clearErrorUser, isTrackingEnabled, setErrorUser } from "@/lib/error";
import { logger } from "@/lib/utils";
import { currentConsentLevel } from "@/type-definitions/analytics-types";
import { dispatchToExporters, sanitizeProps } from "./analytics-helpers";

type AnalyticsEventProps = Record<string, any>;

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
   * Track an analytics event
   * Props are sanitized before dispatch (removes sensitive fields)
   */
  track(event: string, props?: AnalyticsEventProps): void {
    const safeProps = sanitizeProps(props);
    dispatchToExporters(event, safeProps);
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
};

export type { AnalyticsEventProps };

