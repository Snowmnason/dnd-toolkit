import LoadingOverlay from "@/components/LoadingOverlay";
import { usePlatform } from "@/contexts/PlatformContext";
import { $, Sizing, useScale } from "@/theme";
import { ComponentType, ReactNode, useEffect, useMemo } from "react";
import {
  ImageBackground,
  Platform,
  ScrollView,
  StyleProp,
  View,
  ViewProps,
  ViewStyle,
} from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { ViewCust } from "./base/ViewCust";

/* ───────────────────────────────
   🪶 AppView Props
──────────────────────────────── */

type SpaceKey = keyof Sizing["space"];

export interface AppViewProps extends ViewProps {
  center?: boolean;
  gap?: SpaceKey;
  tone?: "base" | "alt" | "accent" | "surface";
  /** Custom background color - overrides tone-based color */
  backgroundColor?: string;
  backgroundImage?: any;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  showScrollIndicator?: boolean;
}

export interface AppSplitViewProps extends AppViewProps {
  left?: ReactNode;
  right?: ReactNode;
  /** Enable slide-in animation for right panel on non-desktop */
  animateRightSlide?: boolean;
  /** Controls visibility of right panel when animation is enabled */
  rightVisible?: boolean;
}

export interface AppLoadingViewProps extends ViewProps {
  loadMessage?: string;
  error?: Error | null;
  assetsLoaded?: boolean;
}

/* ───────────────────────────────
   📄 Layout Variants
──────────────────────────────── */

/* ───── AppPage ───── 
   Full-featured page container with ScrollView
   Opinionated defaults: scrolling, padding, background image support
*/
export function AppPage({
  center = false,
  gap = "md",
  tone = "base",
  backgroundColor: customBgColor,
  backgroundImage,
  showScrollIndicator = false,
  style,
  contentContainerStyle,
  children,
  ...rest
}: AppViewProps) {
  const S = useScale();

  // Determine background color: custom color takes precedence over tone
  const backgroundColor = useMemo(
    () =>
      customBgColor ||
      (tone === "alt"
        ? $("surfaceAlt" as any)
        : tone === "accent"
        ? $("accentAlt" as any)
        : tone === "surface"
        ? $("surface")
        : $("background")),
    [customBgColor, tone]
  );

  /* Handle background image layering */
  const Wrapper = (
    backgroundImage ? ImageBackground : View
  ) as ComponentType<any>;

  const wrapperProps = backgroundImage
    ? { source: backgroundImage, resizeMode: "cover" as const }
    : {};

  return (
    <Wrapper {...wrapperProps} style={{ flex: 1 }}>
      <ScrollView
        style={[
          {
            flex: 1,
            padding: S.space[gap],
            backgroundColor,
          },
          style,
        ]}
        contentContainerStyle={[
          {
            flexGrow: 1,
            justifyContent: center ? "center" : undefined,
            alignItems: center ? "center" : undefined,
          },
          contentContainerStyle,
        ]}
        showsVerticalScrollIndicator={showScrollIndicator}
        {...rest}
      >
        {children}
      </ScrollView>
    </Wrapper>
  );
}

/* ───── AppSplit ───── 
   Two-column split layout (responsive)
   Desktop: 35% left / 65% right side-by-side
   Mobile: stacked vertically
*/
export function AppSplit({
  left,
  right,
  children,
  gap = "md",
  showScrollIndicator = false,
  animateRightSlide = false,
  rightVisible = true,
  ...rest
}: AppSplitViewProps) {
  const S = useScale();
  // no-op; $() handles CSS vars on web
  const { isDesktop, width } = usePlatform();

  // Shared value to animate right panel in/out on mobile
  const slideProgress = useSharedValue(rightVisible ? 1 : 0);

  useEffect(() => {
    // Animate only when enabled and not desktop
    if (!animateRightSlide || isDesktop) {
      slideProgress.value = rightVisible ? 1 : 0;
      return;
    }
    slideProgress.value = withTiming(rightVisible ? 1 : 0, {
      duration: 350,
      easing: Easing.out(Easing.cubic),
    });
  }, [rightVisible, animateRightSlide, isDesktop, slideProgress]);

  // Animated style for right panel on mobile (slides from right)
  const rightAnimatedStyle = useAnimatedStyle(() => {
    if (isDesktop || !animateRightSlide) return {};
    const translateX = (1 - slideProgress.value) * width;
    return {
      transform: [{ translateX }],
    };
  }, [isDesktop, animateRightSlide]);

  return (
    <View
      style={[
        {
          flex: 1,
          flexDirection: isDesktop ? "row" : "column",
          backgroundColor: $("background"),
          padding: S.space[gap],
        },
      ]}
      {...rest}
    >
      {left && (
        <ViewCust
          scroll
          showScrollIndicator={showScrollIndicator}
          contentContainerStyle={{
            flexGrow: 1,
          }}
          style={{
            flex: isDesktop ? 1 : 1,
            width: isDesktop ? "35%" : "100%",
            paddingRight: isDesktop ? S.space.md : undefined,
            borderRightWidth: isDesktop ? 1 : 0,
            borderRightColor: $("borderSubtle" as any),
          }}
        >
          {left}
        </ViewCust>
      )}

      {right &&
        (isDesktop ? (
          <View
            style={{
              flex: 3,
              width: "65%",
              paddingLeft: S.space.md,
            }}
          >
            {right}
          </View>
        ) : (
          <Animated.View
            style={[
              {
                position: "absolute",
                left: S.space[gap],
                right: S.space[gap],
                top: S.space[gap],
                bottom: S.space[gap],
                backgroundColor: $("background"),
                // Ensure it overlays the left content during slide
                zIndex: 10,
              },
              rightAnimatedStyle,
              // On web, use style.pointerEvents to avoid deprecation
              Platform.OS === "web"
                ? { pointerEvents: rightVisible ? "auto" : "none" }
                : {},
            ]}
            // On native, keep prop pointerEvents; on web, omit to avoid deprecation warning
            {...(Platform.OS !== "web"
              ? { pointerEvents: (rightVisible ? "auto" : "none") as any }
              : {})}
          >
            {right}
          </Animated.View>
        ))}

      {/* Render modals, toasts, and other overlays */}
      {children}
    </View>
  );
}

/* ───── AppLoading ───── 
   Loading state overlay
   Shows LoadingOverlay component with message/error
*/
export function AppLoading({
  loadMessage = "Loading...",
  error = null,
  assetsLoaded = false,
  ...rest
}: AppLoadingViewProps) {
  return (
    <LoadingOverlay
      message={loadMessage}
      error={error}
      assetsLoaded={assetsLoaded}
      {...rest}
    />
  );
}
