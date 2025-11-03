import { $, tone, useScale, UseTheme, type Sizing } from '@/theme'
import * as Haptics from 'expo-haptics'
import React from 'react'
import { Animated, Platform, Pressable, View, ViewStyle } from 'react-native'
import { GradientView } from './Resuables/GradientView'
import { getShadowStyle, ShadowMode } from './Resuables/shadows'

type RadiusKey = keyof Sizing['radius']

/**
 * Gradient configuration
 */
type GradientIntensity = 'subtle' | 'moderate' | 'dramatic'
type GradientDirection = 'top-to-bottom' | 'bottom-to-top'

interface ElevatedViewBaseProps {
  toneVariant?: 'base' | 'surface' | 'accent' | 'alt' | 'elevated'
  bordered?: boolean
  borderWidth?: number
  padded?: boolean
  radius?: RadiusKey
  shadow?: ShadowMode
  fillWidth?: boolean
  opacity?: number
  gradient?: boolean
  gradientOpacity?: number
  gradientIntensity?: GradientIntensity
  gradientDirection?: GradientDirection
  style?: ViewStyle
  children: React.ReactNode
}

/**
 * 🏗️ ElevatedView (Base Component)
 * Unified foundation for Surface and Card with theme-aware styling,
 * flexible shadows, and responsive layout options.
 */
export function ElevatedView({
  toneVariant = 'surface',
  bordered = true,
  borderWidth: customBorderWidth,
  padded = true,
  radius = 'md',
  shadow = 'combined',
  fillWidth = false,
  opacity,
  gradient = false,
  gradientOpacity,
  gradientIntensity = 'dramatic',
  gradientDirection = 'top-to-bottom',
  style,
  children,
}: ElevatedViewBaseProps) {
  const S = useScale()
  const { theme } = UseTheme()

  // Compute styles directly inline to ensure they update with theme
  const bg = toneVariant === 'base'
      ? $('background', theme)
      : toneVariant === 'accent'
      ? tone($('accent', theme), 'alt', undefined, undefined, theme)
      : toneVariant === 'elevated' || toneVariant === 'alt'
      ? tone($('surface', theme), 'alt', undefined, undefined, theme)
      : $('surface', theme)

  const borderColor = bordered 
    ? $('borderSubtle' as any, theme)
    : 'transparent'

  const borderWidth = customBorderWidth ?? (bordered ? 1 : 0)

  // Get shadow style from reusable utility (theme-aware)
  const shadowStyle = getShadowStyle(shadow)

  // Get the base color for gradient (CSS var on web, resolved on native)
  const baseColor = Platform.OS === 'web'
    ? (toneVariant === 'base'
        ? $('background')
        : toneVariant === 'accent'
        ? $('accentAlt' as any)
        : toneVariant === 'elevated' || toneVariant === 'alt'
        ? $('surfaceAlt' as any)
        : $('surface'))
    : bg

  const containerStyle: ViewStyle = {
    borderRadius: S.radius[radius],
    borderWidth,
    borderColor,
    padding: padded ? S.space.md : 0,
    ...(fillWidth && { width: '100%' }),
    ...(opacity !== undefined && { opacity }),
    ...shadowStyle,
    overflow: 'hidden',
  }

  if (gradient) {
    // Use GradientView for gradient backgrounds
    return (
      <GradientView
        baseColor={baseColor}
        gradientOpacity={gradientOpacity}
        intensity={gradientIntensity}
        direction={gradientDirection}
        borderRadius={S.radius[radius]}
        style={{ ...containerStyle, ...style } as ViewStyle}
      >
        {children}
      </GradientView>
    )
  }

  // Non-gradient: simple colored background
  return (
    <View
      style={[
        containerStyle,
        { backgroundColor: baseColor as any },
        style,
      ]}
    >
      {children}
    </View>
  )
}

// =============================================================================
// CARD COMPONENT - Discrete content containers
// =============================================================================

