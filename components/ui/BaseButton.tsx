import { $, tone, useScale, UseTheme } from '@/theme'
import * as Haptics from 'expo-haptics'
import React, { useMemo } from 'react'
import {
    ActivityIndicator,
    Platform,
    Pressable,
    StyleProp,
    View,
    ViewStyle,
} from 'react-native'
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
} from 'react-native-reanimated'
import { ButtonText } from './AppText'
import { ButtonView } from './Resuables/ComponentViews'

/* ───────────────────────────────
   🔘 Types & Utilities
──────────────────────────────── */

export type ButtonVariant =
  | 'primary'
  | 'secondary'
  | 'destructive'
  | 'ghost'
  | 'solid'
  | 'outlined'
  | 'cancel'
  | 'auth'

export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps {
  variant?: ButtonVariant
  size?: ButtonSize
  disabled?: boolean
  loading?: boolean
  text?: string
  iconLeft?: React.ReactNode
  iconRight?: React.ReactNode
  bg?: string
  textColor?: string
  borderColor?: string
  gradient?: boolean
  gradientDirection?: number
  gradientIntensity?: number
  gradientTransitionPoint?: number
  minWidth?: number | string
  style?: StyleProp<ViewStyle>
  onPress?: () => void
  children?: React.ReactNode
}

export interface VariantColorConfig {
  background: string
  border: string
  text: string
}

/**
 * Apply alpha to a color string (hex/rgb/rgba) for one-off usage
 */
