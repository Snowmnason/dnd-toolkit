import { RouteErrorBoundary } from "@/components/RouteErrorBoundary";
import { useAnalyticsNavigation } from '@/hooks/use-analytics-navigation';
import { AppErrorBoundary, AUTH_CONFIG, getRouteConfig, resolveBackTarget, resolveTitle, useAuthGuard } from "@/lib";
import { Analytics, sessionManager } from '@/lib/analytics';
import { getAppConfig } from '@/lib/config/loader';
import { buildNavigationTarget } from '@/lib/navigation/uri-helpers';
import { ScaleProvider } from "@/providers/ScaleProvider";
import { SubscriptionProvider } from "@/providers/SubscriptionProvider";
import { ThemeProvider, UseTheme } from "@/theme";
import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import { Stack, useLocalSearchParams, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import LoadingOverlay from '../components/LoadingOverlay';
import { CrashFallBack, SplashScreen } from '../components/SplashScreen';
import TopBar from '../components/TopBar';
import { AppParamsProvider, useAppParams } from '../contexts/AppParamsContext';
import { PlatformProvider, usePlatform } from '../contexts/PlatformContext';
import { useAppBootstrap } from '../hooks/use-app-bootstrap';
import { useSplashScreen } from '../hooks/use-splash-screen';
import { APP_VERSION } from '../lib/version';

// Check if Sentry is enabled via feature flag
const config = getAppConfig();
const isSentryEnabled = config.features?.sentryEnabled ?? false;

// Get Sentry DSN from environment variables
const sentryDsn =
  process.env.EXPO_PUBLIC_SENTRY_DSN ||
  Constants.expoConfig?.extra?.sentryDsn;

// Get environment from Expo config or default to development/production
const environment = process.env.EXPO_PUBLIC_ENVIRONMENT ||
  Constants.expoConfig?.extra?.environment ||
  'production';

const isDev = environment === 'development';

// Only initialize Sentry if enabled via feature flag AND DSN is provided
if (isSentryEnabled && sentryDsn) {
  Sentry.init({
    dsn: sentryDsn,

  // Environment-specific configuration
  environment,
  release: `dnd-toolkit@${APP_VERSION}`,

  // Enable debug mode in development
  debug: isDev,

  // Sample rate for production (reduce noise)
  sampleRate: isDev ? 1.0 : 0.1,

  // Adds more context data to events (IP address, cookies, user, etc.)
  // For more information, visit: https://docs.sentry.io/platforms/react-native/data-management/data-collected/
  sendDefaultPii: true,

  // Enable Logs in development only
  enableLogs: isDev,

  // Filter out development errors in production
  beforeSend: (event) => {
    // In development, only send errors that are not common development issues
    if (isDev) {
      // Filter out common development errors
      if (event.exception?.values?.[0]?.value?.includes('Network request failed')) {
        return null;
      }
      if (event.exception?.values?.[0]?.value?.includes('Loading chunk')) {
        return null;
      }
    }
    return event;
  },

  // uncomment the line below to enable Spotlight (https://spotlightjs.com)
  // spotlight: isDev,
  });
  console.log('[Sentry] Initialized (feature flag enabled)');
} else {
  if (!isSentryEnabled) {
    console.log('[Sentry] Disabled via feature flag (sentryEnabled=false)');
  } else if (!sentryDsn) {
    console.log('[Sentry] Disabled - no DSN provided');
  }
}

function RootLayoutContent() {
  const { theme } = UseTheme();
  // Get local search params using the hook at the top level
  const urlParams = useLocalSearchParams();
  const router = useRouter();
  const segments = useSegments();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const { isMobile } = usePlatform();
  
  // Use centralized params context
  const { params, updateParams, clearWorldParams, clearAllParams } = useAppParams();
  const { userId, worldId, userRole } = params;
  
  // Use the bootstrap hook to ensure assets and session are loaded
  const bootstrap = useAppBootstrap();
  
  // Splash screen management (feature flag controlled)
  const splash = useSplashScreen();
  // Analytics: track route changes and coarse screen timings
  useAnalyticsNavigation();

  // Identify user to analytics when available
  useEffect(() => {
    Analytics.identify(userId ? { id: userId } : null);
    
    // Start session when user is identified
    if (userId) {
      sessionManager.startSession(userId);
    }
  }, [userId]);

  // Protected routes that require authentication
  const firstSegmentForProtection = typeof segments[0] === 'string' ? segments[0] : '';
  const isProtectedRoute = AUTH_CONFIG.protectedRoutes.includes(firstSegmentForProtection as any);

  // (logging removed)

  // Update context params when URL params change
  useEffect(() => {
    const currentWorldId = typeof urlParams.worldId === 'string' ? urlParams.worldId : undefined;
    const currentUserRole = typeof urlParams.userRole === 'string' ? urlParams.userRole : undefined;

    // Only update if values are different from context (userId is loaded from storage, not URL)
    let shouldUpdate = false;
    const updates: { worldId?: string; userRole?: string } = {};
    if (currentWorldId && currentWorldId !== params.worldId) {
      updates.worldId = currentWorldId;
      shouldUpdate = true;
    }
    if (currentUserRole && currentUserRole !== params.userRole) {
      updates.userRole = currentUserRole;
      shouldUpdate = true;
    }

    if (shouldUpdate) {
      updateParams(updates);
    }

    // Only clear params when entering login routes and params exist
    if (segments[0] === 'login' && (params.userId || params.worldId || params.userRole)) {
      clearAllParams();
    } 
    // Only clear world params when entering select routes and world params exist
    else if (segments[0] === 'select' && (params.worldId || params.userRole)) {
      clearWorldParams();
    }
  }, [urlParams, segments, updateParams, clearAllParams, clearWorldParams, params.userId, params.worldId, params.userRole]);

  // Centralized auth guard (pass bootstrap state to avoid circular dependency)
  const authState = useAuthGuard(bootstrap.isReady);
  
  // Manage loading state based on guard and bootstrap
  useEffect(() => {
    if (!bootstrap.isReady) return;
    // Don't block login routes
    if (segments[0] === 'login') {
      setIsCheckingAuth(false);
      return;
    }
    if (authState !== 'loading') {
      setIsCheckingAuth(false);
    }
  }, [authState, bootstrap.isReady, segments]);

  // Ensure unauthenticated users on root index are redirected to login/welcome
  useEffect(() => {
    if (!bootstrap.isReady) return;
    const onRoot = segments[0] === undefined;
    if (onRoot && authState === 'unauthenticated') {
      router.replace('/login/welcome');
    }
  }, [bootstrap.isReady, authState, segments, router]);

  // Show splash screen (if enabled via feature flag)
  // Splash screen displays BEFORE any other content
  if (splash.showSplash) {
    return <SplashScreen />;
  }

  // Show loading while bootstrap is happening OR while checking auth for protected routes
  if (!bootstrap.isReady || (isCheckingAuth && isProtectedRoute)) {
    return (
      <LoadingOverlay 
        message="Loading D&D Toolkit..."
        error={bootstrap.error}
        assetsLoaded={bootstrap.assetsLoaded}
      />
    );
  }

  // Determine if we should show the TopBar - hide on login routes and index route
  // Hide TopBar when: on login flow, on welcome screen, on root/index (loading screen), or web routes (downloads)
  const firstSegment = typeof segments[0] === 'string' ? segments[0] : '';
  const isRootRoute = segments[0] === undefined;
  const hideTopBar = isRootRoute || firstSegment === 'login' || firstSegment === 'web';

  // Build navigation context for route config
  const navContext = {
    segments,
    params: {
      worldId: worldId as string | undefined,
      userRole: userRole as string | undefined,
    },
    router,
    worldId: worldId as string | undefined,
    userRole: userRole as string | undefined,
    isMobile,
    isAuthenticated: authState === 'authenticated',
  };

  // Get route config for centralized TopBar, back behavior, and a11y
  const routeConfig = getRouteConfig(navContext);
  const topBarTitle = !hideTopBar ? resolveTitle(routeConfig, navContext) : undefined;
  const topBarBackTarget = !hideTopBar ? resolveBackTarget(routeConfig, navContext) : undefined;

  // Build back press handler using config
  const handleTopBarBack = () => {
    if (topBarBackTarget) {
      // Check if back target has params to preserve
      if (routeConfig.preserveParamsOnBack && (worldId || userRole)) {
        const target = buildNavigationTarget(
          topBarBackTarget,
          { worldId, userRole },
          routeConfig.preserveParamsOnBack || []
        );
        router.replace(target as any);
      } else {
        router.replace(topBarBackTarget as any);
      }
    } else {
      router.back();
    }
  };

  return (

    <RouteErrorBoundary 
      routeConfig={routeConfig}
      navigationContext={navContext}
      fallbackRoute="/select/world-selection"
    >
      <View style={{
        height: '100%',
        width: '100%',
        backgroundColor: theme.background || '#2f353d'
      }}>
        {/* Global TopBar - driven by centralized navigation config */}
        {!hideTopBar && topBarTitle && (
          <TopBar 
            title={topBarTitle}
          showBackButton={routeConfig.back !== undefined}
            userRole={userRole}
            a11yFocusTarget={routeConfig.a11yFocusTarget}
          />
        )}
        
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: {
              backgroundColor: '$background',
            },
          }}
        />
      </View>
    </RouteErrorBoundary>
  );
}

// Main export with provider wrapper and error boundary
export default function RootLayout() {
  return (
    <ThemeProvider>
      <ScaleProvider>
        <PlatformProvider>
          <SubscriptionProvider>
            <AppParamsProvider>
              <AppErrorBoundary 
                renderFallback={(error, onRetry) => (
                  <CrashFallBack error={error} onRetry={onRetry} />
                )}
              >
                <RootLayoutContent />
              </AppErrorBoundary>
            </AppParamsProvider>
          </SubscriptionProvider>
        </PlatformProvider>
      </ScaleProvider>
    </ThemeProvider>
  );
}