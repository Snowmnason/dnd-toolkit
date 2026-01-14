import { AppLoading, AppPage } from '@/components/ui';
import { logger, useAuthGuard } from '@/lib';
import { useAppBootstrap } from '@/hooks/use-app-bootstrap';
import { Stack } from 'expo-router';
import { useEffect } from 'react';

export default function SelectLayout() {
  const bootstrap = useAppBootstrap();
  const authState = useAuthGuard(bootstrap.isReady, 'account-only');

  // Show minimal loading while guard resolves
  useEffect(() => {
    if (authState === 'unauthenticated') {
      logger.debug('navigation', 'Unauthenticated state detected in select layout');
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