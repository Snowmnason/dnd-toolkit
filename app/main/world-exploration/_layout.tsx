import { Stack } from 'expo-router';
import { View } from 'react-native';
// Update the import path if TopBar is located elsewhere, for example:
import TopBar from '../../../components/TopBar';

export default function LoginLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: '#2f353d' }}>
      <TopBar 
        title="World Exploration" 
        showBackButton={true} 
        showHamburger={false} 
      />
      <Stack
        screenOptions={{
          headerShown: false,
        }}
      />
    </View>
  );
}