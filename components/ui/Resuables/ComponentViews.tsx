import { $, Sizing, tone, useScale, UseTheme } from "@/theme"
import { ReactNode, useMemo } from "react"
import { StyleProp, View, ViewProps, ViewStyle } from "react-native"
import { ViewCust } from "../base/ViewCust"
import { getShadowStyle } from "./shadows"
/* ───────────────────────────────
   🎨 ComponentView
   Reusable container for toast, tooltip, notification, etc.
   Consistent: padding, border radius, centered text, gradient/shadow
──────────────────────────────── */

export interface ComponentViewProps extends ViewProps {
  /** Background gradient color */
  color?: string
  /** Border tone: 'accent' | 'success' | 'warning' | 'danger' | 'info' */
  borderTone?: 'accent' | 'success' | 'warning' | 'danger' | 'info'
  /** Shadow intensity */
  shadow?: 'softer' | 'combined' | 'harder' | 'none'
  /** Optional children */
  children?: ReactNode
  style?: StyleProp<ViewStyle>
}

/**
 * 🎨 ComponentView
 * Standardized container for UI components (toasts, tooltips, notifications, etc.)
 * - Consistent padding & border radius
 * - Centered text alignment
 * - Gradient background support
 * - Themed borders & shadows
 */
export function ComponentView({
  color,
  borderTone = 'accent',
  shadow = 'softer',
  children,
  style,
  ...rest
}: ComponentViewProps) {
  const { theme } = UseTheme();
  const S = useScale();

  // Map borderTone to background color if not explicitly provided
  const bgColor = useMemo(() =>
    color ||
    (borderTone === 'success'
      ? $('success')
      : borderTone === 'danger'
      ? $('danger')
      : borderTone === 'warning'
      ? $('warning')
      : borderTone === 'info'
      ? $('info')
      : $('accent')),
  [color, borderTone]);

  const borderColorValue = useMemo(() => 
    tone(bgColor, 'border', undefined, undefined, theme),
  [bgColor, theme]);

  return (
    <View
      style={[
        {
          backgroundColor: bgColor,
          borderRadius: S.radius.md,
          padding: S.space.md,
          borderWidth: 3,
          borderColor: borderColorValue,
          justifyContent: 'center',
          alignItems: 'center',
          ...getShadowStyle(shadow),
        },
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}

/* ───────────────────────────────
   🔘 IconButtonView
   Simple circular icon button container
   - Just a centered circular View
   - No animations - parent component handles them
──────────────────────────────── */

export interface IconButtonViewProps {
  /** Button size in pixels */
  size: number
  /** Background color */
  backgroundColor: string
  children?: ReactNode
  style?: StyleProp<ViewStyle>
}

/**
 * 🔘 IconButtonView - Simple circular button container
 * Parent (IconButton) handles all animations
 */
export function IconButtonView({
  size,
  backgroundColor,
  children,
  style,
}: IconButtonViewProps) {
  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor,
          alignItems: 'center',
          justifyContent: 'center',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/* ───────────────────────────────
   🔘 ButtonView
   Container for button components with gradient support
   - Handles gradient background
   - Border styling
   - Shadow effects
   - Flexbox layout for content
──────────────────────────────── */
type RadiusKey = keyof Sizing["radius"];
export interface ButtonViewProps {
  /** Height of the button */
  height: number
  /** Horizontal padding */
  paddingHorizontal: number
  /** Border radius key */
  borderRadius?: RadiusKey
  /** Background color */
  backgroundColor: string
  /** Border color */
  borderColor: string
  /** Border width */
  borderWidth?: number
  /** Enable gradient background */
  gradient?: boolean
  /** Gradient direction (0-360 degrees) */
  gradientDirection?: number
  /** Gradient transition point (0-100) */
  gradientTransitionPoint?: number
  /** Gradient intensity */
  gradientIntensity?: number
  /** Shadow mode */
  shadow?: 'softer' | 'combined' | 'harder' | 'none'
  /** Additional styles */
  style?: StyleProp<ViewStyle>
  /** Button content */
  children?: ReactNode
}

/**
 * 🔘 ButtonView - Button container with gradient support
 * Handles layout, gradient, borders, and shadows
 * Parent component (Button) manages animations and interactions
 */
export function ButtonView({
  height,
  paddingHorizontal,
  borderRadius = 'md',
  backgroundColor,
  borderColor,
  borderWidth = 3.5,
  gradient = true,
  gradientDirection = 180,
  gradientTransitionPoint = 50,
  gradientIntensity = 25,
  shadow = 'softer',
  style,
  children,
}: ButtonViewProps) {
  const S = useScale();
  
  // Detect if backgroundColor is a CSS variable - gradients don't work with CSS vars
  const isCSSVar = backgroundColor?.includes('var(')
  const shouldUseGradient = gradient && !isCSSVar

  return (
    <ViewCust
      gradient={shouldUseGradient}
      gradientColor={shouldUseGradient ? backgroundColor : undefined}
      gradientDirection={gradientDirection}
      gradientTransitionPoint={gradientTransitionPoint}
      gradientIntensity={gradientIntensity}
      style={[
        {
          backgroundColor: !shouldUseGradient ? backgroundColor : undefined,
          height,
          paddingHorizontal,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: S.radius[borderRadius],
          borderColor: borderColor,
          borderWidth: borderWidth,
          overflow: 'hidden',
          ...getShadowStyle(shadow),
        },
        style,
      ]}
    >
      {children}
    </ViewCust>
  );
}

/* ───────────────────────────────
   🧭 TabView
   Container for tab items with gradient support
   - Handles gradient background for active tabs
   - No gradient manipulation when using CSS variables
   - Border radius and padding
──────────────────────────────── */

export interface TabViewProps {
  /** Border radius */
  borderRadius: number
  /** Vertical padding */
  paddingVertical: number
  /** Horizontal padding */
  paddingHorizontal: number
  /** Background color (can be CSS variable) */
  backgroundColor?: string
  /** Enable gradient (only works with resolved colors, not CSS vars) */
  gradient?: boolean
  /** Gradient direction */
  gradientDirection?: number
  /** Gradient transition point */
  gradientTransitionPoint?: number
  /** Gradient intensity */
  gradientIntensity?: number
  /** Additional styles */
  style?: StyleProp<ViewStyle>
  /** Tab content */
  children?: ReactNode
}

/**
 * 🧭 TabView - Tab item container
 * Simple view that safely handles both resolved colors and CSS variables
 * Does NOT apply gradient when CSS variable is detected
 */
export function TabView({
  borderRadius,
  paddingVertical,
  paddingHorizontal,
  backgroundColor = 'transparent',
  gradient = false,
  gradientDirection = 180,
  gradientTransitionPoint = 50,
  gradientIntensity = 25,
  style,
  children,
}: TabViewProps) {
  // Check if backgroundColor is a CSS variable
  const isCSSVar = backgroundColor.includes('var(')
  
  // Disable gradient if we detect a CSS variable
  const shouldUseGradient = gradient && !isCSSVar

  return (
    <ViewCust
      gradient={shouldUseGradient}
      gradientColor={shouldUseGradient ? backgroundColor : undefined}
      gradientDirection={gradientDirection}
      gradientTransitionPoint={gradientTransitionPoint}
      gradientIntensity={gradientIntensity}
      style={[
        {
          backgroundColor: !shouldUseGradient ? backgroundColor : undefined,
          borderRadius,
          paddingVertical,
          paddingHorizontal,
        },
        style,
      ]}
    >
      {children}
    </ViewCust>
  );
}
