import { AppPage } from '@/components/ui';
import { useAuthGuard } from '@/hooks/auth';
import { useAppKernel } from '@/hooks/kernel';
import { logger } from '@/hooks/utils';
import { Stack } from 'expo-router';
import { useEffect } from 'react';

export default function SelectLayout() {
  const kernel = useAppKernel();
  const authState = useAuthGuard(kernel.phases.appReady, 'account-only');

  console.log(
    `[ui] [SelectLayout] render — appReady=${kernel.phases.appReady}, authState="${authState}"`,
  );

  // Show minimal loading while guard resolves
  useEffect(() => {
    if (authState === 'unauthenticated') {
      logger.category('navigation').debug('Unauthenticated state detected in select layout');
    }
  }, [authState]);

  // Always render content - UIBlockerLayer handles loading overlay with splash screen
  return (
    <AppPage>
      <Stack screenOptions={{ headerShown: false }} />
    </AppPage>
  );
}