export function withOpacity(color: string, alpha: number): string {
  if (!color) return `rgba(0,0,0,${alpha})`
  const c = color.trim()
  if (c.startsWith('rgba(')) {
    const parts = c.slice(5, -1).split(',').map((p) => p.trim())
    const [r, g, b] = parts
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  if (c.startsWith('rgb(')) {
    const parts = c.slice(4, -1).split(',').map((p) => p.trim())
    const [r, g, b] = parts
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  if (c.startsWith('#')) {
    let hex = c.slice(1)
    if (hex.length === 3) {
      const r = parseInt(hex[0] + hex[0], 16)
      const g = parseInt(hex[1] + hex[1], 16)
      const b = parseInt(hex[2] + hex[2], 16)
      return `rgba(${r}, ${g}, ${b}, ${alpha})`
    }
    if (hex.length === 6 || hex.length === 8) {
      const r = parseInt(hex.slice(0, 2), 16)
      const g = parseInt(hex.slice(2, 4), 16)
      const b = parseInt(hex.slice(4, 6), 16)
      return `rgba(${r}, ${g}, ${b}, ${alpha})`
    }
  }
  return c
}

/* ───────────────────────────────
   🎨 App-Specific Variant Styles
   Customize these to match your app's design language
──────────────────────────────── */

function getVariantColors(variant: ButtonVariant, theme: any): VariantColorConfig {
  switch (variant) {
    case 'secondary':
      return {
        background: withOpacity($('primary', theme), 0.45),
        border: $('primary', theme),
        text: $('textPrimary', theme),
      }
    case 'destructive':
      return {
        background: $('destructiveButton', theme),
        border: tone($('destructiveButton', theme), 'border', undefined, undefined, theme),
        text: $('destructiveButtonText', theme),
      }
    case 'ghost':
      return {
        background: 'transparent',
        border: 'transparent',
        text: $('primary', theme),
      }
    case 'solid':
      return {
        background: $('accent', theme),
        border: $('primary', theme),
        text: $('primary', theme),
      }
    case 'outlined':
      return {
        background: 'transparent',
        border: tone($('accent', theme), 'border', undefined, undefined, theme),
        text: $('primary', theme),
      }
    case 'cancel':
      return {
        background: $('cancelButton', theme),
        border: tone($('cancelButton', theme), 'border', undefined, undefined, theme),
        text: $('cancelButtonText', theme),
      }
    case 'primary':
    default:
      return {
        background: $('bgInverse', theme),
        border: $('accent', theme),
        text: $('primaryButtonText', theme),
      }
  }
}

/* ───────────────────────────────
   🪄 Button - Core Component
   
   All styling and variant logic in one place
──────────────────────────────── */

export function Button(props: ButtonProps) {
  const {
    variant = 'primary',
    size = 'md',
    disabled = false,
    loading = false,
    text,
    iconLeft,
    iconRight,
    bg,
    textColor,
    borderColor,
    gradient = true,
    gradientDirection = 180,
    gradientIntensity = 25,
    gradientTransitionPoint = 80,
    minWidth,
    style,
    onPress,
    children,
  } = props

  const { theme } = UseTheme()
  const S = useScale()

  // Memoize variant colors to prevent stale color calculations on re-enable
  const variantColors = useMemo(
    () => getVariantColors(variant, theme),
    [variant, theme]
  )

  // Reanimated shared values
  const scale = useSharedValue(1)
  const textOpacity = useSharedValue(1)
  const spinnerOpacity = useSharedValue(0)
  const hoverOpacity = useSharedValue(1)

  // Safe access: size is constrained to ButtonSize
  const sizing = S.button[size as ButtonSize]
  const paddingH = sizing.paddingHorizontal
  const height = sizing.height

  // Pre-compute all color values with proper memoization
  const isGhost = variant === 'ghost'
  
  const { backgroundColor, borderColorValue, textColorValue } = useMemo(() => {
    const baseColor = bg ?? variantColors.background
    const baseBorderColor = borderColor ?? variantColors.border
    const baseTextColor = textColor ?? variantColors.text

    const computedBgColor = disabled || loading
      ? tone(baseColor, 'disabled', undefined, undefined, theme)
      : baseColor

    const computedBorderColor = disabled || loading
      ? tone(baseBorderColor, 'disabled', undefined, undefined, theme)
      : baseBorderColor

    const computedTextColor = disabled || loading
      ? tone(baseTextColor, 'disabled', undefined, undefined, theme)
      : baseTextColor

    return {
      backgroundColor: computedBgColor,
      borderColorValue: computedBorderColor,
      textColorValue: computedTextColor,
    }
  }, [variantColors, bg, borderColor, textColor, disabled, loading, theme])

  // Reanimated style hooks
  const scaleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const textFadeStyle = useAnimatedStyle(() => ({
    opacity: textOpacity.value,
  }))

  const spinnerFadeStyle = useAnimatedStyle(() => ({
    opacity: spinnerOpacity.value,
  }))

  const hoverStyle = useAnimatedStyle(() => ({
    opacity: hoverOpacity.value,
  }))

  // Handlers
  const handlePressIn = () => {
    if (disabled || loading) return
    scale.value = withSpring(0.91, {
      damping: 10,
      mass: 1,
      overshootClamping: true,
    })
  }

  const handlePressOut = () => {
    if (disabled || loading) return
    scale.value = withSpring(1, {
      damping: 10,
      mass: 1,
      overshootClamping: true,
    })
  }

  const handlePress = () => {
    if (disabled || loading) return
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }
    onPress?.()
  }

  const handleMouseEnter = () => {
    if (disabled || loading) return
    hoverOpacity.value = withTiming(0.8, { duration: 100 })
  }

  const handleMouseLeave = () => {
    if (disabled || loading) return
    hoverOpacity.value = withTiming(1, { duration: 100 })
  }

  // Update Reanimated values when loading changes
  React.useEffect(() => {
    textOpacity.value = withTiming(loading ? 0 : 1, { duration: 250 })
    spinnerOpacity.value = withTiming(loading ? 1 : 0, { duration: 250 })
  }, [loading, textOpacity, spinnerOpacity])

  // Reset hover opacity when button becomes disabled/enabled
  React.useEffect(() => {
    if (disabled || loading) {
      hoverOpacity.value = 1
    }
  }, [disabled, loading, hoverOpacity])

  const contentView = (
    <>
      {iconLeft && !loading && (
        <View style={{ marginRight: S.space.xs }}>
          {iconLeft}
        </View>
      )}

      {text ? (
        <Animated.View style={[{ flex: 1, height: '100%', justifyContent: 'center', alignItems: 'center', padding: S.space.xs }, textFadeStyle]}>
          <ButtonText
            numberOfLines={1}
            ellipsizeMode="clip"
            style={{
              color: textColorValue,
              fontSize: sizing.font,
            }}
          >
            {text}
          </ButtonText>
        </Animated.View>
      ) : (
        children
      )}

      <Animated.View
        style={[
          spinnerFadeStyle,
          { position: 'absolute' },
        ]}
      >
        {loading && (
          <ActivityIndicator
            size="small"
            color={textColorValue}
          />
        )}
      </Animated.View>

      {iconRight && !loading && (
        <View style={{ marginLeft: S.space.xs }}>
          {iconRight}
        </View>
      )}
    </>
  )

  return (
    <Animated.View style={[scaleStyle, hoverStyle, style]}>
      <Pressable
        disabled={disabled || loading}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        onHoverIn={Platform.OS === 'web' ? handleMouseEnter : undefined}
        onHoverOut={Platform.OS === 'web' ? handleMouseLeave : undefined}
      >
        {isGhost ? (
          // Ghost variant: No gradient, simple centered container
          <View
            style={{
              height,
              paddingHorizontal: paddingH,
              borderRadius: S.radius.md,
              borderColor: borderColorValue,
              borderWidth: 3,
              backgroundColor: 'transparent',
              overflow: 'hidden',
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              //...getShadowStyle('softer'),
            }}
          >
            {contentView}
          </View>
        ) : (
          // All other variants: Use ButtonView with gradient support
          <ButtonView
            height={height}
            paddingHorizontal={paddingH}
            backgroundColor={backgroundColor}
            borderColor={borderColorValue}
            gradient={gradient}
            gradientDirection={gradientDirection}
            gradientTransitionPoint={gradientTransitionPoint}
            gradientIntensity={gradientIntensity}
            style={minWidth ? { minWidth: minWidth as number } : undefined}
          >
            {contentView}
          </ButtonView>
        )}
      </Pressable>
    </Animated.View>
  )
}