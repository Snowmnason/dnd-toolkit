import { AppView } from '@/components/ui';
import { Stack } from 'expo-router';

export default function StoryNotesLayout() {
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