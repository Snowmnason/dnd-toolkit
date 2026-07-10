/**
 * Analytics Helpers — Private utilities
 * 
 * Internal helper functions for analytics-manager.ts
 * Not exported; used only within the analytics manager module
 */

import { generateUUID } from "@/lib/analytics/exporters/analytics-buffer";
import { sanitizeError } from "@/lib/analytics/utils";
import { logger } from "@/lib/utils";

type AnalyticsEventProps = Record<string, any>;

/**
 * Sanitize analytics properties before sending to exporters
 *
 * Security: Removes potentially sensitive fields that may contain:
 * - User input or system paths (message, stack)
 * - Raw error objects with detailed context
 * - Any string representations of errors
 *
 * Only structured, predictable fields (error_name, error_code) are preserved
 * to prevent accidental leakage of sensitive information to analytics services.
 */
export const sanitizeProps = (
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
 * Dispatch event to all registered exporters
 * Fire-and-forget: doesn't block caller or raise exceptions
 */
export const dispatchToExporters = (eventName: string, props: AnalyticsEventProps | undefined): void => {
  // Fire-and-forget: don't await, don't block
  Promise.resolve().then(() => {
    try {
      // Lazy require to break circular dependency
      const { dispatchAnalyticsEvent, createAnalyticsExportContext } = require("@/middleware/services/analytics-service");
      
      const analyticsEvent = {
        id: generateUUID(),
        timestamp: Date.now(),
        type: mapEventType(eventName),
        name: eventName,
        properties: props || {},
      };

      const context = createAnalyticsExportContext();
      if (!context) return;

      dispatchAnalyticsEvent(analyticsEvent, context);
    } catch (error) {
      logger.category('analytics').debug(`Failed to dispatch to exporters: ${error}`);
    }
  });
};

/**
 * Map event name to exporter event type for categorization
 */
export const mapEventType = (eventName: string): 'pageview' | 'event' | 'error' | 'performance' | 'custom' => {
  if (eventName === 'screen_view') return 'pageview';
  if (eventName.startsWith('performance')) return 'performance';
  if (eventName.includes('error')) return 'error';
  return 'event';
};
