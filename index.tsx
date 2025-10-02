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
          // Web/Desktop: Load Skia with error handling
          try {
            console.log('🔄 Attempting to load Skia for web...');
            const { LoadSkiaWeb } = await import("@shopify/react-native-skia/lib/module/web");
            await LoadSkiaWeb({
              locateFile: (file) => `/${file}`, // since wasm is in /public
            });
            console.log("✅ Skia (CanvasKit) fully loaded for web");
          } catch (error) {
            console.warn("⚠️  Skia loading failed (non-critical):", error);
            // Don't throw - app can work without Skia canvas features
          }
        } else {
          // Mobile: No Skia loading needed
          console.log("✅ App ready (mobile platform)");
        }
      }}
    >
      <App />
    </AppLoader>
  );
}

renderRootComponent(AppWithLoader);