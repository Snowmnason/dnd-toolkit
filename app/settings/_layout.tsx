import { AppPage } from '@/components/ui';
import { Stack } from 'expo-router';

export default function SettingsLayout() {
  // Always render content - UIBlockerLayer handles loading overlay with splash screen
  return (
    <AppPage>
      <Stack screenOptions={{ headerShown: false }} />
    </AppPage>
  );
}
