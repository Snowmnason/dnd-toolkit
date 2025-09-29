import { useThemeColor } from "@/hooks/use-theme-color";
import React from "react";
import { View, type ViewProps } from "react-native";
import ParchmentBackground from "./ParchmentBackground";

export type ThemedViewProps = ViewProps & {
  parchment?: boolean;
};

export function ThemedView({
  style,
  children,
  parchment = true,
  ...rest
}: ThemedViewProps) {
  const backgroundColor = useThemeColor({}, "background");

  return (
    <View style={[{ backgroundColor }, style]} {...rest}>
      {/* Background noise, painted underneath */}
      {parchment && <ParchmentBackground />}

      {/* Children stack above */}
      {children}
    </View>
  );
}
