import { AppPage } from '@/components/ui';
import { Stack } from 'expo-router';

export default function CombatEventsLayout() {
  return (
    <AppPage>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </AppPage>
  );
}