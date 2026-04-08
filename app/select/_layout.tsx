import { AppPage } from '@/components/ui';
import { Stack } from 'expo-router';

export default function SelectLayout() {
  // ScreenProvider at root layout enables AppSplit screens to share panel state with TopBar
  return (
    <AppPage>
      <Stack screenOptions={{ headerShown: false }} />
    </AppPage>
  );
}