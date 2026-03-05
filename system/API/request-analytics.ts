import {
    Analytics,
    AnalyticsConsent,
    getCrashReportPayload,
    sanitizeError as sanitizeErrorForAnalytics,
} from "@/lib/analytics";
import { enrichError, extractErrorCode, reportError } from "@/lib/error";
import { logger, type LogCategory } from "@/lib/utils";
import type { ErrorCodeType } from "@/maps/ERROR_CODES";
import type { RequestInterceptor } from "./interceptor";

/**
 * Request Analytics & Error Reporting
 *
 * Handles all analytics tracking, error reporting, and slow-request detection
 * for the request pipeline. Decouples observability from transport logic.
 *
 * Responsibilities:
 * - **Track requests**: success/failure events with duration via Analytics.track()
 * - **Slow request detection**: warn when requests exceed configurable threshold
 * - **Error reporting**: enriched error reporting to crash tracker (Sentry)
 *   with consent-aware payloads, breadcrumbs, and error code enrichment
 * - **Severity mapping**: EnrichedError severity → Sentry breadcrumb levels
 * - **Category mapping**: ERROR_CODES category → LogCategory for structured logging
 */

// ─── Severity & Category Mapping ───────────────────────────────────

/**
 * Map EnrichedError severity to Sentry breadcrumb level.
 * EnrichedError uses 'critical'|'error'|'warning',
 * Sentry expects 'fatal'|'error'|'warning'|'info'|'debug'.
 */
export function mapToSentrySeverity(
  severity: 'critical' | 'error' | 'warning',
): 'fatal' | 'error' | 'warning' {
  switch (severity) {
    case 'critical':
      return 'fatal';
    case 'error':
    case 'warning':
    default:
      return severity;
  }
}

/**
 * Map ERROR_CODES_METADATA category to a valid LogCategory.
 * ERROR_CODES uses: 'auth', 'network', 'database', 'storage', 'validation', 'unknown'
 * LogCategory includes: 'auth', 'navigation', 'api', 'network', 'database', 'storage', 'ui', 'analytics', etc.
 * Unrecognized categories fall back to 'error'.
 */
export function mapErrorCodeCategoryToLogCategory(category: string): LogCategory {
  switch (category) {
    case 'auth':
    case 'network':
    case 'database':
    case 'storage':
      return category as LogCategory;
    case 'validation':
    case 'unknown':
    default:
      return 'error';
  }
}

// ─── Request Tracking ──────────────────────────────────────────────

/**
 * Track an API request event (success or failure) with duration.
 *
 * @param key - Enriched request key (URL or cache key)
 * @param ok - Whether the request succeeded
 * @param durationMs - Request duration in milliseconds
 * @param error - Error object (for failure tracking)
 * @param extra - Additional properties (e.g., source: 'cache_hit')
 */
export function trackRequest(
  key: string,
  ok: boolean,
  durationMs: number,
  error?: unknown,
  extra?: Record<string, any>,
): void {
  const props: Record<string, any> = {
    key,
    ok,
    duration_ms: durationMs,
    ...extra,
  };

  if (!ok && error) {
    Object.assign(props, sanitizeErrorForAnalytics(error));
  }

  Analytics.track("api_request", props);
}

/**
 * Check if a request duration exceeds the slow request threshold and log a warning.
 * Threshold comes from Analytics.getThreshold('slowRequestMs') or defaults to 3000ms.
 *
 * @param key - Enriched request key (URL or cache key)
 * @param durationMs - Request duration in milliseconds
 * @param failed - Whether the request failed (changes log message)
 */
export function checkSlowRequest(
  key: string,
  durationMs: number,
  failed: boolean = false,
): void {
  const threshold = Analytics.getThreshold?.("slowRequestMs") ?? 3000;
  if (durationMs > threshold) {
    const prefix = failed ? "Slow failed request" : "Slow request";
    logger.category('api').warn(`${prefix}: ${key} took ${durationMs}ms`);
  }
}

/**
 * Attach analytics tracking to a promise chain.
 *
 * Wraps a promise to automatically track success/failure duration and detect
 * slow requests. Returns the original promise if analytics is disabled.
 *
 * @param promise - The request promise to track
 * @param key - Enriched request key
 * @param startedAt - Timestamp when the request started (Date.now())
 * @returns Wrapped promise with analytics tracking
 */
