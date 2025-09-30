import "@expo/metro-runtime";
import { App } from "expo-router/build/qualified-entry";
import { renderRootComponent } from "expo-router/build/renderRootComponent";
import React from "react";
import { Platform } from "react-native";
import AppLoader from "./app/AppLoader";

// Create a wrapper component that includes AppLoader
function AppWithLoader() {
  return (
    <AppLoader
      onReady={async () => {
        // Platform-specific initialization
        if (Platform.OS === 'web') {
          // Web/Desktop: Load Skia
          try {
            const { LoadSkiaWeb } = await import("@shopify/react-native-skia/lib/module/web");
            await LoadSkiaWeb({
              locateFile: (file) => `/${file}`, // since wasm is in /public
            });
            console.log("✅ Skia (CanvasKit) fully loaded for web");
          } catch (error) {
            console.error("❌ Failed to load Skia for web:", error);
          }
        } else {
          // Mobile: No Skia loading needed
          console.log("✅ App ready (mobile)");
        }
      }}
    >
      <App />
    </AppLoader>
  );
}

renderRootComponent(AppWithLoader);