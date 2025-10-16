import { Stack } from 'expo-router';
import { View } from 'tamagui';

export default function LoginLayout() {
  return (
    <View>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </View>
  );
}