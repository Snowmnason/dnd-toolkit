import "@expo/metro-runtime";
import { App } from "expo-router/build/qualified-entry";
import { renderRootComponent } from "expo-router/build/renderRootComponent";
import React from "react";
import { Platform } from "react-native";
import { logger } from "./lib/utils/logger";

// Ensure the initial page background is dark immediately on web to avoid white flash
if (Platform.OS === "web") {
  try {
    if (typeof document !== "undefined") {
      document.documentElement.style.backgroundColor = "#2f353d";
      if (document.body) {
        document.body.style.backgroundColor = "#2f353d";
      }
    }
  } catch {}
}

renderRootComponent(App);
