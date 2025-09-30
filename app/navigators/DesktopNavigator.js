import { createStackNavigator } from '@react-navigation/stack';
import CreateWorldScreen from '../landing/CreateWorldScreen';
import HomeScreen from '../landing/LandingDesktop';
import MainScreen from '../MainScreens/MainScreenDesktop';

const Stack = createStackNavigator();

export default function DesktopNavigator() {
  return (
    <Stack.Navigator initialRouteName="Home" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="Home" component={HomeScreen} />
      <Stack.Screen name="CreateWorld" component={CreateWorldScreen} />
      <Stack.Screen name="Main" component={MainScreen} />
    </Stack.Navigator>
  );
}
