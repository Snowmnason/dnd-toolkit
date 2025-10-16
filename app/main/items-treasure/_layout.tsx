import { Stack } from 'expo-router';
import { View } from 'tamagui';

export default function ItemsTreasureLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: '#1e1e1e' /* UPDATE TO THEME */ }}>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </View>
  );
}