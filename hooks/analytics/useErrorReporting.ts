import { logger } from '@/hooks/utils';
import { AnalyticsConsent } from '@/lib/analytics/consent/consent';
import { getCrashReportPayload } from '@/lib/analytics/consent/consent-error-payload';
import { sessionManager } from '@/lib/analytics/session';
import { reportError } from '@/lib/error/error-manager';
import { ErrorInfo } from 'react';

/**
 * Utility function to handle error reporting with consent checks
 * Called by ErrorBoundary when catching unhandled errors
 * 
 * Logs, tracks in session, and reports error to backend (if consent allows)
 * 
 * @param error - The caught error
 * @param errorInfo - React error info with component stack
 */
export function handleErrorReport(error: Error, errorInfo: ErrorInfo): void {
  // Log error details for debugging
  logger.category('ui').error('Uncaught error:', error, errorInfo);

  // Track error in session
  try {
    sessionManager.trackError();
  } catch (sessionError) {
    logger.category('ui').warn('Could not track error in session:', sessionError);
  }

  // Send to error tracking service (respects consent via getCrashReportPayload)
  try {
    const captureOptions = getCrashReportPayload(
      error,
      errorInfo.componentStack || undefined,
      AnalyticsConsent.getLevel()
    );
    if (captureOptions !== null) {
      reportError(error, captureOptions);
    } else {
      logger.category('ui').warn('Error not sent to error tracker (consent=none; awaiting user opt-in via dialog)');
    }
  } catch (trackerError) {
    logger.category('ui').warn('Could not send error to error tracker:', trackerError);
  }
}
