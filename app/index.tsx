import { useRouter } from "expo-router";
import React from "react";
import { ActivityIndicator, View } from "react-native";

export default function HomePage() {
  const router = useRouter();

  // Auto-redirect to world selection page with a small delay to ensure router is ready
  React.useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/landing/world-selection');
    }, 100); // Small delay to ensure router is mounted

    return () => clearTimeout(timer);
  }, [router]);

  // Show loading spinner while navigating
  return (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#8B4513' }}>
      <ActivityIndicator size="large" color="#F5E6D3" />
    </View>
  );
}
