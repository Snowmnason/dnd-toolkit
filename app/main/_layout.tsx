import { logger } from "@/hooks/utils";
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";

export default function MainLayout() {
  const params = useLocalSearchParams();

  // Route protection for /main/* is handled globally:
  // - Web initial load: useBootstrapRouteGuard (app/_layout.tsx)
  // - Runtime in-memory nav: useRouteChangeObserver (app/_layout.tsx)
  // No guard needed here.

  // All hooks must be called unconditionally (before any conditional returns)
  useEffect(() => {
    logger.category("navigation").info("[MainLayout] Rendering with params", {
      worldId: params.worldId,
      userRole: params.userRole,
    });
  }, [params.worldId, params.userRole]);

  // Always render content - UIBlockerLayer handles loading overlay with splash screen
  return (
    <View style={{ flex: 1 }}>
      {/* Stack for main routes and nested navigation */}
      <Stack screenOptions={{ headerShown: false }} />
    </View>
  );
}
