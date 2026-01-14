import { AppLoading, AppPage } from '@/components/ui';
import { useAppBootstrap } from '@/hooks/use-app-bootstrap';
import { useAuthGuard } from '@/lib';
import { Stack } from 'expo-router';

export default function SettingsLayout() {
  const bootstrap = useAppBootstrap();
  // Force Supabase verification on every mount for security-critical pages
  const authState = useAuthGuard(bootstrap.isReady, 'account-only', { forceVerification: true });

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
