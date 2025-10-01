import { Stack, useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import CustomLoad from '../components/custom_components/CustomLoad';
import TopBar from '../components/TopBar';
import { CoreColors } from '../constants/theme';
import { AuthStateManager } from '../lib/auth-state';

export default function RootLayout() {
  const router = useRouter();
  const segments = useSegments();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Protected routes that require authentication
  const protectedRoutes = ['select', 'main', 'settings'];
  const isProtectedRoute = protectedRoutes.includes(segments[0]);

  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authenticated = await AuthStateManager.isAuthenticated();

        // If trying to access protected route without authentication, redirect
        if (isProtectedRoute && !authenticated) {
          console.log('🚫 Unauthorized access attempt, redirecting to welcome');
          router.replace('/login/welcome');
        }
      } catch (error) {
        console.error('Auth check error:', error);
        if (isProtectedRoute) {
          router.replace('/login/welcome');
        }
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuth();
  }, [segments, router, isProtectedRoute]);

  // Show loading while checking authentication for protected routes
  if (isCheckingAuth && isProtectedRoute) {
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center', 
        backgroundColor: CoreColors.backgroundDark 
      }}>
        <CustomLoad />
      </View>
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
            router.replace('/select/world-selection');
            return true; // Prevent default
          };
        }
        break;
      
      case 'main':
        config.title = 'D&D Toolkit';
        
        // Handle feature-specific titles based on second segment
        const secondSegment = segments[1];
        switch (secondSegment) {
          case 'characters-npcs':
            config.title = 'Characters & NPCs';
            break;
          case 'items-treasure':
            config.title = 'Items & Treasure';
            break;
          case 'world-exploration':
            config.title = 'World & Exploration';
            break;
          case 'combat-events':
            config.title = 'Combat & Events';
            break;
          case 'story-notes':
            config.title = 'Story & Notes';
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