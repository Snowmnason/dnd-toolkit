import { useColorScheme } from '@/hooks/use-color-scheme';
import { Tabs } from 'expo-router';
import React from 'react';

export default function TabLayout() {
  const colorScheme = useColorScheme();

  return (
<Tabs
  screenOptions={{
    tabBarStyle: { display: 'none' }, // Hides bottom tab bar
    headerShown: false,
  }}
>
  <Tabs.Screen name="index" />
  <Tabs.Screen name="WorldDashboard" />
  <Tabs.Screen name="MapScreen" />
</Tabs>
  );
}
