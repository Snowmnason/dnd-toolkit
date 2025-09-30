import { Stack } from 'expo-router';
import { View } from 'react-native';
import TopBar from '../../components/TopBar';

export default function LoginLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: '#2f353d' }}>
      <TopBar 
        title="D&D Toolkit" 
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