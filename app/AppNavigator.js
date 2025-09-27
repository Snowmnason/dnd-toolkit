import { createStackNavigator } from '@react-navigation/stack';
import { useWindowDimensions } from 'react-native';
import CreateWorldScreen from './homescreen/CreateWorldScreen';
import HomeScreen from './homescreen/Desktop/HomeScreen';
import WorldDetailScreen from './homescreen/Moblie/WorldDetailScreen';
import WorldListScreen from './homescreen/Moblie/WorldListScreen';
import MainScreen from './MainScreens/MainScreen';

const Stack = createStackNavigator();

function DesktopNavigator() {
  return (
    <Stack.Navigator initialRouteName="Home" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="CreateWorld" component={CreateWorldScreen} />
      <Stack.Screen name="Main" component={MainScreen} />
    </Stack.Navigator>
  );
}

function MobileNavigator() {
  return (
    <Stack.Navigator initialRouteName="WorldList" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="WorldList" component={WorldListScreen} />
      <Stack.Screen name="WorldDetail" component={WorldDetailScreen} />
      <Stack.Screen name="CreateWorld" component={CreateWorldScreen} />
      <Stack.Screen name="Main" component={MainScreen} />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;
  return isDesktop ? <DesktopNavigator /> : <MobileNavigator />;
}
