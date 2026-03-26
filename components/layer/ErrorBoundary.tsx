import { handleErrorReport } from '@/hooks/analytics';
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
 * Delegates error reporting to useErrorReport.handleErrorReport()
 * Displays a user-friendly crash fallback screen via renderFallback prop
 *
 * NOTE: Positioned within UIBlockerLayer for overlay rendering.
 * The UIBlockerLayer provides the `position: 'relative'` context that allows
 * the error fallback screen to use `position: 'absolute'` for modal-like overlay.
 */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Delegate all error handling to utility function
    handleErrorReport(error, errorInfo);
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

    // Return children directly — positioning is handled by UIBlockerLayer parent
    return this.props.children;
  }
}
