import { Stack } from 'expo-router';
import { View } from 'react-native';
//import { View } from '../../components/themed-view';

export default function LandingLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: "#2f353d" }}>
      <Stack 
        screenOptions={{
          headerShown: false,
        }}
      />
    </View>
  );
}