export function attachRequestTracking<T>(
  promise: Promise<T>,
  key: string,
  startedAt: number,
): Promise<T> {
  if (!Analytics.enabled()) return promise;

  return promise.then(
    (value) => {
      const durationMs = Date.now() - startedAt;
      trackRequest(key, true, durationMs);
      checkSlowRequest(key, durationMs, false);
      return value;
    },
    (err) => {
      const durationMs = Date.now() - startedAt;
      trackRequest(key, false, durationMs, err);
      checkSlowRequest(key, durationMs, true);
      throw err;
    },
  );
}

// ─── Error Reporting to Crash Tracker ──────────────────────────────

/** Context for error reporting */
export interface ErrorReportContext {
  /** Enriched request key (URL or cache key) */
  key: string;
  /** Request options for context tags */
  options: {
    dedupe?: boolean;
    retries?: number;
    failOpen?: boolean;
    timeout?: number;
    rateLimitKey?: string;
    interceptors?: RequestInterceptor[];
  };
  /** Pre-extracted error code (optional — will attempt extraction if not provided) */
  errorCode?: ErrorCodeType;
}

/**
 * Report an error to the crash tracker (Sentry) with enriched metadata.
 *
 * Builds a consent-aware payload with:
 * - Error enrichment (error codes, categories, breadcrumbs)
 * - Request context tags (key, dedupe, retries, failOpen, timeout)
 * - Sentry breadcrumbs with severity mapping
 * - Consent-level-appropriate data redaction
 *
 * Silently catches its own errors to never break the request pipeline.
 *
 * @param error - The error that occurred
 * @param context - Request context for enrichment
 */
export function reportErrorToTracker(
  error: unknown,
  context: ErrorReportContext,
): void {
  try {
    const errorObj = error instanceof Error ? error : new Error(String(error));

    // Determine error code if not provided
    let errorCode = context.errorCode;
    if (!errorCode) {
      errorCode = extractErrorCode(error);
    }

    // Enrich error with metadata (for Sentry and logging)
    const enriched = errorCode
      ? enrichError(errorObj, errorCode, {
          requestKey: context.key,
          endpoint: context.key,
          dedupe: context.options.dedupe,
          retries: context.options.retries,
          failOpen: context.options.failOpen,
          timeout: context.options.timeout,
          rateLimited: !!context.options.rateLimitKey,
        })
      : null;

    // Log to logger with enriched metadata
    if (enriched) {
      logger
        .category(mapErrorCodeCategoryToLogCategory(enriched.category))
        .error(`Request failed: ${enriched.message}`, enriched.toLogMetadata());
    } else {
      logger.category('api').error("Request failed", { key: context.key, error: errorObj });
    }

    // Get tiered payload based on consent level
    const captureOptions = getCrashReportPayload(
      errorObj,
      undefined,
      AnalyticsConsent.getLevel(),
    );

    if (captureOptions !== null) {
      // Build Sentry options with error code enrichment
      const mergedOptions = {
        ...captureOptions,
        tags: {
          ...(captureOptions.tags || {}),
          component: "request-manager",
          requestKey: context.key,
          ...(enriched
            ? { errorCode: enriched.code, errorCategory: enriched.category }
            : {}),
        },
        contexts: {
          ...(captureOptions.contexts || {}),
          request: {
            key: context.key,
            dedupe: context.options.dedupe,
            retries: context.options.retries,
            failOpen: context.options.failOpen,
            timeout: context.options.timeout,
            rateLimited: !!context.options.rateLimitKey,
          },
          ...(enriched ? { errorEnrichment: enriched.toJSON() } : {}),
        },
        breadcrumbs: enriched
          ? [
              {
                message: enriched.toBreadcrumb().message,
                data: enriched.toBreadcrumb().data,
                level: mapToSentrySeverity(enriched.severity),
              },
            ]
          : undefined,
      };

      reportError(errorObj, mergedOptions);
    } else {
      logger.category('api').warn(
        "Error not sent to error tracker (consent=none; awaiting user opt-in)",
      );
    }
  } catch (trackerError) {
    logger.category('api').warn("Failed to report to error tracker:", trackerError);
  }
}
