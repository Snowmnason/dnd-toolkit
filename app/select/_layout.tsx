import { AppLoading, AppPage } from '@/components/ui';
import { logger, useAppKernel, useAuthGuard } from '@/lib';
import { Stack } from 'expo-router';
import { useEffect } from 'react';

export default function SelectLayout() {
  const kernel = useAppKernel();
  const authState = useAuthGuard(kernel.phases.appReady, 'account-only');

  // Show minimal loading while guard resolves
  useEffect(() => {
    if (authState === 'unauthenticated') {
      logger.category('navigation').debug('Unauthenticated state detected in select layout');
    }
  }, [authState]);

  if (authState === 'loading') {
    return <AppLoading />;
  }

  return (
    <AppPage>
      <Stack screenOptions={{ headerShown: false }} />
    </AppPage>
  );
}