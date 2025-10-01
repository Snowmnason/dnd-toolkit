import { useThemeColor } from "@/hooks/use-theme-color";
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
  showParchment = true,
  defaultFlex = 1,
  ...otherProps
}: ThemedViewProps) {
  const backgroundColor = useThemeColor(
    { light: lightColor, dark: darkColor }, 
    'background'
  );

  return (
    <View 
      style={[
        { 
          flex: defaultFlex ? defaultFlex : undefined,
          backgroundColor: showParchment ? 'transparent' : backgroundColor 
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
