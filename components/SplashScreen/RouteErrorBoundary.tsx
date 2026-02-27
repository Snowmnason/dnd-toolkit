import { getAppConfig } from '@/config';
import { NavigationContext, RouteConfig } from '@/lib/navigation/navigation-config';
import { logger } from '@/lib/utils';
import { useRouter } from 'expo-router';
import React, { ReactNode } from 'react';
import { ErrorFallbackShell } from './ErrorFallbackShell';

interface RouteErrorBoundaryProps {
  children: ReactNode;
  routeConfig?: RouteConfig;
  navigationContext?: NavigationContext;
  fallbackRoute?: string;
}

interface State {
  hasError: boolean;
  error?: Error;
}


/**
 * Error boundary for individual routes
 * Catches errors and provides fallback navigation
 */
export class RouteErrorBoundary extends React.Component<RouteErrorBoundaryProps, State> {
  constructor(props: RouteErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    const { routeConfig, navigationContext } = this.props;

    // Log the error with category and detailed context
    logger.category('error').error('Route error caught', {
      route: routeConfig?.path || 'unknown',
      errorType: error.name,
      errorMessage: error.message,
      componentStack: errorInfo.componentStack?.substring(0, 200),
      hasCustomErrorHandler: !!routeConfig?.onError
    });

    // Call route's custom error handler if available
    if (routeConfig?.onError && navigationContext) {
      try {
        logger.category('error').debug('Calling custom error handler', {
          route: routeConfig.path
        });
        routeConfig.onError(error, navigationContext);
      } catch (e) {
        logger.category('error').error('Error handler failed', {
          route: routeConfig?.path,
          handlerError: (e as Error).message
        });
      }
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <ErrorFallback
          error={this.state.error}
          fallbackRoute={this.props.fallbackRoute || '/select/world-selection'}
        />
      );
    }

    return this.props.children;
  }
}

interface ErrorFallbackProps {
  error?: Error;
  fallbackRoute: string;
}

/**
 * Fallback UI for route errors
 * Uses ErrorFallbackShell for consistent error display
 */
function ErrorFallback({ error, fallbackRoute }: ErrorFallbackProps) {
  const router = useRouter();
  const config = getAppConfig();
  // Check override setting first, fall back to NODE_ENV if not explicitly set
  // This allows showing detailed errors in production builds via appsettings.dev.json
  const showDetailedErrors = config.overrides?.verboseErrorMessages ?? process.env.NODE_ENV === 'development';

  const handleRecover = () => {
    // Redirect to fallbackRoute (provided by parent or defaults to safe route)
    router.replace(fallbackRoute as any);
  };

  return (
    <ErrorFallbackShell
      error={error}
      showDetails={showDetailedErrors && !!error}
      recoveryMessage="Don't worry - your adventure is safe! Try returning to continue your quest."
      primaryButtonText="Return to The Safe Path"
      onPrimaryAction={handleRecover}
    />
  );
}
