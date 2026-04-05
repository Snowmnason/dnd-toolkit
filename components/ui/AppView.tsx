import { usePlatform } from "@/providers";
import { $, Sizing, useScale } from "@/theme";
import { ComponentType, ReactNode, useEffect, useMemo } from "react";
import {
  ImageBackground,
  ScrollView,
  StyleProp,
  View,
  ViewProps,
  ViewStyle
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
  /** Callback when close button is pressed on mobile right panel */
  onMobileRightPanelClose?: () => void;
  /** Padding on top/bottom. Defaults to gap value. Use 'none' to remove. */
  verticalPadding?: SpaceKey | "none";
  /** Padding on left/right. Defaults to gap value. Use 'none' to remove. */
  horizontalPadding?: SpaceKey | "none";
}

export interface AppLoadingViewProps extends ViewProps {
  loadMessage?: string;
  assetsLoaded?: boolean;
}

/* ───────────────────────────────
   📄 Layout Variants
──────────────────────────────── */

/**
 * Separates layout styles that should be on contentContainerStyle from ScrollView styles
 */
function separateScrollViewStyles(style: StyleProp<ViewStyle>) {
  if (!style) return { scrollViewStyle: undefined, contentStyle: undefined };

  const layoutKeys: (keyof ViewStyle)[] = [
    "alignItems",
    "justifyContent",
    "flexDirection",
    "flexWrap",
    "alignContent",
  ];

  const scrollViewStyles: ViewStyle = {};
  const contentStyles: ViewStyle = {};

  // Flatten the style array if it's an array
  const styleArray = Array.isArray(style) ? style : [style];

  styleArray.forEach((styleObj) => {
    if (!styleObj || typeof styleObj !== "object") return;

    Object.keys(styleObj).forEach((key) => {
      const styleKey = key as keyof ViewStyle;
      if (layoutKeys.includes(styleKey)) {
        // eslint-disable-next-line security/detect-object-injection
        (contentStyles as any)[styleKey] = (styleObj as any)[styleKey];
      } else {
        // eslint-disable-next-line security/detect-object-injection
        (scrollViewStyles as any)[styleKey] = (styleObj as any)[styleKey];
      }
    });
  });

  return {
    scrollViewStyle:
      Object.keys(scrollViewStyles).length > 0 ? scrollViewStyles : undefined,
    contentStyle:
      Object.keys(contentStyles).length > 0 ? contentStyles : undefined,
  };
}

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
  pointerEvents,
  ...rest
}: AppViewProps) {
  const S = useScale();

  // Call $() at top level (not inside useMemo) since it uses UseTheme hook
  const bgSurfaceAlt = $("surfaceAlt" as any);
  const bgAccentAlt = $("accentAlt" as any);
  const bgSurface = $("surface");
  const bgBackground = $("background");

  // Determine background color: custom color takes precedence over tone
  const backgroundColor = useMemo(
    () =>
      customBgColor ||
      (tone === "alt"
        ? bgSurfaceAlt
        : tone === "accent"
          ? bgAccentAlt
          : tone === "surface"
            ? bgSurface
            : bgBackground),
    [customBgColor, tone, bgSurfaceAlt, bgAccentAlt, bgSurface, bgBackground],
  );

  /* Handle background image layering */
  const Wrapper = (
    backgroundImage ? ImageBackground : View
  ) as ComponentType<any>;

  const wrapperProps = backgroundImage
    ? { source: backgroundImage, resizeMode: "cover" as const }
    : {};

  // Separate layout styles from ScrollView styles
  const { scrollViewStyle, contentStyle } = separateScrollViewStyles(style);

  return (
    <Wrapper {...wrapperProps} style={{ flex: 1 }}>
      <ScrollView
        style={[
          {
            flex: 1,
            // Safe access: gap is constrained to SpaceKey
            padding: S.space[gap as SpaceKey],
            backgroundColor,
            ...(pointerEvents ? { pointerEvents } : {}),
          },
          scrollViewStyle,
        ]}
        contentContainerStyle={[
          {
            flexGrow: 1,
            justifyContent: center ? "center" : undefined,
            alignItems: center ? "center" : undefined,
          },
          contentStyle,
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
  onMobileRightPanelClose,
  pointerEvents,
  verticalPadding = "none",
  horizontalPadding = "xs",
  ...rest
}: AppSplitViewProps) {
  const S = useScale();
  // no-op; $() handles CSS vars on web
  const { isDesktop, width } = usePlatform();

  // Resolve padding values
  const vPadding = verticalPadding === undefined ? gap : verticalPadding;
  const hPadding = horizontalPadding === undefined ? gap : horizontalPadding;

  const paddingTop = vPadding === "none" ? 0 : S.space[vPadding as SpaceKey];
  const paddingBottom = vPadding === "none" ? 0 : S.space[vPadding as SpaceKey];
  const paddingLeft = hPadding === "none" ? 0 : S.space[hPadding as SpaceKey];
  const paddingRight = hPadding === "none" ? 0 : S.space[hPadding as SpaceKey];

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
          paddingTop,
          paddingBottom,
          paddingLeft,
          paddingRight,
          ...(pointerEvents ? { pointerEvents } : {}),
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
                // Fill full screen on mobile (no insets)
                left: 0,
                right: 0,
                top: 0,
                bottom: 0,
                backgroundColor: $("background"),
                // Ensure it overlays the left content during slide
                zIndex: 10,
                // pointerEvents in style to avoid deprecation warning
                pointerEvents: rightVisible ? "auto" : "none",
              },
              rightAnimatedStyle,
            ]}
          >
            {/* Close button removed — TopBar back arrow now handles panel close on mobile */}
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
   DEPRECATED: Use useUIBlocker() from @/components/UIBlockerContext instead
   This component is kept for backward compatibility but should not be used.
   UIBlockerLayer is now rendered at root level and controlled via context.
*/
export function AppLoading({
  loadMessage = "Loading...",
  assetsLoaded = false,
  ...rest
}: AppLoadingViewProps) {
  // Deprecated: UIBlockerLayer at root level handles all loading states
  // This function is kept as a stub for backward compatibility
  return null;
}
