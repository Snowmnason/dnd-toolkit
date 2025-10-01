import { Stack } from 'expo-router';
import { View } from 'react-native';
import TopBar from '../../components/TopBar';
import { CoreColors } from '../../constants/theme';

export default function MainLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: CoreColors.backgroundDark }}>
      <TopBar 
        title="D&D Toolkit" 
        showBackButton={true} 
        showHamburger={true} 
      />
      <Stack 
        screenOptions={{
          headerShown: false,
        }}
      />
    </View>
  );
}