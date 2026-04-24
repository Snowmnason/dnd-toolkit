import { type NavigationContext } from '@/lib/navigation/navigationConfig';
import { logger } from '@/lib/utils';
import { type RouteConfig } from '@/type-definitions';
import React, { ReactNode } from 'react';
import { NavigationErrorScreen } from '../SplashScreen/NavigationErrorScreen';

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
        <NavigationErrorScreen
          error={this.state.error}
          fallbackRoute={this.props.fallbackRoute || '/select/world-selection'}
        />
      );
    }

    return this.props.children;
  }
}
