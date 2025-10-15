import { CoreColors } from '@/constants/corecolors';
import { Stack, useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, View, useWindowDimensions } from 'react-native';
import CustomLoad from '../../components/custom_components/CustomLoad';
import { BottomTabBar } from '../../components/main-panels/BottomTabBar';
import { AuthStateManager } from '../../lib/auth-state';
import { logger } from '../../lib/utils/logger';

export default function MainLayout() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useLocalSearchParams();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState<string>('characters');
  const { width } = useWindowDimensions();
  
  // Determine if we're on mobile
  const isMobile = Platform.OS !== 'web' || width < 900;

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authenticated = await AuthStateManager.isAuthenticated();
        
        if (!authenticated) {
          logger.debug('main-layout', 'User not authenticated');
          router.replace('/login/welcome');
          return;
        }
      } catch (error) {
        logger.error('main-layout', 'Main layout auth check error:', error);
        router.replace('/login/welcome');
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuth();
  }, [router]);

  // Handle tab changes from the bottom bar
  const handleTabChange = (tabKey: string) => {
    setActiveTab(tabKey);
    
    // Navigate to mobile main screen with the new tab
    const userId = typeof params.userId === 'string' ? params.userId : undefined;
    const worldId = typeof params.worldId === 'string' ? params.worldId : undefined;
    
    const routeParams: any = { tab: tabKey };
    if (userId) routeParams.userId = userId;
    if (worldId) routeParams.worldId = worldId;
    
    router.push({
      pathname: '/main/mobile',
      params: routeParams,
    });
  };

  // Update active tab based on current route
  useEffect(() => {
    // Determine active tab from pathname
    if (pathname.includes('characters-npcs')) {
      setActiveTab('characters');
    } else if (pathname.includes('items-treasure')) {
      setActiveTab('items');
    } else if (pathname.includes('world-exploration')) {
      setActiveTab('world');
    } else if (pathname.includes('combat-events')) {
      setActiveTab('combat');
    } else if (pathname.includes('story-notes')) {
      setActiveTab('story');
    }
  }, [pathname]);

  if (isCheckingAuth) {
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

  return (
    <View style={{ flex: 1, backgroundColor: CoreColors.backgroundDark }}>
      <View style={{ flex: 1 }}>
        <Stack 
          screenOptions={{
            headerShown: false,
          }}
        />
      </View>
      {/* Show bottom tab bar only on mobile */}
      {isMobile && (
        <BottomTabBar
          activeTab={activeTab}
          onTabChange={handleTabChange}
        />
      )}
    </View>
  );
}