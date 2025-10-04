// components/ParchmentBackground.tsx
import { Canvas, Rect, Turbulence } from "@shopify/react-native-skia";
import React from "react";
import { Platform, StyleSheet, useWindowDimensions, View } from "react-native";

export default function ParchmentBackground() {
  const { width, height } = useWindowDimensions();
  const [skiaReady, setSkiaReady] = React.useState(Platform.OS !== 'web');
  const paperColor = '#f4e1b5';
  const backgroundColor = '#a77e44ff';

  // Generate random seeds for unique parchment texture on each page
  const seed1 = React.useMemo(() => Math.floor(Math.random() * 1000), []);
  const seed2 = React.useMemo(() => Math.floor(Math.random() * 1000), []);

  React.useEffect(() => {
    if (Platform.OS === 'web') {
      // Check the global Skia ready flag set by index.tsx
      const checkSkiaReady = () => {
        const skiaStatus = (window as any).SkiaReady;
        if (skiaStatus === true) {
          setSkiaReady(true);
        } else if (skiaStatus === 'error') {
          setSkiaReady(false); // Use fallback
        } else {
          // Still loading, check again
          setTimeout(checkSkiaReady, 100);
        }
      };
      checkSkiaReady();
    }
  }, []);

  // Fallback for when Skia is not ready or failed to load
  if (!skiaReady) {
    return (
      <View 
        style={[
          StyleSheet.absoluteFill, 
          { 
            backgroundColor: '#2f353d',
            // CSS fallback with a subtle texture pattern
            opacity: 0.9,
          }
        ]} 
      />
    );
  }

  return (
    <Canvas style={StyleSheet.absoluteFill}>
      <Rect x={0} y={0} width={width} height={height}>
        <Turbulence freqX={1.12} freqY={0.10} octaves={8} seed={seed1} />
      </Rect>
      <Rect x={0} y={0} width={width} height={height} color={backgroundColor} opacity={1} blendMode="color" />
      <Rect x={0} y={0} width={width} height={height}>
        <Turbulence freqX={0.02} freqY={0.02} octaves={8} seed={seed2} />
      </Rect>
      <Rect x={0} y={0} width={width} height={height} color={paperColor} opacity={1} blendMode="color" />
    </Canvas>
  );
}
