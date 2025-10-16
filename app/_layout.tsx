import { Stack, useLocalSearchParams, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { Dimensions, Platform, View } from 'react-native';
import { TamaguiProvider } from 'tamagui';
import LoadingOverlay from '../components/LoadingOverlay';
import TopBar from '../components/TopBar';
import { AppParamsProvider, useAppParams } from '../contexts/AppParamsContext';
import { useAppBootstrap } from '../hooks/use-app-bootstrap';
import { useThemeManager } from '../hooks/useThemeManager';
import { AuthStateManager } from '../lib/auth-state';
import { logger } from '../lib/utils/logger';
import { config } from '../tamagui.config';


function RootLayoutContent() {
  // Get local search params using the hook at the top level
  const urlParams = useLocalSearchParams();
  const router = useRouter();
  const segments = useSegments();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const { width } = Dimensions.get('window');
  const isMobile = Platform.OS !== 'web' || width < 900;
  
  // Use centralized params context
  const { params, updateParams, clearWorldParams, clearAllParams } = useAppParams();
  const { userId, worldId, userRole } = params;
  
  // Use the bootstrap hook to ensure assets and session are loaded
  const bootstrap = useAppBootstrap();

  // Update context params when URL params change
  useEffect(() => {
    const currentUserId = typeof urlParams.userId === 'string' ? urlParams.userId : undefined;
    const currentWorldId = typeof urlParams.worldId === 'string' ? urlParams.worldId : undefined;
    const currentUserRole = typeof urlParams.userRole === 'string' ? urlParams.userRole : undefined;

    // Only update if values are different from context
    let shouldUpdate = false;
    const updates: { userId?: string; worldId?: string; userRole?: string } = {};
    if (currentUserId && currentUserId !== params.userId) {
      updates.userId = currentUserId;
      shouldUpdate = true;
    }
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

  // Protected routes that require authentication
  const protectedRoutes = ['select', 'main', 'settings'];
  const isProtectedRoute = protectedRoutes.includes(segments[0]);

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
          logger.debug('app-layout', 'Unauthorized access attempt, redirecting to welcome');
          router.replace('/login/welcome');
        }
      } catch (error) {
        logger.error('app-layout', 'Auth check error:', error);
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

  // Determine if we should show the TopBar - only hide on login/welcome routes
  const hideTopBar = segments.some(segment => segment === 'login') ||
                    segments.some(segment => segment === 'welcome');

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
        
        // Handle create-world and world-detail back navigation
        if (segments.some(segment => segment === 'create-world') || segments.some(segment => segment === 'world-detail')) {
          config.onBackPress = () => {
            const routeParams: any = {};
            routeParams.userId = userId;
            router.replace({
              pathname: '/select/world-selection',
              params: routeParams,
            });
            return true; // Prevent default
          };
        }
        break;
      
      case 'main':
        config.title = 'D&D Toolkit';
        
        // Handle feature-specific titles based on second segment
        const secondSegment = segments[1];
        
        // Handle desktop/mobile routes - always go back to world-selection
        if (secondSegment === 'desktop' || secondSegment === 'mobile') {
          config.onBackPress = () => {
            const routeParams: any = {};
            routeParams.userId = userId;
            router.replace({
              pathname: '/select/world-selection',
              params: routeParams,
            });
            return true; // Prevent default
          };
        }

        // Helper function to create feature screen back handler
        const createFeatureBackHandler = (tabKey: string) => () => {
          const routeParams: any = {};
          routeParams.userId = userId;
          routeParams.worldId = worldId;
          routeParams.userRole = userRole;
          
          const pathname = isMobile ? '/main/mobile' : '/main/desktop';
          
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
          const routeParams: any = {};
          if (userId) routeParams.userId = userId;
          router.replace({
            pathname: '/select/world-selection',
            params: routeParams,
          });
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
      backgroundColor: '#2f353d' //Temporary hardcoded dark background to avoid flash on load
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
        }}
      />
    </View>
  );
}

// Main export with provider wrapper
export default function RootLayout() {
  const { theme } = useThemeManager();
  return (
      <TamaguiProvider config={config} defaultTheme="dark">
        <AppParamsProvider>
          <RootLayoutContent />
        </AppParamsProvider>
      </TamaguiProvider>
  );
}