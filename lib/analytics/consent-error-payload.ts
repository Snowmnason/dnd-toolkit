/**
 * @file Tiered error reporting payloads based on consent level.
 *
 * Provides a helper function to construct error report payloads that respect
 * user consent levels. Allows Sentry and error reporting systems to adapt
 * payload richness based on what the user has opted into.
 *
 * **Design:**
 * - `'none'` consent: No automatic send; returns null (user can opt-in via dialog)
 * - `'basic'` consent: Minimal payload (error type, message, stack) auto-sent
 * - `'full'` consent: Full payload with all context auto-sent
 *
 * See also: lib/analytics/consent-gating.ts for consent tier logic
 */

import type { ConsentLevel } from '@/lib/analytics/consent';
import { logger } from '@/lib/utils/logger';

/**
 * Construct a tiered error payload based on user consent level.
 *
 * **Tiered Payloads:**
 * - **`'none'`**: Returns `null` (no automatic send)
 *   - User sees optional dialog: "An error occurred. Send crash details?"
 *   - Only sends if user explicitly clicks "Send"
 * - **`'basic'`**: Returns minimal payload for auto-send
 *   - Error type, message, stack trace, app version
 *   - NO component stack, NO user context, NO breadcrumbs, NO sensitive props
 *   - Useful for debugging crashes without behavioral data
 * - **`'full'`**: Returns full payload for auto-send
 *   - All context: component stack, user context, breadcrumbs, device info
 *   - Maximum visibility for debugging and crash roots
 *
 * @param error - The error to report
 * @param componentStack - Optional React component stack (ErrorBoundary only)
 * @param consentLevel - User's current consent level
 * @returns Sentry event hint or null if no automatic send (requires user opt-in)
 *
 * @example
 * // In ErrorBoundary.tsx
 * const options = getCrashReportPayload(error, info.componentStack, AnalyticsConsent.getLevel());
 * if (options !== null) {
 *   Sentry.captureException(error, options);
 * } else {
 *   // Show crash consent dialog here (out of scope Phase 1)
 * }
 */
export function getCrashReportPayload(
  error: Error,
  componentStack?: string,
  consentLevel: ConsentLevel = 'basic'
): Record<string, any> | null {
  if (!error) {
    logger.category('analytics').warn('getCrashReportPayload called with null error');
    return null;
  }

  // ============================================================================
  // CONSENT = 'none': No automatic send; user must opt-in via dialog
  // ============================================================================
  if (consentLevel === 'none') {
    logger.category('analytics').warn('ErrorNotSent:consent=none', 'Error not sent (consent=none; awaiting user opt-in via dialog)');
    // Return null to signal caller: do not send automatically
    // Caller should show optional dialog offering user the chance to send
    return null;
  }

  // ============================================================================
  // CONSENT = 'basic': Minimal payload (error, stack, version) auto-sent
  // ============================================================================
  if (consentLevel === 'basic') {
    logger.category('analytics').warn('SendingMinimalErrorPayload', 'Sending error with minimal payload (consent=basic)');

    const minimalOptions: Record<string, any> = {
      // NO contexts (avoids device info, OS, screen resolution, etc.)
      contexts: {},

      // Minimal extra data: app version only
      extra: {
        app_version: process.env.EXPO_PUBLIC_APP_VERSION || 'unknown',
        // NO user context, NO breadcrumbs, NO sensitive props
      },

      // NO breadcrumbs
      breadcrumbs: [],

      // NO component stack (ErrorBoundary-specific)
      // NO stack levels or frames filtering — send raw stack
    };

    return minimalOptions;
  }

  // ============================================================================
  // CONSENT = 'full': Full payload with all context auto-sent
  // ============================================================================
  if (consentLevel === 'full') {
    logger.category('analytics').warn('SendingFullErrorPayload', 'Sending error with full payload (consent=full)');

    const fullOptions: Record<string, any> = {
      // Full contexts: device, OS, screen, browser, runtime
      // Sentry will auto-populate from environment if not provided
      contexts: {
        react: componentStack ? { componentStack } : undefined,
      },

      // Rich extra data: version, user context, session info, etc.
      extra: {
        app_version: process.env.EXPO_PUBLIC_APP_VERSION || 'unknown',
        // Note: User context is managed by Analytics.identify(), which respects consent
        // For 'basic' and 'none' consent, Sentry.setUser() is cleared; for 'full', it's set.
        // Do not include raw user context here; let Sentry.setUser() (via identify) handle it.
      },

      // Include all breadcrumbs (Sentry will limit to recent ones)
      // Breadcrumbs are already filtered at enqueue time by consent level
      // So these breadcrumbs should already be consented data
      // breadcrumbs: (leave undefined; Sentry will use its collected ones)

      // Allow Sentry to collect and attach all available context
      attachStacktrace: true,
    };

    return fullOptions;
  }

  // ============================================================================
  // FALLBACK: Invalid consent level
  // ============================================================================
  logger.category('analytics').warn('InvalidConsentLevel', `Invalid consent level '${consentLevel}'; defaulting to minimal payload`);
  // Default to minimal payload for safety
  return {
    contexts: {},
    extra: {
      app_version: process.env.EXPO_PUBLIC_APP_VERSION || 'unknown',
    },
    breadcrumbs: [],
  };
}
