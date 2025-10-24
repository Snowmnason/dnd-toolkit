import { AppView } from '@/components/ui';
import { Stack } from 'expo-router';

export default function WorldExplorationLayout() {
  return (
    <AppView variant="page">
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </AppView>
  );
}