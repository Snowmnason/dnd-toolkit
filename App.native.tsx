import { NavigationContainer } from "@react-navigation/native";
import React from "react";
import AppLoader from "./src/AppLoader";
import MobileNavigator from "./src/navigators/MobileNavigator";

export default function App() {
  return (
    <AppLoader onReady={async () => {
      // Mobile-only initialization (if any)
    }}>
      <NavigationContainer>
        <MobileNavigator />
      </NavigationContainer>
    </AppLoader>
  );
}
