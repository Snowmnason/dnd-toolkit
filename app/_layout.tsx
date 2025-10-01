import { Stack } from 'expo-router';
import { View } from 'react-native';
import { CoreColors } from '../constants/theme';

export default function RootLayout() {
  return (
    <View style={{
      height: '100%',
      width: '100%',
      backgroundColor: CoreColors.backgroundDark
    }}>
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </View>
  );
}