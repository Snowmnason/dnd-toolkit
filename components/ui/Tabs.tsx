import { $, useScale, UseTheme } from "@/theme";
import * as Haptics from "expo-haptics";
import React, { useEffect, useState } from "react";
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
import { TabView } from "./Resuables/ComponentViews";

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
  const { theme } = UseTheme();
  const [active, setActive] = useState(defaultActive ?? tabs[0]?.key);
  const scrollViewRef = React.useRef<ScrollView>(null);
  const [isScrollable, setIsScrollable] = useState(false);

  // Track tab positions for underline animation (store layout data, not events)
  const [tabLayouts, setTabLayouts] = useState<
    Record<string, { x: number; width: number }>
  >({});
  const underlineX = useSharedValue(0);
  const underlineWidth = useSharedValue(0);

  // Resolved colors from theme
  const borderColor = $("borderSubtle" as any);
  const backgroundGradientResolved = theme.background as string;
  const accentColor = $("accent");
  const textSecondaryColor = $("textSecondary");



  useEffect(() => {
    onChange?.(active);
  }, [active, onChange]);

  // Animate underline when active tab changes
  useEffect(() => {
    const activeLayout = tabLayouts[active as keyof typeof tabLayouts];
    if (activeLayout) {
      underlineX.value = withTiming(activeLayout.x, {
        duration: 300,
      });
      underlineWidth.value = withTiming(activeLayout.width, {
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
    // Extract layout data immediately to avoid synthetic event pooling issues
    const { x, width } = e.nativeEvent.layout;
    setTabLayouts((prev) => ({ ...prev, [key]: { x, width } }));
  };

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
          position: "relative",
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
            >
              {isActive ? (
                <TabView
                  borderRadius={6}
                  paddingVertical={S.space.sm}
                  paddingHorizontal={S.space.sm}
                  backgroundColor={backgroundGradientResolved}
                  gradient={true}
                  gradientDirection={180}
                  gradientTransitionPoint={60}
                  gradientIntensity={10}
                  style={{
                    borderRightWidth: 3,
                    borderRightColor: borderColor,
                    borderLeftWidth: 3,
                    borderLeftColor: borderColor,
                    borderTopWidth: 3,
                    borderTopColor: borderColor,
                  }}
                >
                  <Body
                    style={{
                      color: accentColor,
                      fontWeight: "600",
                    }}
                  >
                    {tab.label}
                  </Body>
                </TabView>
              ) : (
                <View
                  style={{
                    paddingVertical: S.space.sm,
                    paddingHorizontal: S.space.sm,
                    borderRadius: 6,
                    backgroundColor: "transparent",
                  }}
                >
                  <Body
                    style={{
                      color: textSecondaryColor,
                      fontWeight: "400",
                    }}
                  >
                    {tab.label}
                  </Body>
                </View>
              )}
            </Pressable>
          );
        })}
        
        {/* Animated underline indicator - inside ScrollView so it clips properly */}
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
      </ScrollView>
    </View>
  );
}
