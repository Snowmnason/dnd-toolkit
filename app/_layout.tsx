import { AuthStateManager } from "@/lib";
import { ScaleProvider } from "@/providers/ScaleProvider";
import { ThemeProvider, UseTheme } from "@/theme";
import { Stack, useLocalSearchParams, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import LoadingOverlay from '../components/LoadingOverlay';
import { SplashScreen } from '../components/SplashScreen';
import TopBar from '../components/TopBar';
import { AppParamsProvider, useAppParams } from '../contexts/AppParamsContext';
import { PlatformProvider, usePlatform } from '../contexts/PlatformContext';
import { useAppBootstrap } from '../hooks/use-app-bootstrap';
import { useSplashScreen } from '../hooks/use-splash-screen';

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

  // Protected routes that require authentication
  const protectedRoutes = ['select', 'main', 'settings'] as const;
  const firstSegmentForProtection = typeof segments[0] === 'string' ? segments[0] : '';
  const isProtectedRoute = protectedRoutes.includes(firstSegmentForProtection as any);

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

  // Check authentication status ONLY after bootstrap is complete
  useEffect(() => {
    // Don't proceed until bootstrap is complete
    if (!bootstrap.isReady) {
      return;
    }

    const checkAuth = async () => {
      try {
        // Don't interfere with login routes at all
        if (segments[0] === 'login') {
          setIsCheckingAuth(false);
          return;
        }

        const authenticated = await AuthStateManager.isAuthenticated();

        // Only redirect if trying to access protected route without authentication
        if (isProtectedRoute && !authenticated) {
          router.replace('/login/welcome');
        }
      } catch {
        // On error, only redirect protected routes, let login routes work normally
        if (isProtectedRoute) {
          router.replace('/login/welcome');
        }
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuth();
  }, [segments, router, isProtectedRoute, bootstrap.isReady]);

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

  // Determine TopBar configuration based on current route
  const getTopBarConfig = () => {
    const firstSegment = segments[0];

    if (hideTopBar) return null;

    // Default config
    let config = {
      title: 'D&D Toolkit',
      showBackButton: true,
      showHamburger: true,
      onBackPress: undefined as (() => boolean) | undefined
    };

    // Configure based on route
    switch (firstSegment) {
      case 'select':
        config.title = 'Select World';
        
        // Handle create-world back navigation
        if (segments.some(segment => segment === 'create-world')) {
          config.onBackPress = () => {
            router.replace('/select/world-selection');
            return true; // Prevent default
          };
        }
        break;
      
      case 'main':
        config.title = 'D&D Toolkit';
        
        // Handle feature-specific titles based on second segment
        const secondSegment = segments[1];
        
        // Handle main-landing route - always go back to world-selection
        if (secondSegment === 'main-landing') {
          config.onBackPress = () => {
            router.replace('/select/world-selection');
            return true; // Prevent default
          };
        }

        // Helper function to create feature screen back handler
        const createFeatureBackHandler = (tabKey: string) => () => {
          const routeParams: any = {};
          routeParams.worldId = worldId;
          routeParams.userRole = userRole;
          
          const pathname = '/main/main-landing';
          
          if (isMobile) {
            routeParams.tab = tabKey;
          }
          
          router.replace({
            pathname,
            params: routeParams,
          });
          return true; // Prevent default
        };

        switch (secondSegment) {
          case 'characters-npcs':
            config.title = 'Characters & NPCs';
            config.onBackPress = createFeatureBackHandler('characters');
            break;
          case 'items-treasure':
            config.title = 'Items & Treasure';
            config.onBackPress = createFeatureBackHandler('items');
            break;
          case 'world-exploration':
            config.title = 'World & Exploration';
            config.onBackPress = createFeatureBackHandler('world');
            break;
          case 'combat-events':
            config.title = 'Combat & Events';
            config.onBackPress = createFeatureBackHandler('combat');
            break;
          case 'story-notes':
            config.title = 'Story & Notes';
            config.onBackPress = createFeatureBackHandler('story');
            break;
          default:
            // Keep 'D&D Toolkit' for main menu
            break;
        }
        break;
      
      case 'settings':
        config.title = 'Settings';
        config.showHamburger = false;
        config.onBackPress = () => {
          router.replace('/select/world-selection');
          return true; // Prevent default
        };
        break;
      
      default:
        // Keep defaults
        break;
    }
    return config;
  };

  const topBarConfig = getTopBarConfig();

  return (

    <View style={{
      height: '100%',
      width: '100%',
      backgroundColor: theme.background || '#2f353d'
    }}>
      {/* Global TopBar - shown on most screens */}
      {topBarConfig && (
        <TopBar 
          title={topBarConfig.title}
          showBackButton={topBarConfig.showBackButton}
          showHamburger={topBarConfig.showHamburger}
          onBackPress={topBarConfig.onBackPress}
          userId={userId}
          worldId={worldId}
          userRole={userRole}
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
  );
}

// Main export with provider wrapper
export default function RootLayout() {
  return (
    <ThemeProvider>
      <ScaleProvider>
        <PlatformProvider>
          <AppParamsProvider>
            <RootLayoutContent />
          </AppParamsProvider>
        </PlatformProvider>
      </ScaleProvider>
    </ThemeProvider>
  );
}