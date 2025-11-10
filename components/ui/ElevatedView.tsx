import { $, tone, useScale, UseTheme, type Sizing } from '@/theme'
import * as Haptics from 'expo-haptics'
import React from 'react'
import { Animated, Pressable, ViewStyle } from 'react-native'
import { ViewCust } from './base/ViewCust'
import { getShadowStyle } from './Resuables/shadows'

type RadiusKey = keyof Sizing['radius']

// =============================================================================
// CARD COMPONENT - Discrete content containers
// =============================================================================

interface CardProps {
  toneVariant?: 'base' | 'accent' | 'alt'
  bordered?: boolean
  padded?: boolean
  padding?: keyof Sizing['space']
  radius?: RadiusKey
  shadow?: boolean
  gradient?: boolean
  gradientDirection?: number
  gradientIntensity?: number
  gradientTransitionPoint?: number
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
  padding,
  radius = 'md',
  shadow = true,
  gradient = true,
  gradientDirection = 180,
  gradientIntensity = 30,
  gradientTransitionPoint = 70,
  style,
  children,
}: CardProps) {
  const { theme } = UseTheme()
  const S = useScale()

  // Map tone to background color - theme-aware
  const bgColor = toneVariant === 'base'
    ? $('surface', theme)
    : toneVariant === 'accent'
    ? tone($('accent', theme), 'alt', undefined, undefined, theme)
    : tone($('surface', theme), 'alt', undefined, undefined, theme)

  // Use custom padding if provided, otherwise use padded boolean with 'md'
  const paddingValue = padding || (padded ? 'md' : undefined)

  return (
    <ViewCust
      gradient={gradient}
      gradientColor={gradient ? bgColor : undefined}
      gradientDirection={gradientDirection}
      gradientIntensity={gradientIntensity}
      gradientTransitionPoint={gradientTransitionPoint}
      style={[
        {
          backgroundColor: !gradient ? bgColor : undefined,
          padding: paddingValue ? S.space[paddingValue] : undefined,
          borderRadius: S.radius[radius],
          borderWidth: bordered ? 3 : 0,
          borderColor: bordered ? $('borderSubtle', theme) : 'transparent',
          ...getShadowStyle(shadow ? 'combined' : 'none'),
        },
        style,
      ]}
    >
      {children}
    </ViewCust>
  )
}

// =============================================================================
// SURFACE COMPONENT - Large background panels
// =============================================================================

interface SurfaceProps {
  variant?: 'base' | 'surface' | 'alt' | 'accent'
  padded?: boolean
  padding?: keyof Sizing['space']
  radius?: RadiusKey
  bordered?: boolean
  fillWidth?: boolean
  opacity?: number
  gradient?: boolean
  gradientDirection?: number
  gradientIntensity?: number
  gradientTransitionPoint?: number
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
  padding,
  radius = 'md',
  bordered = true,
  fillWidth = true,
  opacity,
  gradient = true,
  gradientDirection = 160,
  gradientIntensity = 10,
  gradientTransitionPoint = 65,
  style,
  children,
}: SurfaceProps) {
  const { theme } = UseTheme()
  const S = useScale()

  // Map variant to background color - theme-aware
  const bgColor = variant === 'base'
    ? $('background', theme)
    : variant === 'accent'
    ? tone($('accent', theme), 'alt', undefined, undefined, theme)
    : variant === 'alt'
    ? tone($('surface', theme), 'alt', undefined, undefined, theme)
    : $('surface', theme)

  // Use custom padding if provided, otherwise use padded boolean with 'md'
  const paddingValue = padding || (padded ? 'md' : undefined)

  return (
    <ViewCust
      gradient={gradient}
      gradientColor={gradient ? bgColor : undefined}
      gradientDirection={gradientDirection}
      gradientIntensity={gradientIntensity}
      gradientTransitionPoint={gradientTransitionPoint}
      style={[
        {
          backgroundColor: !gradient ? bgColor : undefined,
          padding: paddingValue ? S.space[paddingValue] : undefined,
          borderRadius: S.radius[radius],
          borderWidth: bordered ? 2 : 0,
          borderColor: bordered ? $('borderSubtle', theme) : 'transparent',
          width: fillWidth ? '100%' : undefined,
          opacity,
          ...getShadowStyle('softer'),
        },
        style,
      ]}
    >
      {children}
    </ViewCust>
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
