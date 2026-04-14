import { logger } from "@/hooks/utils";
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";

export default function MainLayout() {
  const params = useLocalSearchParams();

  // All hooks must be called unconditionally (before any conditional returns)
  useEffect(() => {
    logger.category("navigation").info("[MainLayout] Rendering with params", {
      worldId: params.worldId,
      userRole: params.userRole,
    });
  }, [params.worldId, params.userRole]);

  // Validate world access on mount and when worldId changes
  useEffect(() => {
    const urlWorldId =
      typeof params.worldId === "string" ? params.worldId : undefined;

    // If no worldId in URL, redirect
    if (!urlWorldId) {
      logger.category("navigation").warn(
        "[MainLayout] No worldId in URL, redirecting to world selection",
      );
      return;
    }

    logger.category("navigation").debug("[MainLayout] Rendering world screen", {
      urlWorldId,
    });
  }, [params.worldId]);

  // Always render content - UIBlockerLayer handles loading overlay with splash screen
  return (
    <View style={{ flex: 1 }}>
      {/* Stack for main routes and nested navigation */}
      <Stack screenOptions={{ headerShown: false }} />
    </View>
  );
}
