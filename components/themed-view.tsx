import { useTheme } from "@/contexts/ThemeContext";
import React from "react";
import { View, type ViewProps } from "react-native";
import ParchmentBackground from "./ParchmentBackground";

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
  showParchment?: boolean;
  defaultFlex?: number;
};

/**
 * Themed view component with optional parchment background
 * Set showParchment={true} to include the parchment texture
 */
export function ThemedView({
  style,
  lightColor,
  darkColor,
  showParchment = false,
  defaultFlex = 1,
  ...otherProps
}: ThemedViewProps) {
  const { theme, isDark } = useTheme();

  // Determine background color priority:
  // 1) If light/dark override provided, use the appropriate one based on current theme
  // 2) Otherwise, use themed background (prefer the darker app backdrop by default)
  const backgroundColor =
    lightColor || darkColor
      ? (isDark ? (darkColor ?? lightColor) : (lightColor ?? darkColor))
      : (isDark ? theme.colors.backgroundDark : theme.colors.backgroundLight);

  return (
    <View 
      style={[
        { 
          flex: defaultFlex ? defaultFlex : undefined,
          backgroundColor: backgroundColor
        }, 
        style
      ]} 
      {...otherProps} 
    >
      {showParchment && <ParchmentBackground />}
      {otherProps.children}
    </View>
  );
}
