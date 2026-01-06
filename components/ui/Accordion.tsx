import { $, useScale, UseTheme } from "@/theme";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import { Platform, Pressable, View } from "react-native";
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
}

/**
 * 🗂 Accordion
 * Expand/collapse container for notes or detail sections.
 */
export function Accordion({
  title,
  children,
  defaultOpen = false,
  bordered = true,
}: AccordionProps) {
  const S = useScale();
  const { theme } = UseTheme();
  const [open, setOpen] = useState(defaultOpen);
  // Content height (measured) and progress as shared values for smooth UI-thread animation
  const measuredHeight = useSharedValue(0);
  const progress = useSharedValue(defaultOpen ? 1 : 0);

  const toggle = () => {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (Platform.OS !== 'web') {
      Haptics.selectionAsync();
    }
    progress.value = withTiming(nextOpen ? 1 : 0, {
      duration: nextOpen ? 250 : 200,
      easing: Easing.out(Easing.cubic),
    });
  };

  // Animated style for expandable content
  const animatedContentStyle = useAnimatedStyle(() => ({
    height: progress.value * measuredHeight.value,
    opacity: progress.value,
  }));

  return (
    <View
      style={{
        marginBottom: S.space.md,
        borderWidth: bordered ? 1 : 0,
        borderColor: bordered ? $("borderSubtle" as any) : "transparent",
        borderRadius: S.radius.md,
        backgroundColor: $("surfaceAlt" as any, theme),
        overflow: "hidden",
      }}
    >
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
        <Body style={{ color: $("accent", theme) }}>{open ? "−" : "+"}</Body>
      </Pressable>

      {/* Hidden measuring container to get stable height on mobile */}
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

      {/* Animated visible content */}
      <Animated.View
        style={[
          { 
            overflow: 'hidden',
            pointerEvents: open ? 'auto' : 'none',
          },
          animatedContentStyle,
        ]}
      >
        <View style={{ paddingHorizontal: S.space.md, paddingBottom: S.space.md }}>
          {children}
        </View>
      </Animated.View>
    </View>
  );
}
