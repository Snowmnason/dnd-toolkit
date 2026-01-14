import { Body, Button, Card, Title } from '@/components/ui';
import { logger } from '@/lib';
import { View } from "react-native";
import { getAppConfig } from '@/lib/config/loader';
import { NavigationContext, RouteConfig } from '@/lib/navigation/navigation-config';
import { UseTheme, useScale } from '@/theme';
import { useRouter } from 'expo-router';
import React, { ReactNode, useMemo } from 'react';

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
// Fun D&D-themed error messages
const ERROR_MESSAGES = [
  "Oops! Someone spilled a drink on the character sheet!",
  "Oops! Your pencil broke mid-session!",
  "Oops! We encountered a TPK!",
  "Oops! The DM's notes got eaten by the dog!",
  "Oops! Natural 1!",
  "Oops! The dice rolled off the table!",
  "Oops! Someone forgot to bring snacks!",
  "Oops! The dragon decided to show up early!",
  "Oops! Critical fumble on the app loading!",
  "Oops! The tavern ran out of ale!",
  "Oops! Your spell fizzled!",
  "Oops! The mimic was actually the treasure chest!",
];


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
 * Styled similar to CrashFallBack for consistency
 */
function ErrorFallback({ error, fallbackRoute }: ErrorFallbackProps) {
  const { theme } = UseTheme();
  const S = useScale();
  const router = useRouter();
  const config = getAppConfig();
  // Check override setting first, fall back to NODE_ENV if not explicitly set
  // This allows showing detailed errors in production builds via appsettings.dev.json
  const showDetailedErrors = config.overrides?.verboseErrorMessages ?? process.env.NODE_ENV === 'development';

  const handleRecover = () => {
    // Always redirect to welcome screen (/) to avoid redirect loops
    router.replace('/' as any);
  };
    // Pick a random fun message
  const funMessage = useMemo(
    () => ERROR_MESSAGES[Math.floor(Math.random() * ERROR_MESSAGES.length)],
    []
  );

  return (
<View
      style={{
        alignItems: "center",
        justifyContent: "center",
        flex: 1,
        backgroundColor: theme.background,
        padding: S.space.lg,
      }}
    >
      <Card
        padded
        bordered
        style={{
          width: "100%",
          padding: S.space.xl,
        }}
      >
        {/* Error Icon/Title */}
        <Title
          align="center"
          style={{
            color: theme.accent,
            marginBottom: S.space.md,
          }}
        >
          🎲 {funMessage}
        </Title>
        <Body 
          align="center" 
          style={{ 
            marginBottom: 24, 
            lineHeight: 1.6,
            opacity: 0.9
          }}
        >
          Don&apos;t worry - your adventure is safe! Try returning to the tavern (home screen) to continue your quest.
        </Body>
        {error && showDetailedErrors && (
          <Card 
            bordered
            padded
            style={{ 
              marginBottom: 24,
              width: '100%',
              maxHeight: 200,
              overflow: 'hidden'
            }}
          >
            <Body 
              style={{ 
                fontFamily: 'monospace', 
                fontSize: 12,
                opacity: 0.8
              }}
            >
              {error.message}
            </Body>
          </Card>
        )}
        <Button
          text="Return to Welcome Screen"
          onPress={handleRecover}
        />
      </Card>
    </View>
  );
}
