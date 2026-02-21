import { AnalyticsConsent, getCrashReportPayload } from '@/lib/analytics';
import * as Sentry from '@sentry/react-native';
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
   * @param error - The error to report
   * @param componentStack - Optional React component stack
   */
  const sendCrashReport = useCallback(
    (error: Error, componentStack?: string) => {
      try {
        // Generate full tiered payload as if user has 'full' consent
        const payload = getCrashReportPayload(error, componentStack, 'full');

        if (payload) {
          Sentry.captureException(error, payload);
        }

        // Log the opt-in for analytics/debugging
        console.log(
          '[CrashOptIn] User sent crash report from none-consent fallback'
        );
      } catch (err) {
        console.error('[CrashOptIn] Failed to send crash report', err);
      }
    },
    []
  );

  return { canOptIn, sendCrashReport };
}
