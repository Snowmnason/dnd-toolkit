import { Stack } from 'expo-router';
import { View } from 'react-native';

export default function RootLayout() {
  return (
    <View style={{ height: '100%', width: '100%' }}>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </View>
  );
}