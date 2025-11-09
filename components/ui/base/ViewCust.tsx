import { Sizing, useScale } from "@/theme";
import { ReactNode } from "react";
import {
  ScrollView,
  StyleProp,
  View,
  ViewProps,
  ViewStyle,
} from "react-native";
import { GradientView } from "../Resuables/gradients";
import { getShadowStyle, ShadowMode } from "../Resuables/shadows";

/* ───────────────────────────────
   🪶 ViewCust Props
──────────────────────────────── */

type SpaceKey = keyof Sizing["space"];
type RadiusKey = keyof Sizing["radius"];

export interface ViewCustProps extends ViewProps {
  /** Shorthand: padding */
  p?: SpaceKey;
  /** Full: padding */
  padding?: SpaceKey;
  /** Shorthand: paddingHorizontal */
  px?: SpaceKey;
  /** Full: paddingHorizontal */
  paddingHorizontal?: SpaceKey;
  /** Shorthand: paddingVertical */
  py?: SpaceKey;
  /** Full: paddingVertical */
  paddingVertical?: SpaceKey;
  /** Shorthand: paddingTop */
  pt?: SpaceKey;
  /** Full: paddingTop */
  paddingTop?: SpaceKey;
  /** Shorthand: paddingBottom */
  pb?: SpaceKey;
  /** Full: paddingBottom */
  paddingBottom?: SpaceKey;
  /** Shorthand: paddingLeft */
  pl?: SpaceKey;
  /** Full: paddingLeft */
  paddingLeft?: SpaceKey;
  /** Shorthand: paddingRight */
  pr?: SpaceKey;
  /** Full: paddingRight */
  paddingRight?: SpaceKey;
  /** Shorthand: margin */
  m?: SpaceKey;
  /** Full: margin */
  margin?: SpaceKey;
  /** Shorthand: marginHorizontal */
  mx?: SpaceKey;
  /** Full: marginHorizontal */
  marginHorizontal?: SpaceKey;
  /** Shorthand: marginVertical */
  my?: SpaceKey;
  /** Full: marginVertical */
  marginVertical?: SpaceKey;
  /** Shorthand: gap */
  gap?: SpaceKey;
  /** Shorthand: backgroundColor */
  bg?: string;
  /** Full: backgroundColor */
  backgroundColor?: string;
  /** Shorthand: flexDirection */
  fd?: "row" | "column" | "row-reverse" | "column-reverse";
  /** Full: flexDirection */
  flexDirection?: "row" | "column" | "row-reverse" | "column-reverse";
  /** Shorthand: flexWrap */
  fw?: "wrap" | "nowrap" | "wrap-reverse";
  /** Full: flexWrap */
  flexWrap?: "wrap" | "nowrap" | "wrap-reverse";
  /** Shorthand: justifyContent */
  jc?: "flex-start" | "flex-end" | "center" | "space-between" | "space-around" | "space-evenly";
  /** Full: justifyContent */
  justifyContent?: "flex-start" | "flex-end" | "center" | "space-between" | "space-around" | "space-evenly";
  /** Shorthand: alignItems */
  ai?: "flex-start" | "flex-end" | "center" | "stretch" | "baseline";
  /** Full: alignItems */
  alignItems?: "flex-start" | "flex-end" | "center" | "stretch" | "baseline";
  /** Shorthand: alignContent */
  ac?: "flex-start" | "flex-end" | "center" | "stretch" | "space-between" | "space-around";
  /** Full: alignContent */
  alignContent?: "flex-start" | "flex-end" | "center" | "stretch" | "space-between" | "space-around";
  /** flex value */
  flex?: number;
  /** Enable scrolling (default: false) */
  scroll?: boolean;
  /** Show scroll indicator when scrolling (default: false) */
  showScrollIndicator?: boolean;
  /** Content container style for ScrollView */
  contentContainerStyle?: StyleProp<ViewStyle>;
  /** Gradient support - enable gradient background (default: false) */
  gradient?: boolean;
  /** Gradient primary color */
  gradientColor?: string;
  /** Gradient secondary color - auto-generated if not provided */
  gradientColor2?: string;
  /** Gradient direction in degrees (0=bottom-to-top, 90=left-to-right, 180=top-to-bottom, 270=right-to-left) */
  gradientDirection?: number;
  /** Position where gradient transitions (0-100, default: 30) */
  gradientTransitionPoint?: number;
  /** Gradient intensity - how much to adjust color2 (default: 30) */
  gradientIntensity?: number;
  /** Gradient opacity (0-1) */
  gradientOpacity?: number;
  /** Border radius */
  radius?: RadiusKey;
  /** Shorthand: borderRadius */
  br?: RadiusKey;
  /** Border width (default: 0) */
  borderWidth?: number;
  /** Border width top */
  borderTopWidth?: number;
  /** Border width bottom */
  borderBottomWidth?: number;
  /** Border width left */
  borderLeftWidth?: number;
  /** Border width right */
  borderRightWidth?: number;
  /** Border color */
  borderColor?: string;
  /** Border color top */
  borderTopColor?: string;
  /** Border color bottom */
  borderBottomColor?: string;
  /** Border color left */
  borderLeftColor?: string;
  /** Border color right */
  borderRightColor?: string;
  /** Border gradient support - enable gradient border (default: false) */
  borderGradient?: boolean;
  /** Border gradient primary color */
  borderGradientColor?: string;
  /** Border gradient secondary color - auto-generated if not provided */
  borderGradientColor2?: string;
  /** Border gradient direction in degrees (0=bottom-to-top, 90=left-to-right, 180=top-to-bottom, 270=right-to-left) */
  borderGradientDirection?: number;
  /** If true, border gradient opacity follows the background gradient opacity */
  borderGradientOpacityFollowsBg?: boolean;
  /** If true, border gradient direction will intent the background direction (follow it instead of custom angle) */
  borderGradientDirectionIntent?: boolean;
  /** Shadow mode: 'combined' (layered), 'harder' (sharp), 'softer' (diffused), 'none' (default) */
  shadow?: ShadowMode;
  /** Fill width (default: true) */
  fillWidth?: boolean;
  /** Opacity (0-1) */
  opacity?: number;
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/* ───────────────────────────────────────────────
   🧱 ViewCust — Simple, flexible base component with shorthand props
   
   Examples:
   <ViewCust p="md" bg="#fff" fd="row" jc="center" ai="center">...</ViewCust>
   <ViewCust scroll padding="lg" gap="md">...</ViewCust>
   <ViewCust flex={2} px="md" py="sm" flexDirection="column">...</ViewCust>
──────────────────────────────────────────────── */
export function ViewCust({
  p,
  padding,
  px,
  paddingHorizontal,
  py,
  paddingVertical,
  pt,
  paddingTop,
  pb,
  paddingBottom,
  pl,
  paddingLeft,
  pr,
  paddingRight,
  m,
  margin,
  mx,
  marginHorizontal,
  my,
  marginVertical,
  gap,
  bg,
  backgroundColor,
  fd,
  flexDirection,
  fw,
  flexWrap,
  jc,
  justifyContent,
  ai,
  alignItems,
  ac,
  alignContent,
  flex = 1,
  scroll = false,
  showScrollIndicator = false,
  contentContainerStyle,
  gradient = false,
  gradientColor,
  gradientColor2,
  gradientDirection = 180,
  gradientTransitionPoint = 30,
  gradientIntensity = 30,
  gradientOpacity,
  radius,
  br,
  borderWidth = 0,
  borderTopWidth,
  borderBottomWidth,
  borderLeftWidth,
  borderRightWidth,
  borderColor,
  borderTopColor,
  borderBottomColor,
  borderLeftColor,
  borderRightColor,
  borderGradient = false,
  borderGradientColor,
  borderGradientColor2,
  borderGradientDirection = 180,
  borderGradientOpacityFollowsBg = false,
  borderGradientDirectionIntent = false,
  shadow = 'none',
  fillWidth = true,
  opacity,
  style,
  children,
  ...rest
}: ViewCustProps) {
  const S = useScale();

  // Build dynamic styles from shorthand props (shorthand takes precedence over full names)
  const dynamicStyle: ViewStyle = {
    flex,
    ...(p !== undefined && { padding: S.space[p] }),
    ...(padding !== undefined && { padding: S.space[padding] }),
    ...(px !== undefined && { paddingHorizontal: S.space[px] }),
    ...(paddingHorizontal !== undefined && { paddingHorizontal: S.space[paddingHorizontal] }),
    ...(py !== undefined && { paddingVertical: S.space[py] }),
    ...(paddingVertical !== undefined && { paddingVertical: S.space[paddingVertical] }),
    ...(pt !== undefined && { paddingTop: S.space[pt] }),
    ...(paddingTop !== undefined && { paddingTop: S.space[paddingTop] }),
    ...(pb !== undefined && { paddingBottom: S.space[pb] }),
    ...(paddingBottom !== undefined && { paddingBottom: S.space[paddingBottom] }),
    ...(pl !== undefined && { paddingLeft: S.space[pl] }),
    ...(paddingLeft !== undefined && { paddingLeft: S.space[paddingLeft] }),
    ...(pr !== undefined && { paddingRight: S.space[pr] }),
    ...(paddingRight !== undefined && { paddingRight: S.space[paddingRight] }),
    ...(m !== undefined && { margin: S.space[m] }),
    ...(margin !== undefined && { margin: S.space[margin] }),
    ...(mx !== undefined && { marginHorizontal: S.space[mx] }),
    ...(marginHorizontal !== undefined && { marginHorizontal: S.space[marginHorizontal] }),
    ...(my !== undefined && { marginVertical: S.space[my] }),
    ...(marginVertical !== undefined && { marginVertical: S.space[marginVertical] }),
    ...(gap !== undefined && { gap: S.space[gap] }),
    ...(bg !== undefined && { backgroundColor: bg }),
    ...(backgroundColor !== undefined && { backgroundColor }),
    ...(fd !== undefined && { flexDirection: fd }),
    ...(flexDirection !== undefined && { flexDirection }),
    ...(fw !== undefined && { flexWrap: fw }),
    ...(flexWrap !== undefined && { flexWrap }),
    ...(jc !== undefined && { justifyContent: jc }),
    ...(justifyContent !== undefined && { justifyContent }),
    ...(ai !== undefined && { alignItems: ai }),
    ...(alignItems !== undefined && { alignItems }),
    ...(ac !== undefined && { alignContent: ac }),
    ...(alignContent !== undefined && { alignContent }),
    ...(fillWidth && { width: '100%' }),
    ...(opacity !== undefined && { opacity }),
    borderRadius: S.radius[br ?? radius ?? 'md'],
    borderWidth,
    ...(borderTopWidth !== undefined && { borderTopWidth }),
    ...(borderBottomWidth !== undefined && { borderBottomWidth }),
    ...(borderLeftWidth !== undefined && { borderLeftWidth }),
    ...(borderRightWidth !== undefined && { borderRightWidth }),
    ...(borderColor !== undefined && { borderColor }),
    ...(borderTopColor !== undefined && { borderTopColor }),
    ...(borderBottomColor !== undefined && { borderBottomColor }),
    ...(borderLeftColor !== undefined && { borderLeftColor }),
    ...(borderRightColor !== undefined && { borderRightColor }),
    ...getShadowStyle(shadow),
  };

  // Gradient wrapper - OUTSIDE ScrollView so it's static and doesn't scroll
  // This allows the gradient background to remain fixed while content scrolls
  if (gradient && gradientColor) {
    return (
      <GradientView
        enabled={true}
        color={gradientColor}
        color2={gradientColor2}
        direction={gradientDirection}
        transitionPoint={gradientTransitionPoint}
        intensity={gradientIntensity}
        opacity={gradientOpacity}
        borderGradient={borderGradient}
        borderGradientColor={borderGradientColor}
        borderGradientColor2={borderGradientColor2}
        borderGradientDirection={borderGradientDirectionIntent ? gradientDirection : borderGradientDirection}
        borderGradientOpacityFollowsBg={borderGradientOpacityFollowsBg}
        style={[{ flex }, style]}
      >
        {scroll ? (
          <ScrollView
            style={dynamicStyle}
            contentContainerStyle={contentContainerStyle}
            showsVerticalScrollIndicator={showScrollIndicator}
            {...rest}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={dynamicStyle} {...rest}>
            {children}
          </View>
        )}
      </GradientView>
    );
  }

  // If scroll is enabled (without gradient), wrap in ScrollView
  if (scroll) {
    return (
      <ScrollView
        style={[dynamicStyle, style]}
        contentContainerStyle={contentContainerStyle}
        showsVerticalScrollIndicator={showScrollIndicator}
        {...rest}
      >
        {children}
      </ScrollView>
    );
  }

  // Otherwise, just a View (without gradient, without scroll)
  return (
    <View style={[dynamicStyle, style]} {...rest}>
      {children}
    </View>
  );
}