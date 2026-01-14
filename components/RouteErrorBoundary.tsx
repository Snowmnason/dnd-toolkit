import { AppPage, Body, Button, Card, Title } from '@/components/ui';
import { logger } from '@/lib';
import { NavigationContext, RouteConfig } from '@/lib/navigation/navigation-config';
import { useRouter } from 'expo-router';
import React, { ReactNode } from 'react';

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
 */
function ErrorFallback({ error, fallbackRoute }: ErrorFallbackProps) {
  const router = useRouter();

  const handleRecover = () => {
    router.replace(fallbackRoute as any);
  };

  return (
    <AppPage 
      style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center', 
        paddingHorizontal: 24 
      }}
    >
      <Card 
        style={{ 
          alignItems: 'center', 
          maxWidth: 400, 
          padding: 24 
        }}
      >
        <Title style={{ marginBottom: 12 }}>Oops!</Title>
        <Body style={{ textAlign: 'center', marginBottom: 16 }}>
          Something went wrong on this screen. Please try again or return to the previous screen.
        </Body>
        {error && (
          <Body 
            style={{ 
              marginBottom: 20, 
              fontFamily: 'monospace', 
              opacity: 0.8 
            }} 
            numberOfLines={3}
          >
            Error: {error.message}
          </Body>
        )}
        <Button
          text="Return to Safety"
          onPress={handleRecover}
          style={{ marginTop: 16 }}
        />
      </Card>
    </AppPage>
  );
}
