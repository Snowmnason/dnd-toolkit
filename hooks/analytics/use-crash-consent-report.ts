import { AnalyticsConsent, getCrashReportPayload } from '@/lib/analytics';
import { getErrorTracker } from '@/lib/services';
import { logger } from '@/lib/utils/logger';
import { useCallback } from 'react';

/**
 * Hook for handling crash report opt-in when consent is 'none'.
 * 
 * When the user declines analytics consent, crashed errors are not auto-sent to Sentry.
 * This hook provides an opt-in flow where users can choose to send the crash report
 * after the fact, allowing developers to investigate issues without forcing consent.
 * 
 * Usage:
 * ```tsx
 * const { canOptIn, sendCrashReport } = useCrashConsentReport();
 * 
 * if (canOptIn) {
 *   <Button onPress={() => sendCrashReport(error)} text="Send Report & Continue" />
 * }
 * ```
 * 
 * @returns Object with optIn capability and send function
 */
export function useCrashConsentReport() {
  const consentLevel = AnalyticsConsent.getLevel();
  const canOptIn = consentLevel === 'none';

  /**
   * Send a crash report with full payload when user explicitly opts in.
   * Treats the opt-in as temporary 'full' consent for this single error.
   * 
   * This function is async and waits for Sentry to flush the event to ensure
   * the report is sent before the app continues (e.g., restart).
   * 
   * @param error - The error to report
   * @param componentStack - Optional React component stack
   * @returns Promise that resolves once the report has been queued and flushed
   */
  const sendCrashReport = useCallback(
    async (error: Error, componentStack?: string) => {
      try {
        // Generate full tiered payload as if user has 'full' consent
        const payload = getCrashReportPayload(error, componentStack, 'full');

        if (payload) {
          const tracker = getErrorTracker();
          tracker.captureException(error, payload);

          // Attempt to flush pending events to the tracker (Sentry supports flush with timeout)
          try {
            if (typeof tracker.flush === 'function') {
              const flushed = await tracker.flush(2000);
              if (!flushed) {
                logger.category('analytics').warn('Crash report flush did not complete within timeout');
              }
            } else {
              // No flush available on tracker - best-effort only
            }
          } catch (flushErr) {
            logger.category('analytics').warn('Crash report flush failed', { error: flushErr });
          }
        }

        // Log the opt-in for analytics/debugging
        logger
          .category('analytics')
          .info('User sent crash report from none-consent fallback');
      } catch (err) {
        logger
          .category('analytics')
          .error('Failed to send crash report', { error: err });
      }
    },
    [],
  );

  return { canOptIn, sendCrashReport };
}
