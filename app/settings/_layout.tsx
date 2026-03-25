import { AppPage } from '@/components/ui';
import { useAuthGuard } from '@/hooks/auth';
import { useAppKernel } from '@/hooks/kernel';
import { Stack } from 'expo-router';

export default function SettingsLayout() {
  const kernel = useAppKernel();
  // Force Supabase verification on every mount for security-critical pages
  const authState = useAuthGuard(kernel.phases.appReady, 'account-only', { forceVerification: true });

  // Always render content - LoadingBlocker at root handles loading overlay with splash screen
  return (
    <AppPage>
      <Stack screenOptions={{ headerShown: false }} />
    </AppPage>
  );
}
