import { AnalyticsConsent, getCrashReportPayload, sessionManager } from '@/lib/analytics';
import { reportError } from '@/lib/error';
import { logger } from '@/lib/utils/logger';
import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  renderFallback?: (error: Error | null, retry: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Global Error Boundary Component
 *
 * Catches unhandled errors in the React component tree
 * Logs errors to console and error tracking service
 * Displays a user-friendly crash fallback screen via renderFallback prop
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details for debugging
    logger.category('ui').error('Uncaught error:', error, errorInfo);

    // Track error in session
    try {
      sessionManager.trackError();
    } catch (sessionError) {
      logger.category('ui').warn('Could not track error in session:', sessionError);
    }

    // Send to error tracking service
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
        // TODO: Show crash consent dialog here (out of scope Phase 1)
      }
    } catch (trackerError) {
      // Error tracker might not be available (e.g., on web in some cases)
      logger.category('ui').warn('Could not send error to error tracker:', trackerError);
    }
  }

  handleRetry = () => {
    // Reset error state to attempt recovery
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      // Use renderFallback if provided, otherwise return null
      if (this.props.renderFallback) {
        return this.props.renderFallback(this.state.error, this.handleRetry);
      }
      return null;
    }

    return this.props.children;
  }
}
