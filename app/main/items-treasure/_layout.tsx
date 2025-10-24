import { AppView } from '@/components/ui';
import { Stack } from 'expo-router';

export default function ItemsTreasureLayout() {
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