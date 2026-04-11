import { useChromeBottom } from "@/hooks";
import { logger } from "@/hooks/utils";
import { Stack, useLocalSearchParams } from "expo-router";
import { useEffect } from "react";
import { View } from "react-native";

export default function MainLayout() {
  const params = useLocalSearchParams();

  // Bottom bar behavior is now owned by dedicated hook
  // TODO: Connect to ChromeLayer via parent compositor in Phase 1B
  useChromeBottom();

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

      {/* 
        🔄 PHASE 1: ChromeBottomBar rendering removed from layout.
        ChromeLayer.tsx is now the single owner/renderer of all chrome components.
        Bottom bar behavior is managed by useChromeBottom() hook above.
        
        TODO: Connect chromeBottom to ChromeLayer via parent compositor.
      */}
    </View>
  );
}
