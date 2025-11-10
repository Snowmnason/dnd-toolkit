import { useScale } from "@/theme";
import React, { useRef, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Card } from "./ElevatedView";

import { SubTitle } from "./AppText";

interface AppTooltipProps {
  text: string;
  delay?: number;
  /** Enable long-press tooltip on mobile */
  enableMobilePress?: boolean;
  children: React.ReactNode;
}

/**
 * 💬 AppTooltip
 * Cross-platform tooltip:
 * - Web: hover to show
 * - Mobile: press-hold to show (if enableMobilePress=true)
 * Uses ComponentView for consistent styling and Reanimated for animations.
 */
export function AppTooltip({
  text,
  delay = 500,
  enableMobilePress = true,
  children,
}: AppTooltipProps) {
  const S = useScale();
  const [visible, setVisible] = useState(false);
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(6);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = () => {
    // Clear any existing timers
    if (timerRef.current) clearTimeout(timerRef.current);
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);

    timerRef.current = setTimeout(() => {
      setVisible(true);
      opacity.value = withTiming(1, { duration: 200 });
      translateY.value = withTiming(0, { duration: 200 });
    }, delay);
  };

  const hide = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);

    opacity.value = withTiming(0, { duration: 150 });
    translateY.value = withTiming(6, { duration: 150 }, () => {
      setVisible(false);
    });
  };

  // Mobile: show tooltip on long press (after 500ms hold)
  const handlePressIn = () => {
    if (Platform.OS === "web" || !enableMobilePress) return;

    pressTimerRef.current = setTimeout(() => {
      show();
    }, 300); // Trigger after 300ms hold
  };

  const handlePressOut = () => {
    if (Platform.OS === "web" || !enableMobilePress) return;

    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current);
    }
    // Keep showing for a moment before hiding
    setTimeout(() => {
      hide();
    }, 1500);
  };

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const styles = React.useMemo(
    () =>
      StyleSheet.create({
        container: {
          position: "relative",
        },
        tooltipWrapper: {
          position: "absolute",
          bottom: "100%",
          left: "50%",
          transform: [{ translateX: -50 }],
          marginBottom: S.space.xs,
          zIndex: 100,
          // Ensure tooltip content doesn't get clipped
          pointerEvents: "none",
        },
      }),
    [S]
  );

  return (
    <Pressable
      onHoverIn={Platform.OS === "web" ? show : undefined}
      onHoverOut={Platform.OS === "web" ? hide : undefined}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={styles.container}
    >
      <View>
        {children}
        {visible && (
          <Animated.View style={[styles.tooltipWrapper, animatedStyle]}>
            <Card padding="xs">
              <SubTitle textType="primary" align="center">
                {text}
              </SubTitle>
            </Card>
          </Animated.View>
        )}
      </View>
    </Pressable>
  );
}
