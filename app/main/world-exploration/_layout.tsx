import { Stack } from 'expo-router';
import { View } from 'tamagui';
// import { CoreColors } from '../../../constants/theme'; // deprecated

export default function WorldExplorationLayout() {
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
