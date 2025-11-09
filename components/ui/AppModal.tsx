import { usePlatform } from "@/contexts/PlatformContext";
import { $, tone, useScale, UseTheme } from "@/theme";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo } from "react";
import {
  BackHandler,
  Dimensions,
  Modal,
  Platform,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { Body, Heading } from "./AppText";
import { Card } from "./ElevatedView";
import { IconButton } from "./IconButton";

type BorderTone = "accent" | "success" | "warning" | "danger";

interface AppModalProps {
  visible: boolean;
  onClose: () => void;
  heading: string;
  body?: string | null;
  disableOutsideClose?: boolean;
  dimColor?: string;
  accentOverlay?: boolean;
  borderTone?: BorderTone;
  width?: number | "auto";
  height?: number | "auto";
  children?: React.ReactNode;
  animateOnDestruction?: boolean;
  /** When enabled, wraps modal content in a Card for gradient/shadow styling without altering padding */
  cardContainer?:
    | boolean
    | {
        toneVariant?: "base" | "accent" | "alt";
        gradient?: boolean;
        shadow?: boolean;
        bordered?: boolean;
        radius?: "sm" | "md" | "lg";
      };
}

export function AppModal({
  visible,
  onClose,
  heading,
  body = null,
  disableOutsideClose = false,
  dimColor,
  borderTone = "accent",
  accentOverlay = false,
  width,
  height,
  animateOnDestruction = false,
  cardContainer = true,
  children,
}: AppModalProps) {
  const { width: screenWidth } = Dimensions.get("window");
  const S = useScale();
  const { theme } = UseTheme();
  const { isMobile } = usePlatform();
  const isWeb = Platform.select({ web: true, default: false }) as boolean;
  // Normalize optional Card config so we can use simple defaults in JSX
  const cardConfig =
    typeof cardContainer === "object" ? cardContainer : undefined;
  const {
    radius: cardRadius = "lg",
    toneVariant: cardToneVariant = "base",
    gradient: cardGradient = true,
    shadow: cardShadow = true,
    bordered: cardBordered = true,
  } = cardConfig ?? {};

  // ✅ Platform-based sizing
  const modalWidth =
    width ?? (isMobile ? screenWidth * 0.9 : Math.min(screenWidth * 0.9, 700));

  // Reanimated shared values for animations
  const fadeProgress = useSharedValue(0);
  const initialTranslateY = isWeb ? -S.space.xxl * 3 : S.space.lg;
  const slideProgress = useSharedValue(initialTranslateY);
  const initialScale = isWeb ? 0.96 : 1;
  const scaleProgress = useSharedValue(initialScale);
  const shakeProgress = useSharedValue(0);

  // Keep modal mounted long enough to play exit animation
  const [rendered, setRendered] = React.useState(visible);

  // Memoized colors with theme dependency
  const overlayColorValue = useMemo(() => {
    if (dimColor) return dimColor
    if (accentOverlay) return tone($("accent", theme), "changeOpacity", undefined, 0.35, theme)
    return "rgba(0, 0, 0, 0.45)"
  }, [dimColor, accentOverlay, theme])

  const surfaceColor = useMemo(() => $("surface"), [])
  const textPrimaryColor = useMemo(() => $("textPrimary"), [])
  const borderColorValue = useMemo(() => 
    borderTone === "success"
      ? $("success")
      : borderTone === "warning"
      ? $("warning")
      : borderTone === "danger"
      ? $("danger")
      : $("accent"),
  [borderTone])

  // 🔹 Fade + slide (+scale on web) entry/exit animation
  useEffect(() => {
    if (visible) {
      // Ensure it's mounted before animating in
      setRendered(true);
      // Reset positions for a fresh entrance
      slideProgress.value = initialTranslateY;
      fadeProgress.value = 0;
      scaleProgress.value = initialScale;
      // ✅ Haptic feedback on open
      if (isMobile) {
        const hapticStyle =
          borderTone === "danger"
            ? Haptics.ImpactFeedbackStyle.Medium
            : Haptics.ImpactFeedbackStyle.Light;
        Haptics.impactAsync(hapticStyle);
      }

      // Start fade + slide in
      fadeProgress.value = withTiming(1, { duration: 250 });
      slideProgress.value = isWeb
        ? withTiming(0, { duration: 280, easing: Easing.out(Easing.cubic) })
        : withSpring(0, { damping: 6 });
      scaleProgress.value = isWeb
        ? withTiming(1, { duration: 280, easing: Easing.out(Easing.cubic) })
        : withTiming(1, { duration: 1 });
    } else {
      // On web, ensure no element inside the soon-to-be-hidden modal retains focus
      if (isWeb) {
        try {
          const ae =
            typeof document !== "undefined"
              ? (document.activeElement as any)
              : null;
          if (ae && typeof ae.blur === "function") ae.blur();
        } catch {}
      }
      // Fade + slide out
      fadeProgress.value = withTiming(0, { duration: 180 });
      slideProgress.value = isWeb
        ? withTiming(initialTranslateY, {
            duration: 220,
            easing: Easing.out(Easing.cubic),
          })
        : withTiming(initialTranslateY, { duration: 200 });
      scaleProgress.value = isWeb
        ? withTiming(initialScale, {
            duration: 200,
            easing: Easing.out(Easing.cubic),
          })
        : withTiming(1, { duration: 1 });

      // After exit animation, unmount
      setTimeout(() => {
        setRendered(false);
      }, 200);
    }
  }, [
    visible,
    isMobile,
    isWeb,
    borderTone,
    initialTranslateY,
    initialScale,
    fadeProgress,
    slideProgress,
    scaleProgress,
  ]);

  // 💥 Optional "panic" shake handled separately to avoid resetting entry animation
  useEffect(() => {
    if (!visible) return;
    if (borderTone !== "danger" || !animateOnDestruction) return;

    // Slight delay so it feels natural
    const timer = setTimeout(() => {
      const shakeSequence = async () => {
        shakeProgress.value = withTiming(-10, { duration: 80 });
        await new Promise((r) => setTimeout(r, 80));
        shakeProgress.value = withTiming(10, { duration: 80 });
        await new Promise((r) => setTimeout(r, 80));
        shakeProgress.value = withTiming(-6, { duration: 60 });
        await new Promise((r) => setTimeout(r, 60));
        shakeProgress.value = withTiming(6, { duration: 60 });
        await new Promise((r) => setTimeout(r, 60));
        shakeProgress.value = withTiming(0, { duration: 50 });
      };

      shakeSequence();

      if (isMobile) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [visible, animateOnDestruction, borderTone, isMobile, shakeProgress]);

  const handleOutsidePress = () => {
    if (!disableOutsideClose) onClose();
  };

  // Animated style for the modal container
  const animatedContainerStyle = useAnimatedStyle(() => ({
    opacity: fadeProgress.value,
    transform: [
      { translateY: slideProgress.value },
      { scale: scaleProgress.value },
      { translateX: shakeProgress.value },
    ],
  }));

  // 🔹 Hardware back + Escape key
  useEffect(() => {
    if (!visible) return;

    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };

    const handleBackPress = () => {
      onClose();
      return true;
    };

    document?.addEventListener?.("keydown", handleKeyPress);
    const backSub = BackHandler.addEventListener(
      "hardwareBackPress",
      handleBackPress
    );

    return () => {
      document?.removeEventListener?.("keydown", handleKeyPress);
      backSub?.remove();
    };
  }, [visible, onClose]);

  if (!rendered) return null;

  return (
    <Modal transparent visible={rendered} animationType="none">
      <TouchableOpacity
        activeOpacity={1}
        onPress={handleOutsidePress}
        style={[styles.backdrop, { backgroundColor: overlayColorValue }]}
      >
        <View style={styles.center}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <Animated.View
              style={[
                styles.modalContainer,
                animatedContainerStyle,
                cardContainer
                  ? { width: modalWidth, height: height ?? "auto" }
                  : { width: modalWidth, height: height ?? "auto" },
              ]}
            >
              <TouchableOpacity
                activeOpacity={1}
                onPress={(e) => e.stopPropagation()}
              >
                {cardContainer ? (
                  <Card
                    radius={cardRadius}
                    toneVariant={cardToneVariant}
                    gradient={cardGradient}
                    shadow={cardShadow}
                    bordered={cardBordered}
                    padded={false}
                  >
                    <View
                      style={[
                        styles.closeButton,
                        { top: S.space.sm, right: S.space.sm },
                      ]}
                    >
                      <IconButton
                        variant="text"
                        content="✕"
                        textColor={textPrimaryColor}
                        onPress={onClose}
                      />
                    </View>
                    <View style={{ padding: S.space.lg }}>
                      <Heading
                        align="center"
                        style={{ marginBottom: body ? S.space.sm : S.space.md }}
                      >
                        {heading}
                      </Heading>
                      {body && (
                        <Body
                          align="center"
                          style={{ marginBottom: children ? S.space.md : 0 }}
                        >
                          {body}
                        </Body>
                      )}
                      {children}
                    </View>
                  </Card>
                ) : (
                  <View
                    style={{
                      backgroundColor: surfaceColor,
                      borderRadius: S.radius.lg,
                      padding: S.space.lg,
                      borderColor: borderColorValue,
                      borderWidth: 2,
                    }}
                  >
                    <View
                      style={[
                        styles.closeButton,
                        { top: S.space.sm, right: S.space.sm },
                      ]}
                    >
                      <IconButton
                        variant="text"
                        content="✕"
                        textColor={textPrimaryColor}
                        onPress={onClose}
                      />
                    </View>
                    <Heading
                      align="center"
                      style={{ marginBottom: body ? S.space.sm : S.space.md }}
                    >
                      {heading}
                    </Heading>
                    {body && (
                      <Body
                        align="center"
                        style={{ marginBottom: children ? S.space.md : 0 }}
                      >
                        {body}
                      </Body>
                    )}
                    {children}
                  </View>
                )}
              </TouchableOpacity>
            </Animated.View>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  safetyZone: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    margin: 20,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  modalContainer: {
    borderWidth: 2,
    // Note: shadow styles are applied inline via getShadowStyle() in component
  },
  closeButton: {
    position: "absolute",
    zIndex: 10,
  },
});
