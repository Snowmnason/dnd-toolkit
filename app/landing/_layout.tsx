import { Stack } from 'expo-router';
import { ThemedView } from '../../components/themed-view';

export default function LandingLayout() {
  return (
    <ThemedView style={{ flex: 1 }}>
      <Stack 
        screenOptions={{
          headerShown: false,
        }}
      />
    </ThemedView>
  );
}