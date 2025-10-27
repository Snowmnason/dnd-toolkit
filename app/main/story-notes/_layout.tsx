import { AppPage } from '@/components/ui';
import { Stack } from 'expo-router';

export default function StoryNotesLayout() {
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