import { Component, ErrorInfo, ReactNode } from 'react';
import { logger } from '../utils/logger';
import * as Sentry from '@sentry/react-native';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
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
 * Displays a user-friendly crash fallback screen
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error details for debugging
    logger.error('ErrorBoundary', 'Uncaught error:', error, errorInfo);

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
      logger.warn('ErrorBoundary', 'Could not send error to Sentry:', sentryError);
    }
  }

  handleRetry = () => {
    // Reset error state to attempt recovery
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      // If a custom fallback is provided, use it
      // Otherwise, the parent component should provide the fallback UI
      return this.props.fallback || null;
    }

    return this.props.children;
  }
}
