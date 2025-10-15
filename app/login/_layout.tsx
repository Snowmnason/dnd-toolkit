import { CoreColors } from '@/constants/corecolors';
import { Stack } from 'expo-router';
import { View } from 'react-native';

export default function LoginLayout() {
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