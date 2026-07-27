/**
 * Analytics Error Handler
 *
 * Centralized error orchestration for analytics operations.
 * Called by lib/analytics operations when they fail.
 *
 * Responsibilities:
 * - Map lib errors to error codes
 * - Construct tiered crash payloads (consent-aware)
 * - Decide: safe mode, graceful fallback, or propagate
 * - Log errors for audit trail
 *
 * Pattern:
 *   lib/analytics operation → fails → returns error code
 *   → manager calls AnalyticsError.handle(code, context)
 *   → AnalyticsError decides recovery strategy
 *   → Returns decision to manager
 *   → Manager executes (throw, fallback, retry)
 */

import { logger } from '@/lib/utils/logger';
import type { AnalyticsErrorCode, CrossModuleErrorCode } from '@/type-definitions/error-codes';

/**
 * Decision result from error handler.
 * Manager uses this to decide recovery.
 */
export type ErrorDecision = {
  code: AnalyticsErrorCode | CrossModuleErrorCode;
  severity: 'warn' | 'error' | 'critical';
  action: 'ignore' | 'fallback' | 'safe_mode' | 'propagate';
  message: string;
  context?: Record<string, any>;
};

/**
 * AnalyticsError — static methods for error orchestration.
 * No state; fire-and-forget handlers.
 */
export const AnalyticsError = {
  /**
   * Handle an analytics error code and return decision.
   *
   * @param code - Error code from lib/analytics operation
   * @param context - Contextual info (operation, user id, etc.)
   * @returns ErrorDecision with action to take
   */
  handle(
    code: AnalyticsErrorCode | CrossModuleErrorCode,
    context?: Record<string, any>
  ): ErrorDecision {
    // Categorize severity + action by code
    const decision = AnalyticsError.categorizeError(code, context);

    // Log for audit trail
    const logFn = decision.severity === 'warn' ? logger.category('analytics').warn : logger.category('analytics').error;
    logFn.call(logger.category('analytics'), `Analytics error: ${code}`, {
      code,
      action: decision.action,
      context,
      message: decision.message,
    });

    return decision;
  },

  /**
   * Construct tiered crash report payload based on consent level.
   *
   * @param error - The error to report
   * @param componentStack - Optional React component stack
   * @param consentLevel - User's consent level
   * @returns Sentry event hint or null if no automatic send
   */
  getCrashReportPayload(
    error: Error,
    componentStack?: string,
    consentLevel: 'none' | 'basic' | 'full' = 'basic'
  ): Record<string, any> | null {
    if (!error) {
      logger.category('analytics').warn('getCrashReportPayload called with null error');
      return null;
    }

    // ============================================================================
    // CONSENT = 'none': No automatic send; user must opt-in via dialog
    // ============================================================================
    if (consentLevel === 'none') {
      logger
        .category('analytics')
        .warn('ErrorNotSent:consent=none', 'Error not sent (consent=none; awaiting user opt-in via dialog)');
      return null;
    }

    // ============================================================================
    // CONSENT = 'basic': Minimal payload (error, stack, version) auto-sent
    // ============================================================================
    if (consentLevel === 'basic') {
      logger
        .category('analytics')
        .warn('SendingMinimalErrorPayload', 'Sending error with minimal payload (consent=basic)');

      const minimalOptions: Record<string, any> = {
        contexts: {},
        extra: {
          app_version: process.env.EXPO_PUBLIC_APP_VERSION || 'unknown',
        },
        breadcrumbs: [],
      };

      return minimalOptions;
    }

    // ============================================================================
    // CONSENT = 'full': Full payload with all context auto-sent
    // ============================================================================
    if (consentLevel === 'full') {
      logger
        .category('analytics')
        .warn('SendingFullErrorPayload', 'Sending error with full payload (consent=full)');

      const fullOptions: Record<string, any> = {
        contexts: {
          react: componentStack ? { componentStack } : undefined,
        },
        extra: {
          app_version: process.env.EXPO_PUBLIC_APP_VERSION || 'unknown',
        },
        attachStacktrace: true,
      };

      return fullOptions;
    }

    // ============================================================================
    // FALLBACK: Invalid consent level
    // ============================================================================
    logger
      .category('analytics')
      .warn('InvalidConsentLevel', `Invalid consent level '${consentLevel}'; defaulting to minimal payload`);
    return {
      contexts: {},
      extra: {
        app_version: process.env.EXPO_PUBLIC_APP_VERSION || 'unknown',
      },
      breadcrumbs: [],
    };
  },

  /**
   * @internal
   * Categorize error code to severity + action.
   * Will expand as more error scenarios are encountered.
   */
  categorizeError(
    code: AnalyticsErrorCode | CrossModuleErrorCode,
    context?: Record<string, any>
  ): ErrorDecision {
    // Consent errors: validation
    if (code === 'analytics:consent_invalid') {
      return {
        code,
        severity: 'error',
        action: 'propagate',
        message: 'Invalid consent level provided; rejected',
        context,
      };
    }

    if (code === 'analytics:consent_persist_failed') {
      return {
        code,
        severity: 'critical',
        action: 'propagate',
        message: 'Failed to persist consent choice; user change was not saved',
        context,
      };
    }

    // Consent errors: uninitialized/denied
    if (code === 'analytics:consent_denied' || code === 'analytics:consent_uninitialized') {
      return {
        code,
        severity: 'warn',
        action: 'fallback',
        message: 'Analytics consent not available; using minimal tracking',
        context,
      };
    }

    // Buffer errors: try to recover, but may need safe mode if persistent
    if (code === 'analytics:buffer_full') {
      return {
        code,
        severity: 'warn',
        action: 'fallback',
        message: 'Analytics buffer full; dropping events',
        context,
      };
    }

    if (code === 'analytics:buffer_persist_failed') {
      return {
        code,
        severity: 'error',
        action: 'propagate',
        message: 'Failed to persist analytics buffer; data may be lost',
        context,
      };
    }

    // Cross-module errors: storage, network
    if (code === 'storage:unavailable' || code === 'storage:persist_failed') {
      return {
        code,
        severity: 'critical',
        action: 'safe_mode',
        message: 'Storage unavailable; cannot persist analytics buffer',
        context,
      };
    }

    if (code === 'network:unavailable') {
      return {
        code,
        severity: 'warn',
        action: 'fallback',
        message: 'Network unavailable; analytics buffered for later',
        context,
      };
    }

    if (code === 'system:unready') {
      return {
        code,
        severity: 'error',
        action: 'safe_mode',
        message: 'System not ready; analytics unavailable',
        context,
      };
    }

    // Fallback: unknown code
    return {
      code,
      severity: 'error',
      action: 'propagate',
      message: `Unknown analytics error code: ${code}`,
      context,
    };
  },
};
