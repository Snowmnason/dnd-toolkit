import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import CustomLoad from '../../components/custom_components/CustomLoad';
import { CoreColors } from '../../constants/theme';
import { AuthStateManager } from '../../lib/auth-state';

export default function MainLayout() {
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authenticated = await AuthStateManager.isAuthenticated();
        
        if (!authenticated) {
          console.log('🚫 Main route: User not authenticated');
          router.replace('/login/welcome');
          return;
        }
      } catch (error) {
        console.error('Main layout auth check error:', error);
        router.replace('/login/welcome');
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuth();
  }, [router]);

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
      <Stack 
        screenOptions={{
          headerShown: false,
        }}
      />
    </View>
  );
}