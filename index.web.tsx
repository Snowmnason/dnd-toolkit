import "@expo/metro-runtime";
import { App } from "expo-router/build/qualified-entry";
import { renderRootComponent } from "expo-router/build/renderRootComponent";
import { LoadSkiaWeb } from "@shopify/react-native-skia/lib/module/web";

// Wait for Skia to load before rendering Router
LoadSkiaWeb({
  locateFile: (file) => `/${file}`, // since wasm is in /public
}).then(() => {
  console.log("✅ Skia fully loaded (web)");
  renderRootComponent(App);
});
