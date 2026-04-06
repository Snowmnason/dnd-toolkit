import { $, useScale, UseTheme } from "@/theme";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
import { Platform, Pressable, StyleProp, View, ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Body, ObjHeading } from "./AppText";

interface AccordionProps {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
  bordered?: boolean;
  /**
   * Controlled open state. When provided the component is fully controlled —
   * internal state is ignored and `onToggle` is called instead.
   */
  open?: boolean;
  /** Must be provided when using `open` (controlled mode). */
  onToggle?: () => void;
  /**
   * When true, the content area renders above the header rather than below.
   * Use for bottom-anchored panels so the accordion expands upward.
   */
  reversed?: boolean;
  /** Style applied to the outermost container View. */
  style?: StyleProp<ViewStyle>;
  /** Optional element rendered in place of the default +/− indicator. */
  headerRight?: React.ReactNode;
}

/**
 * 🗂 Accordion
 * Expand/collapse container for notes or detail sections.
 *
 * Supports controlled mode via `open` + `onToggle`, and upward expansion
 * via `reversed` (content renders above the header).
 */
export function Accordion({
  title,
  children,
  defaultOpen = false,
  bordered = true,
  open: controlledOpen,
  onToggle,
  reversed = false,
  style,
  headerRight,
}: AccordionProps) {
  const S = useScale();
  const { theme } = UseTheme();

  const isControlled = controlledOpen !== undefined;
  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isOpen = isControlled ? controlledOpen! : internalOpen;

  const measuredHeight = useSharedValue(0);
  const progress = useSharedValue(isOpen ? 1 : 0);

  // Sync animation when controlled `open` prop changes externally
  // Use useEffect to avoid updating shared values during render (Reanimated strict mode)
  useEffect(() => {
    progress.value = withTiming(isOpen ? 1 : 0, {
      duration: isOpen ? 250 : 200,
      easing: Easing.out(Easing.cubic),
    });
  }, [isOpen, progress]);

  const toggle = () => {
    if (isControlled) {
      onToggle?.();
    } else {
      const next = !internalOpen;
      setInternalOpen(next);
      if (Platform.OS !== 'web') Haptics.selectionAsync();
      progress.value = withTiming(next ? 1 : 0, {
        duration: next ? 250 : 200,
        easing: Easing.out(Easing.cubic),
      });
    }
  };

  const animatedContentStyle = useAnimatedStyle(() => ({
    height: progress.value * measuredHeight.value,
    opacity: progress.value,
  }));

  const header = (
    <Pressable
      onPress={toggle}
      style={{
        paddingVertical: S.space.sm,
        paddingHorizontal: S.space.md,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
      }}
    >
      <ObjHeading>{title}</ObjHeading>
      {headerRight ?? (
        <Body style={{ color: $("accent", theme) }}>{isOpen ? "−" : "+"}</Body>
      )}
    </Pressable>
  );

  // Hidden measuring container — always absolute so render order doesn't matter
  const measuringContainer = (
    <View
      style={{
        position: 'absolute',
        opacity: 0,
        pointerEvents: 'none',
        left: 0,
        right: 0,
        zIndex: -1,
      }}
    >
      <View
        style={{ paddingHorizontal: S.space.md, paddingBottom: S.space.md }}
        onLayout={(event) => {
          const h = event.nativeEvent.layout.height;
          if (h > 0 && h !== measuredHeight.value) {
            measuredHeight.value = h;
          }
        }}
      >
        {children}
      </View>
    </View>
  );

  const animatedContent = (
    <Animated.View
      style={[
        {
          overflow: 'hidden',
          pointerEvents: isOpen ? 'auto' : 'none',
        },
        animatedContentStyle,
      ]}
    >
      <View style={{ paddingHorizontal: S.space.md, paddingBottom: S.space.md }}>
        {children}
      </View>
    </Animated.View>
  );

  return (
    <View
      style={[
        {
          marginBottom: S.space.md,
          borderWidth: bordered ? 1 : 0,
          borderColor: bordered ? $("borderSubtle" as any) : "transparent",
          borderRadius: S.radius.md,
          backgroundColor: $("surfaceAlt" as any),
          overflow: "hidden",
        },
        style,
      ]}
    >
      {/* When reversed: content above header (panel expands upward from bottom anchor) */}
      {reversed ? animatedContent : header}
      {measuringContainer}
      {reversed ? header : animatedContent}
    </View>
  );
}
