import { AppPage } from '@/components/ui';
import { useAuthGuard } from '@/hooks/auth';
import { useAppKernel } from '@/hooks/kernel';
import { logger } from '@/hooks/utils';
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

  // ScreenProvider at root layout enables AppSplit screens to share panel state with TopBar
  return (
    <AppPage>
      <Stack screenOptions={{ headerShown: false }} />
    </AppPage>
  );
}