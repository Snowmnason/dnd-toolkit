import { CoreColors } from '@/constants/corecolors';
import { AuthStateManager, logger } from '@/lib';
import { Stack, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import CustomLoad from '../../components/custom_components/CustomLoad';


export default function SelectLayout() {
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const authenticated = await AuthStateManager.isAuthenticated();
        
        if (!authenticated) {
          logger.debug('select-layout', 'User not authenticated');
          router.replace('/login/welcome');
          return;
        }
      } catch (error) {
        logger.error('select-layout', 'Select layout auth check error:', error);
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