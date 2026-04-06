import { useTooltipPortal } from "@/contexts/tooltip-portal-context";
import { useScale } from "@/theme";
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import { Platform, Pressable, View } from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { SubTitle } from "./AppText";
import { Card } from "./ElevatedView";

// Stable incrementing ID per AppTooltip instance
let _idCounter = 0;
function nextTooltipId() {
  return `tt-${++_idCounter}`;
}

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
 *
 * Renders via TooltipPortalProvider so the bubble always appears above all
 * stacking contexts (Accordion headers, NavDrawer, etc.). The inline API
 * is unchanged — just wrap any element:
 *   <AppTooltip text="..."><Button /></AppTooltip>
 */
export function AppTooltip({
  text,
  delay = 500,
  enableMobilePress = true,
  children,
}: AppTooltipProps) {
  const S = useScale();
  const portal = useTooltipPortal();
  const containerRef = useRef<View>(null);
  const idRef = useRef(nextTooltipId());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const opacity = useSharedValue(0);
  const translateY = useSharedValue(6);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  // Stable tooltip bubble — mirrors the original positioning logic.
  // Rendered inside a portal entry anchored at the trigger's absolute position,
  // so `bottom: "100%"` / `left: "50%"` is relative to the trigger bounds.
   
  const tooltipContent = useMemo(
    () => (
      <Animated.View
        style={[
          {
            position: "absolute",
            // Position above the trigger, centered horizontally —
            // same as the original local-render approach
            bottom: "100%" as any,
            left: "50%" as any,
            transform: [{ translateX: -50 }],
            marginBottom: S.space.xs,
            pointerEvents: "none",
          },
          animatedStyle,
        ]}
      >
        <Card
          padding="xs"
          gradient
          gradientIntensity={25}
          gradientTransitionPoint={70}
          gradientDirection={180}
          radius="sm"
        >
          <SubTitle textType="primary" align="center">
            {text}
          </SubTitle>
        </Card>
      </Animated.View>
    ),
    // animatedStyle is a stable Reanimated worklet ref — no dep needed.
    // text and S.space.xs are the only real dependencies.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [text, S.space.xs]
  );

  const doUnregister = useCallback(() => {
    portal.unregisterEntry(idRef.current);
  }, [portal]);

  const show = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);

    timerRef.current = setTimeout(() => {
      // measureInWindow gives reliable window-relative coords on both web and native.
      // measure() can silently skip its callback on RN Web.
      containerRef.current?.measureInWindow((x, y, width, height) => {
        // Start at hidden state before registering
        opacity.value = 0;
        translateY.value = 6;

        portal.registerEntry({
          id: idRef.current,
          pageX: x,
          pageY: y,
          triggerWidth: width,
          triggerHeight: height,
          content: tooltipContent,
        });

        // One frame delay so React commits the Animated.View to the native tree
        // before Reanimated tries to drive it.
        requestAnimationFrame(() => {
          opacity.value = withTiming(1, { duration: 200 });
          translateY.value = withTiming(0, { duration: 200 });
        });
      });
    }, delay);
  }, [delay, opacity, translateY, portal, tooltipContent]);

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);

    opacity.value = withTiming(0, { duration: 150 });
    translateY.value = withTiming(6, { duration: 150 });

    // Unregister after animation completes (150ms)
    timerRef.current = setTimeout(() => {
      doUnregister();
    }, 150);
  }, [opacity, translateY, doUnregister]);

  const handlePressIn = useCallback(() => {
    if (Platform.OS === "web" || !enableMobilePress) return;
    pressTimerRef.current = setTimeout(() => show(), 300);
  }, [enableMobilePress, show]);

  const handlePressOut = useCallback(() => {
    if (Platform.OS === "web" || !enableMobilePress) return;
    if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
    setTimeout(() => hide(), 1500);
  }, [enableMobilePress, hide]);

  // Cleanup on unmount — remove from portal if still visible
  useEffect(() => {
    const id = idRef.current;
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (pressTimerRef.current) clearTimeout(pressTimerRef.current);
      portal.unregisterEntry(id);
    };
  }, [portal]);

  return (
    // collapsable={false} ensures the View always has a native node that can be measured
    <View ref={containerRef} collapsable={false}>
      <Pressable
        onHoverIn={Platform.OS === "web" ? show : undefined}
        onHoverOut={Platform.OS === "web" ? hide : undefined}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
      >
        {children}
      </Pressable>
    </View>
  );
}