interface CardProps {
  toneVariant?: 'base' | 'accent' | 'alt'
  bordered?: boolean
  padded?: boolean
  radius?: RadiusKey
  shadow?: boolean
  gradient?: boolean
  gradientOpacity?: number
  gradientIntensity?: GradientIntensity
  gradientDirection?: GradientDirection
  style?: ViewStyle
  children: React.ReactNode
}

/**
 * 🪶 Card
 * Discrete, raised content containers for lists, tiles, modals, and sections.
 * - Thicker borders (3px) for prominence
 * - Sizes to content only (no fillWidth)
 * - Combined shadow (layered depth)
 * - Optional dramatic gradient for depth
 */
export function Card({
  toneVariant = 'base',
  bordered = true,
  padded = true,
  radius = 'md',
  shadow = true,
  gradient = true,
  gradientOpacity,
  gradientIntensity = 'dramatic',
  gradientDirection = 'top-to-bottom',
  style,
  children,
}: CardProps) {
  // Map Card's toneVariant to ElevatedView's naming
  const mappedVariant = toneVariant === 'base' ? 'surface' : toneVariant

  return (
    <ElevatedView
      toneVariant={mappedVariant}
      bordered={bordered}
      borderWidth={3}
      padded={padded}
      radius={radius}
      shadow={shadow ? 'combined' : 'none'}
      fillWidth={false}
      gradient={gradient}
      gradientOpacity={gradientOpacity}
      gradientIntensity={gradientIntensity}
      gradientDirection={gradientDirection}
      style={style}
    >
      {children}
    </ElevatedView>
  )
}

// =============================================================================
// SURFACE COMPONENT - Large background panels
// =============================================================================

interface SurfaceProps {
  variant?: 'base' | 'surface' | 'elevated' | 'accent'
  padded?: boolean
  radius?: RadiusKey
  bordered?: boolean
  fillWidth?: boolean
  opacity?: number
  gradient?: boolean
  gradientOpacity?: number
  gradientIntensity?: GradientIntensity
  gradientDirection?: GradientDirection
  style?: ViewStyle
  children: React.ReactNode
}

/**
 * 🌗 Surface
 * Large background panels and page sections with softer shadows.
 * - Thinner borders (2px)
 * - Fills screen width by default (or sizes to content)
 * - Softer, diffused shadow
 * - Supports opacity for overlays
 * - Optional subtle gradient for depth
 */
export function Surface({
  variant = 'surface',
  padded = true,
  radius = 'md',
  bordered = true,
  fillWidth = true,
  opacity,
  gradient = true,
  gradientOpacity,
  gradientIntensity = 'subtle',
  gradientDirection = 'top-to-bottom',
  style,
  children,
}: SurfaceProps) {
  return (
    <ElevatedView
      toneVariant={variant}
      bordered={bordered}
      borderWidth={2}
      padded={padded}
      radius={radius}
      shadow="softer"
      fillWidth={fillWidth}
      opacity={opacity}
      gradient={gradient}
      gradientOpacity={gradientOpacity}
      gradientIntensity={gradientIntensity}
      gradientDirection={gradientDirection}
      style={style}
    >
      {children}
    </ElevatedView>
  )
}

// =============================================================================
// INTERACTIVE CARD COMPONENT - Clickable animated cards
// =============================================================================

interface InteractiveCardProps {
  onPress?: () => void
  disabled?: boolean
  toneVariant?: 'base' | 'accent' | 'alt'
  children: React.ReactNode
}

/**
 * 🪄 InteractiveCard
 * A clickable, animated card for selectable panels or large buttons.
 */
export function InteractiveCard({
  onPress,
  disabled = false,
  toneVariant = 'base',
  children,
}: InteractiveCardProps) {
  const scale = React.useRef(new Animated.Value(1)).current

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
    }).start()
  }

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 5,
      tension: 200,
      useNativeDriver: true,
    }).start()
  }

  const handlePress = () => {
    if (disabled) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onPress?.()
  }

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        disabled={disabled}
        style={({ pressed }) => ({
          opacity: pressed ? 0.95 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        })}
      >
        <Card
          toneVariant={toneVariant}
          shadow
          bordered
        >
          {children}
        </Card>
      </Pressable>
    </Animated.View>
  )
}
