import { Stack } from 'expo-router';
import { ThemedView } from '../components/themed-view';

export default function RootLayout() {
  return (
    <ThemedView style={{ height: '100%', width: '100%' }}>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </ThemedView>
  );
}