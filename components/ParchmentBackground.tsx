// components/ParchmentBackground.tsx
import { useThemeColor } from "@/hooks/use-theme-color";
import { Canvas, Rect, Turbulence } from "@shopify/react-native-skia";
import React from "react";
import { StyleSheet, useWindowDimensions } from "react-native";

export default function ParchmentBackground() {
  // Full-screen canvas dimensions (works on web + native)
  const { width, height } = useWindowDimensions();

  // Theme-driven tints
  const paperColor = useThemeColor({}, "agedPaper");
  //const inkColor = useThemeColor({}, "inkStains");
  const backgroundColor = useThemeColor({}, "background");

  return (
    <Canvas style={StyleSheet.absoluteFill}>
      {/* Layer 1: subtle paper grain */}
      <Rect x={0} y={0} width={width} height={height}>
        <Turbulence freqX={1.12} freqY={.10} octaves={8} seed={42} />
      </Rect>
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        color={backgroundColor} // wheat-like base
        opacity={1}
        blendMode="color"

      />
      <Rect x={0} y={0} width={width} height={height}>
        <Turbulence freqX={0.02} freqY={0.02} octaves={8} seed={53} />
      </Rect>
      <Rect
        x={0}
        y={0}
        width={width}
        height={height}
        color={paperColor} // wheat-like base
        opacity={1}
        blendMode="color"
      />
    </Canvas>
  );
}
