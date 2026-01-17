import { AppLoading, AppPage } from '@/components/ui';
import { useAppKernel, useAuthGuard } from '@/lib';
import { Stack } from 'expo-router';

export default function SettingsLayout() {
  const kernel = useAppKernel();
  // Force Supabase verification on every mount for security-critical pages
  const authState = useAuthGuard(kernel.phases.appReady, 'account-only', { forceVerification: true });

  // Show loading while guard resolves
  if (authState === 'loading') {
    return <AppLoading />;
  }

  return (
    <AppPage>
      <Stack screenOptions={{ headerShown: false }} />
    </AppPage>
  );
}
