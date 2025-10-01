import { Stack } from 'expo-router';
import { View } from 'react-native';
import TopBar from '../../components/TopBar';
import { CoreColors } from '../../constants/theme';

export default function LoginLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: CoreColors.backgroundDark }}>
      <TopBar 
        title="Login" 
        showBackButton={false} 
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