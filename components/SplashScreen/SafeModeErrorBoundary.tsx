import { logger } from "@/lib";
import React, { ReactNode } from "react";
import { CrashFallBack } from "./CrashFallBack";

interface SafeModeErrorBoundaryProps {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

/**
 * Error Boundary for SafeModeScreen
 *
 * CRITICAL: SafeModeScreen is the app's last line of defense.
 * If it crashes, the user has no recovery path. This boundary ensures
 * that even if SafeModeScreen fails, we still show a fallback error screen.
 *
 * This is a more aggressive boundary than RouteErrorBoundary - it logs
 * to emergency category and uses the crash fallback UI.
 */
export class SafeModeErrorBoundary extends React.Component<
  SafeModeErrorBoundaryProps,
  State
> {
  constructor(props: SafeModeErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log as CRITICAL - SafeModeScreen crashing is a severe issue
    logger.category("error").error("CRITICAL: SafeModeScreen crashed", {
      errorType: error.name,
      errorMessage: error.message,
      componentStack: errorInfo.componentStack?.substring(0, 500),
      severity: "CRITICAL",
    });

    // Note: We don't call any recovery handlers since we're already in an error state
    // The crash fallback will give user options to restart
  }

  render() {
    if (this.state.hasError) {
      return (
        <CrashFallBack
          error={this.state.error || null}
          onRetry={() => {
            // Reset error boundary state to retry
            this.setState({ hasError: false, error: undefined });
          }}
        />
      );
    }

    return this.props.children;
  }
}
