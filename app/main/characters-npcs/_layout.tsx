import { Stack } from 'expo-router';
import { View } from 'react-native';

export default function CharactersNPCsLayout() {
  return (
    <View style={{ flex: 1 }}>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </View>
  );
}