import { AppLoading, AppPage } from '@/components/ui';
import { useAppBootstrap } from '@/hooks/use-app-bootstrap';
import { useAuthGuard } from '@/lib';
import { Stack } from 'expo-router';

export default function SettingsLayout() {
  const bootstrap = useAppBootstrap();
  const authState = useAuthGuard(bootstrap.isReady, 'account-only');

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
