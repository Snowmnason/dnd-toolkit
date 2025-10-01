import { Stack } from 'expo-router';
import { View } from 'react-native';
import { CoreColors } from '../../../constants/theme';

export default function CombatEventsLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: CoreColors.backgroundDark }}>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </View>
  );
}