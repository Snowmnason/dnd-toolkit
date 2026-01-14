import * as Sentry from '@sentry/react-native';
import { Component, ErrorInfo, ReactNode } from 'react';
import { sessionManager } from '../analytics/session';
import { logger } from '../utils/logger';

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
 * Logs errors to console and Sentry
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
    logger.error('ui', 'Uncaught error:', error, errorInfo);

    // Track error in session
    try {
      sessionManager.trackError();
    } catch (sessionError) {
      logger.warn('ui', 'Could not track error in session:', sessionError);
    }

    // Send to Sentry crash reporting service
    try {
      Sentry.captureException(error, {
        contexts: {
          react: {
            componentStack: errorInfo.componentStack,
          },
        },
      });
    } catch (sentryError) {
      // Sentry might not be available (e.g., on web in some cases)
      logger.warn('ui', 'Could not send error to Sentry:', sentryError);
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
