import { createStackNavigator } from '@react-navigation/stack';
import { useWindowDimensions } from 'react-native';
import HomeScreen from './HomeScreen';
import WorldDetailScreen from './WorldDetailScreen';
import WorldListScreen from './WorldListScreen';

const Stack = createStackNavigator();

export default function AppNavigator() {
  const { width } = useWindowDimensions();
  const isDesktop = width >= 900;

  return isDesktop ? (
    <HomeScreen />
  ) : (
    <Stack.Navigator initialRouteName="WorldList" screenOptions={{ headerShown: false }}>
      <Stack.Screen name="WorldList" component={WorldListScreen} />
      <Stack.Screen name="WorldDetail" component={WorldDetailScreen} />
    </Stack.Navigator>
  );
}
