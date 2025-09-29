import { NavigationContainer } from "@react-navigation/native";
import { LoadSkiaWeb } from "@shopify/react-native-skia/lib/module/web";
import React from "react";
import AppLoader from "./src/AppLoader";
import DesktopNavigator from "./src/navigators/DesktopNavigator";

export default function App() {
  return (
    <AppLoader
      onReady={async () => {
        // Point Skia to where your wasm lives (you said: web/static/js)
        await LoadSkiaWeb({
          locateFile: (file) => `/${file}`,  // resolves to /canvaskit.wasm
        });
      }}
    >
      <NavigationContainer>
        <DesktopNavigator />
      </NavigationContainer>
    </AppLoader>
  );
}


