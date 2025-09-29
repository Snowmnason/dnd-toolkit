import { createStackNavigator } from '@react-navigation/stack';
import CreateWorldScreen from '../landing/CreateWorldScreen';
import WorldListScreen from '../landing/LandingMoblie';
import MainScreen from '../MainScreens/MainScreenDesktop';

const Stack = createStackNavigator();

export default function MobileNavigator() {
  return (
    <Stack.Navigator initialRouteName="WorldList" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="WorldList" component={WorldListScreen} />
      <Stack.Screen name="CreateWorld" component={CreateWorldScreen} />
      <Stack.Screen name="Main" component={MainScreen} />
    </Stack.Navigator>
  );
}
