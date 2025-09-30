import { Stack } from 'expo-router';
import { View } from 'react-native';
import TopBar from '../../components/TopBar';
//import { View } from '../../components/themed-view';

export default function SelectLayout() {
  return (
    <View style={{ flex: 1, backgroundColor: "#2f353d" }}>
      <TopBar 
        title="Select World" 
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