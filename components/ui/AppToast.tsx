import { useScale } from "@/theme";
import { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Body } from "./AppText";
import { ComponentView } from "./Resuables/ComponentViews";

type ToastType = "info" | "success" | "error" | "warning";

interface AppToastProps {
  message: string;
  type?: ToastType;
  visible?: boolean;
  duration?: number; // ms
  onHide?: () => void;
}

/**
 * 🪶 AppToast
 * Appears temporarily, fades/slides up, auto-dismisses.
 * Uses ComponentView for consistent styling across all toast types.
 */
export function AppToast({
  message,
  type = "info",
  visible = false,
  duration = 2500,
  onHide,
}: AppToastProps) {
  const S = useScale();
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(-30);

  // Map toast type to borderTone
  const borderTone =
    type === "success"
      ? "success"
      : type === "error"
      ? "danger"
      : type === "warning"
      ? "warning"
      : "info";

  useEffect(() => {
    if (visible) {
      // Animate in: fade + slide down from top
      opacity.value = withTiming(1, { duration: 200 });
      translateY.value = withTiming(0, { duration: 200 });

      const timeout = setTimeout(() => {
        // Animate out: fade + slide up (reverse)
        opacity.value = withTiming(0, { duration: 200 });
        translateY.value = withTiming(-30, { duration: 200 }, () => {
          if (onHide) onHide();
        });
      }, duration);
      return () => clearTimeout(timeout);
    } else {
      // Reset to initial state when not visible
      opacity.value = 0;
      translateY.value = -30;
    }
  }, [visible, duration, onHide, opacity, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View
      style={[
        styles.container,
        { top: S.space.xl, right: S.space.xl },
        animatedStyle,
      ]}
    >
      <ComponentView
        borderTone={borderTone as "success" | "danger" | "warning" | "info"}
        shadow="softer"
        gradient={true}
        gradientIntensity={35}
        gradientTransitionPoint={65}
        gradientDirection={165}
      >
        <Body align="center">{message}</Body>
      </ComponentView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    zIndex: 9999,
  },
});
