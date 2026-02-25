import Constants from "expo-constants";
import { useEffect } from "react";
import { Platform } from "react-native";
import { isAppIdle } from "../../hooks/utils/use-app-state";
import { getErrorTracker } from "../services";
import { logger } from "../utils/logger";
import { AnalyticsConsent } from "./consent";
import { shouldEmitEvent } from "./consent-gating";
import { categorizeError } from "./error-categorization";
import { createExportContext, dispatchEvent } from "./exporters";
import { performanceBaselineService } from "./performance/performance-baseline";
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
  if (getErrorTracker().isEnabled()) return true;

  // For exporters: default to enabled so dispatch attempt runs
  // (exporters will check their own enabled status during dispatch)
  return true;
}

function withTiming<T>(
  label: string,
  fn: () => Promise<T> | T,
  warnMs?: number,
): Promise<T> | T {
  const start = Date.now();
  const slowScreenThreshold = warnMs ?? getThreshold("slowScreenMs");

  const finish = (ok: boolean, extra?: any) => {
    const duration_ms = Date.now() - start;
    if (duration_ms > slowScreenThreshold) {
      logger.category("performance").warn("Slow operation detected", {
          operation: label,
          duration_ms,
          threshold: slowScreenThreshold,
        });
    }
    
    // Record baseline sample with idle-time context (app backgrounded = idle measurement)
    const context = { isIdle: isAppIdle() };
    performanceBaselineService.recordSample(label, duration_ms, context);
    const result = performanceBaselineService.detectRegression(label, duration_ms, context);
    
    if (result.isRegression) {
      logger.category('performance').perf(
        `Performance regression detected for '${label}': ${result.current}ms vs baseline ${result.baseline?.p95}ms (threshold: ${result.threshold}%, delta: ${result.deltaPct?.toFixed(1)}%, samples: ${result.baseline?.count ?? 0}, app_version: ${Constants.expoConfig?.version ?? 'unknown'}, platform: ${Platform.OS})`
      );
      
      // Emit regression event via #178 exporters (fire-and-forget) with rich context
      // dispatchEvent() gates by consent; no need to check here
      const regressionEvent = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        type: 'performance' as const,
        name: 'regression_detected',
        properties: {
          operation: label,
          current_ms: result.current,
          baseline_p50_ms: result.baseline?.p50,
          baseline_p95_ms: result.baseline?.p95,
          baseline_p99_ms: result.baseline?.p99,
          baseline_mean_ms: result.baseline?.mean,
          baseline_count: result.baseline?.count,
          threshold_pct: result.threshold,
          delta_ms: result.delta,
          delta_pct: result.deltaPct,
          warmup_skipped: result.baseline?.warmupCount,
          idle_skipped: result.baseline?.idleSkippedCount,
          samples_dropped: result.baseline?.droppedCount,
          app_version: Constants.expoConfig?.version ?? 'unknown',
          platform: Platform.OS,
        },
      };
      const exportContext = createExportContext();
      dispatchEvent(regressionEvent, exportContext);
    }
    
    if (getErrorTracker().isEnabled() && shouldEmitEvent('performance', AnalyticsConsent.getLevel())) {
      try {
        const errorCategory = extra?.error
          ? categorizeError(extra.error)
          : undefined;
        // Consent-gated: only add breadcrumb if user has performance consent
        getErrorTracker().addBreadcrumb({
          category: "performance",
          message: label,
          data: { duration_ms, ok, error_category: errorCategory, ...extra },
          level: "info",
        });
        logger.category("analytics").debug("Performance breadcrumb sent to error tracker", {
            operation: label,
            duration_ms,
            ok,
          });
      } catch (e) {
        logger
          .category("analytics")
          .error("Failed to send performance breadcrumb", {
            operation: label,
            error: String(e),
          });
      }
    }
  };

  try {
    const r = fn();
    if (r instanceof Promise) {
      return r
        .then((val) => {
          finish(true);
          return val;
        })
        .catch((err) => {
          const error = sanitizeError(err);
          finish(false, error ? { error } : undefined);
          throw err;
        });
    } else {
      finish(true);
      return r;
    }
  } catch (err) {
    const error = sanitizeError(err);
    finish(false, error ? { error } : undefined);
    throw err;
  }
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
    if (getErrorTracker().isEnabled()) {
      try {
        const consentLevel = AnalyticsConsent.getLevel();
        if (user?.id) {
          // Per tiered reporting docs:
          // - 'none': no user context
          // - 'basic': minimal payload (error, message, stack, app version) — NO user context
          // - 'full': complete payload with user context (user id, username, breadcrumbs)
          if (consentLevel === 'full') {
            // Consent=full: send complete user context (both id and username)
            getErrorTracker().setUser({ id: user.id, username: user.username });
            logger.category("analytics").debug("User identified in error tracker (full, consent=full)", { userId: user.id, username: user.username });
          } else {
            // Consent=none or basic: clear user context (both tiers exclude user info)
            getErrorTracker().setUser(null);
            logger.category("analytics").debug("User context cleared from error tracker (consent=none|basic)");
          }
        } else {
          getErrorTracker().setUser(null);
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
        // Create analytics event for exporter system
        const analyticsEvent = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`, // Simple UUID
          timestamp: Date.now(),
          type: this._mapEventType(eventName),
          name: eventName,
          properties: props || {},
        };

        // Create context with current network status
        const context = createExportContext(); // NetworkDetection auto-detects offline status

        // Dispatch to all registered exporters (fire-and-forget)
        // dispatchEvent uses Promise.allSettled internally, so it never rejects
        // due to exporter failures; errors are logged within dispatchEvent
        dispatchEvent(analyticsEvent, context);
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

  withTiming,
};

export const Performance = {
  marks: new Map<string, number>(),
  // Maximum age for marks (5 minutes) to prevent memory leaks from abandoned measurements
  MAX_MARK_AGE_MS: 5 * 60 * 1000,

  /**
   * Start a performance measurement
   * If a mark with this label already exists, logs a warning and overwrites it
   * to prevent incorrect measurements from reused labels
   */
  startMeasure(label: string) {
    const existing = this.marks.get(label);
    if (existing) {
      logger.category('performance').warn(`Mark '${label}' already exists, overwriting (potential duplicate measurement)`);
    }
    this.marks.set(label, Date.now());
    this.cleanupOldMarks();
  },

  endMeasure(label: string, warnMs?: number) {
    const start = this.marks.get(label);
    if (!start) return;
    const duration = Date.now() - start;
    const slowScreenThreshold = warnMs ?? getThreshold("slowScreenMs");
    this.marks.delete(label);
    Analytics.track("performance_measure", { label, duration_ms: duration });
    if (duration > slowScreenThreshold)
      logger.category('performance').perf(`Slow operation: ${label} took ${duration}ms`);
    
    // Record baseline sample with idle-time context (app backgrounded = idle measurement)
    const context = { isIdle: isAppIdle() };
    performanceBaselineService.recordSample(label, duration, context);
    const result = performanceBaselineService.detectRegression(label, duration, context);
    if (result.isRegression) {
      logger.category('performance').perf(`Performance regression detected for '${label}': ${result.current}ms vs p95 ${result.baseline?.p95}ms (threshold: ${result.threshold}%, delta: ${result.deltaPct?.toFixed(1)}%)`);
      // Emit regression event via #178 exporters (fire-and-forget)
      // dispatchEvent() gates by consent; no need to check here
      const regressionEvent = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        timestamp: Date.now(),
        type: 'performance' as const,
        name: 'regression_detected',
        properties: {
          operation: label,
          current_ms: result.current,
          baseline_p50_ms: result.baseline?.p50,
          baseline_p95_ms: result.baseline?.p95,
          baseline_p99_ms: result.baseline?.p99,
          baseline_mean_ms: result.baseline?.mean,
          baseline_count: result.baseline?.count,
          threshold_pct: result.threshold,
          delta_ms: result.delta,
          delta_pct: result.deltaPct,
          warmup_skipped: result.baseline?.warmupCount,
          idle_skipped: result.baseline?.idleSkippedCount,
          samples_dropped: result.baseline?.droppedCount,
          app_version: Constants.expoConfig?.version ?? 'unknown',
          platform: Platform.OS,
        },
      };
      const exportContext = createExportContext();
      dispatchEvent(regressionEvent, exportContext);
      // Don't await — fire-and-forget pattern for exporter failures
    }
  },

  /**
   * Clean up marks older than MAX_MARK_AGE_MS to prevent memory leaks
   * from abandoned measurements (e.g., unmounted components, errors)
   */
  cleanupOldMarks() {
    const now = Date.now();
    const staleLabels: string[] = [];

    this.marks.forEach((timestamp, label) => {
      if (now - timestamp > this.MAX_MARK_AGE_MS) {
        staleLabels.push(label);
      }
    });

    staleLabels.forEach((label) => {
      logger.category('performance').debug(`Removing stale mark: ${label}`);
      this.marks.delete(label);
    });
  },

  useScreenDuration(screenName: string) {
    useEffect(() => {
      const label = `screen_load:${screenName}`;
      Performance.startMeasure(label);
      return () => Performance.endMeasure(label);
    }, [screenName]);
  },
};

export type FeatureBlockedReason =
  | "flag_disabled"
  | "requires_premium"
  | "beta_only";

export function trackFeatureBlocked(params: {
  feature: string;
  reason: FeatureBlockedReason;
}) {
  const { feature, reason } = params;
  Analytics.track("feature_blocked", { feature, reason });
}

// Export analytics utilities
export {
  analyticsBufferService, calculateExponentialBackoff, generateUUID, type AnalyticsBufferConfig,
  type AnalyticsBufferStats,
  type QueuedAnalyticsEvent
} from "./analytics-buffer";
export {
  cleanupAnalyticsNetworkIntegration, flushAnalyticsQueue, handleAnalyticsConsentWithdrawal, initializeAnalyticsNetworkIntegration
} from "./analytics-network-integration";
export { AnalyticsConsent, type ConsentLevel } from "./consent";
export { ConsentSyncQueue, type PendingConsentSync } from "./consent-sync-queue";
export { categorizeError, type ErrorCategory } from "./error-categorization";
export { sessionManager } from "./session";
export { getThreshold, sanitizeError } from "./utils";
export {
  trackVariantAssignment,
  trackVariantEngagement,
  trackVariantPerformance,
  type VariantAssignmentEvent,
  type VariantEngagementEvent,
  type VariantPerformanceEvent
} from "./variant-tracking";
// Breadcrumb queue (Phase 1a - offline persistence)
export { breadcrumbQueue, type BreadcrumbQueueStats } from "./breadcrumb-queue";

export {
  OperationBaseline, PerformanceBaselineConfig,
  PerformanceBaselines,
  PerformanceBaselineService,
  performanceBaselineService, RegressionDetectionResult
} from './performance/performance-baseline';

// Consent gating (centralized privacy checks at dispatch layer)
export {
  DEFAULT_EVENT_CONSENT_MAPPING,
  getConsentCategoryForEvent,
  registerEventConsentMapping,
  shouldEmitEvent,
  type ConsentCategory
} from './consent-gating';

// Tiered error reporting based on consent level
export { getCrashReportPayload } from './consent-error-payload';


