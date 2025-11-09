import { $, useScale, UseTheme } from "@/theme";
import * as Haptics from "expo-haptics";
import React, { useState } from "react";
import { Pressable, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
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
  const [contentHeight, setContentHeight] = useState(0);
  
  // Reanimated shared values
  const progress = useSharedValue(defaultOpen ? 1 : 0);

  const toggle = () => {
    setOpen((prev) => !prev);
    Haptics.selectionAsync();
    progress.value = withSpring(open ? 0 : 1, { damping: 80 });
  };

  // Animated style for expandable content
  const animatedContentStyle = useAnimatedStyle(() => ({
    height: progress.value * (contentHeight + 50), // content height + 50px padding
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

      {/* Combined Animated.View + inner View */}
      <Animated.View
        style={[
          {
            overflow: "hidden",
            paddingHorizontal: S.space.md,
            paddingBottom: open ? S.space.md : 0,
          },
          animatedContentStyle,
        ]}
      >
        <View
          onLayout={(event) => {
            const measuredHeight = event.nativeEvent.layout.height;
            if (measuredHeight > 0 && measuredHeight !== contentHeight) {
              setContentHeight(measuredHeight);
            }
          }}
        >
          {children}
        </View>
      </Animated.View>
    </View>
  );
}
