import { $, useScale } from "@/theme";
import * as Haptics from "expo-haptics";
import React, { useEffect, useMemo, useState } from "react";
import {
  LayoutChangeEvent,
  Platform,
  Pressable,
  ScrollView,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Body } from "./AppText";

interface TabItem {
  key: string;
  label: string;
}

interface TabsProps {
  tabs: TabItem[];
  defaultActive?: string;
  onChange?: (key: string) => void;
  fullWidth?: boolean;
  bottomSpace?: boolean; // Add space below tabs for content separation
}

/**
 * 🧭 Tabs
 * Simple tab bar with animated underline and theme-aware tones.
 */
export function Tabs({
  tabs,
  defaultActive,
  onChange,
  fullWidth = false,
  bottomSpace = true,
}: TabsProps) {
  const S = useScale();
  const [active, setActive] = useState(defaultActive ?? tabs[0]?.key);
  const scrollViewRef = React.useRef<ScrollView>(null);
  const [isScrollable, setIsScrollable] = useState(false);

  // Memoized colors with theme dependency
  const borderColor = useMemo(() => $("borderSubtle" as any), []);
  const backgroundGradient = useMemo(() => $("background"), []);
  const accentColor = useMemo(() => $("accent"), []);
  const textSecondaryColor = useMemo(() => $("textSecondary"), []);

  // Track tab positions for underline animation using Reanimated
  const [tabLayouts, setTabLayouts] = useState<
    Record<string, LayoutChangeEvent>
  >({});
  const underlineX = useSharedValue(0);
  const underlineWidth = useSharedValue(0);

  useEffect(() => {
    onChange?.(active);
  }, [active, onChange]);

  // Check if content is scrollable and enable horizontal mouse wheel scrolling on web
  useEffect(() => {
    if (Platform.OS !== "web") return;

    let scrollElement: HTMLElement | null = null;

    const checkScrollable = () => {
      if (scrollElement) {
        const hasOverflow =
          scrollElement.scrollWidth > scrollElement.clientWidth;
        setIsScrollable(hasOverflow);
      }
    };

    const handleWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) > 0 && scrollElement && isScrollable) {
        e.preventDefault();
        // Scroll horizontally based on vertical wheel movement
        scrollElement.scrollLeft += e.deltaY;
      }
    };

    // Wait a tick for the ref to be attached
    const timer = setTimeout(() => {
      scrollElement = (
        scrollViewRef.current as any
      )?.getScrollableNode?.() as HTMLElement;
      if (scrollElement) {
        checkScrollable();
        scrollElement.addEventListener("wheel", handleWheel, {
          passive: false,
        });
        // Recheck on resize
        window.addEventListener("resize", checkScrollable);
      }
    }, 0);

    return () => {
      clearTimeout(timer);
      if (scrollElement) {
        scrollElement.removeEventListener("wheel", handleWheel);
        window.removeEventListener("resize", checkScrollable);
      }
    };
  }, [isScrollable]);

  // Animate underline when active tab changes using Reanimated
  useEffect(() => {
    const activeLayout = tabLayouts[active];
    if (activeLayout) {
      underlineX.value = withTiming(activeLayout.nativeEvent.layout.x, {
        duration: 300,
      });
      underlineWidth.value = withTiming(activeLayout.nativeEvent.layout.width, {
        duration: 300,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, tabLayouts]);

  // Animated style for underline
  const underlineAnimatedStyle = useAnimatedStyle(() => ({
    left: underlineX.value,
    width: underlineWidth.value,
  }));

  const handleLayout = (key: string, e: LayoutChangeEvent) => {
    setTabLayouts((prev) => ({ ...prev, [key]: e }));
  };

  return (
    <View
      style={{
        width: "100%",
        position: "relative",
        borderWidth: 0,
      }}
    >
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        scrollEventThrottle={16}
        contentContainerStyle={{
          flexDirection: "row",
          justifyContent: fullWidth ? "space-around" : "flex-start",
          flexGrow: fullWidth ? 1 : 0,
        }}
      >
        {tabs.map((tab) => {
          const isActive = active === tab.key;
          return (
            <Pressable
              key={tab.key}
              onPress={() => {
                if (Platform.OS === "ios" || Platform.OS === "android") {
                  Haptics.selectionAsync();
                }
                setActive(tab.key);
              }}
              onLayout={(e) => handleLayout(tab.key, e)}
              style={{
                paddingVertical: S.space.sm,
                paddingHorizontal: S.space.md,
                borderRightWidth: 3,
                borderRightColor: isActive ? borderColor : "transparent",
                borderLeftWidth: 3,
                borderLeftColor: isActive ? borderColor : "transparent",
                borderTopWidth: 3,
                borderTopColor: isActive ? borderColor : "transparent",
                borderRadius: 6,
                backgroundColor: isActive ? backgroundGradient : "transparent",
              }}
            >
              <View>
                <Body
                  style={{
                    color: isActive ? accentColor : textSecondaryColor,
                    fontWeight: isActive ? "600" : "400",
                  }}
                >
                  {tab.label}
                </Body>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      {/* Animated underline indicator */}
      <Animated.View
        style={[
          {
            position: "absolute",
            bottom: 0,
            height: 2,
            backgroundColor: accentColor,
            borderRadius: 1,
          },
          underlineAnimatedStyle,
        ]}
      />
    </View>
  );
}
