import { Stack, useLocalSearchParams, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import LoadingOverlay from '../components/LoadingOverlay';
import TopBar from '../components/TopBar';
import { CoreColors } from '../constants/theme';
import { useAppBootstrap } from '../hooks/use-app-bootstrap';
import { AuthStateManager } from '../lib/auth-state';

export default function RootLayout() {
    // Get local search params using the hook at the top level
  const params = useLocalSearchParams();
  const userId = typeof params.userId === 'string' ? params.userId : undefined;
  const worldId = typeof params.worldId === 'string' ? params.worldId : undefined;
  const userRole = typeof params.userRole === 'string' ? params.userRole : undefined;
  const router = useRouter();
  const segments = useSegments();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  
  // Use the bootstrap hook to ensure assets and session are loaded
  const bootstrap = useAppBootstrap();

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
          console.log('🚫 Unauthorized access attempt, redirecting to welcome');
          router.replace('/login/welcome');
        }
      } catch (error) {
        console.error('Auth check error:', error);
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
            if (userId) routeParams.userId = userId;
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
            if (userId) routeParams.userId = userId;
            router.replace({
              pathname: '/select/world-selection',
              params: routeParams,
            });
            return true; // Prevent default
          };
        }
        
        switch (secondSegment) {
          case 'characters-npcs':
            config.title = 'Characters & NPCs';
            config.onBackPress = () => {
              const routeParams: any = {};
              if (userId) routeParams.userId = userId;
              if (worldId) routeParams.worldId = worldId;
              if (userRole) routeParams.userRole = userRole;
              router.replace({
                pathname: '/main/desktop',
                params: routeParams,
              });
              return true; // Prevent default
            };
            break;
          case 'items-treasure':
            config.title = 'Items & Treasure';
            config.onBackPress = () => {
              const routeParams: any = {};
              if (userId) routeParams.userId = userId;
              if (worldId) routeParams.worldId = worldId;
              if (userRole) routeParams.userRole = userRole;
              router.replace({
                pathname: '/main/desktop',
                params: routeParams,
              });
              return true; // Prevent default
            };
            break;
          case 'world-exploration':
            config.title = 'World & Exploration';
            config.onBackPress = () => {
              const routeParams: any = {};
              if (userId) routeParams.userId = userId;
              if (worldId) routeParams.worldId = worldId;
              if (userRole) routeParams.userRole = userRole;
              router.replace({
                pathname: '/main/desktop',
                params: routeParams,
              });
              return true; // Prevent default
            };
            break;
          case 'combat-events':
            config.title = 'Combat & Events';
            config.onBackPress = () => {
              const routeParams: any = {};
              if (userId) routeParams.userId = userId;
              if (worldId) routeParams.worldId = worldId;
              if (userRole) routeParams.userRole = userRole;
              router.replace({
                pathname: '/main/desktop',
                params: routeParams,
              });
              return true; // Prevent default
            };
            break;
          case 'story-notes':
            config.title = 'Story & Notes';
            config.onBackPress = () => {
              const routeParams: any = {};
              if (userId) routeParams.userId = userId;
              if (worldId) routeParams.worldId = worldId;
              if (userRole) routeParams.userRole = userRole;
              router.replace({
                pathname: '/main/desktop',
                params: routeParams,
              });
              return true; // Prevent default
            };
            break;
          default:
            // Keep 'D&D Toolkit' for main menu
            break;
        }
        break;
      
      case 'settings':
        config.title = 'Settings';
        config.showHamburger = false;
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
      backgroundColor: CoreColors.backgroundDark
    }}>
      {/* Global TopBar - shown on most screens */}
      {topBarConfig && (
        <TopBar 
          title={topBarConfig.title}
          showBackButton={topBarConfig.showBackButton}
          showHamburger={topBarConfig.showHamburger}
          onBackPress={topBarConfig.onBackPress}
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