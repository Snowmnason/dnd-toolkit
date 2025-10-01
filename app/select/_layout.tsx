import { Stack } from 'expo-router';
import { View } from 'react-native';
import TopBar from '../../components/TopBar';
import { CoreColors } from '../../constants/theme';

export default function SelectLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: CoreColors.backgroundDark }}>
      <TopBar 
        title="Select World" 
        showBackButton={true} 
        showHamburger={true}
        onBackPress={() => {
          // This will be the default router.back() behavior
          // If you need custom behavior, you can add it here
          return false; // Let default back behavior happen
        }}
      />
      <Stack 
        screenOptions={{
          headerShown: false,
        }}
      />
    </View>
  );
}