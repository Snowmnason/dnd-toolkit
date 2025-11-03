import { $, tone, useScale, UseTheme } from '@/theme'
import * as Haptics from 'expo-haptics'
import React from 'react'
import {
  ActivityIndicator,
  Platform,
  StyleProp,
  TouchableOpacity,
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
import { GradientView } from './Resuables/GradientView'
import { getShadowStyle } from './Resuables/shadows'

// Apply alpha to a color string (hex/rgb/rgba) for one-off usage without changing theme tokens
function withOpacity(color: string, alpha: number): string {
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
   🔘 Types
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

interface ButtonProps {
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
  gradientIntensity?: 'subtle' | 'moderate' | 'dramatic'
  style?: StyleProp<ViewStyle>
  onPress?: () => void
  children?: React.ReactNode
}

/* ───────────────────────────────
   🎨 Variant Styles
──────────────────────────────── */
function getVariantColors(variant: ButtonVariant, theme: any) {
  switch (variant) {
    case 'secondary':
      return {
        background: withOpacity($('primary', theme), 0.15),
        border: $('primary', theme),
        text: $('textPrimary', theme),
        //hover: tone($('secondaryButtonBg', theme), 'hover', undefined, undefined, theme),
      }
    case 'destructive':
      return {
        background: $('destructiveButton', theme),
        border: tone($('destructiveButton', theme), 'border', undefined, undefined, theme),
        text: $('destructiveButtonText', theme),
        //hover: tone($('destructiveButton', theme), 'hover', undefined, undefined, theme),
      }
    case 'ghost':
      return {
        background: 'transparent',
        border: 'transparent',
        text: $('primary', theme),
        //hover: 'transparent',
      }
    case 'solid':
      return {
        background: $('accent', theme),
        border: $('primary', theme),
        text: $('primary', theme),
        //hover: tone($('solidOutButton', theme), 'hover', undefined, undefined, theme),
      }
    case 'outlined':
      return {
        background: 'transparent',
        border: tone($('accent', theme), 'border', undefined, undefined, theme),
        text: $('primary', theme),
        //hover: tone($('solidOutButton', theme), 'hover', undefined, undefined, theme),
      }
    case 'cancel':
      return {
        background: $('cancelButton', theme),
        border: tone($('cancelButton', theme), 'border', undefined, undefined, theme),
        text: $('cancelButtonText', theme),
        //hover: tone($('cancelButton', theme), 'hover', undefined, undefined, theme),
      }
    case 'primary':
    default:
      return {
        background: $('bgInverse', theme),
        border: $('accent', theme),
        text: $('primaryButtonText', theme),
        //hover: tone($('primaryButtonBg', theme), 'hover', undefined, undefined, theme),
      }
  }
}

/* ───────────────────────────────
   🪄 Base Button
──────────────────────────────── */
export function Button({
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
  gradientIntensity = 'subtle',
  style,
  onPress,
  children,
}: ButtonProps) {
  const { theme } = UseTheme()
  const S = useScale()
  const scale = useSharedValue(1)
  const hovered = useSharedValue(0)

  const colors = getVariantColors(variant, theme)
  const sizing = S.button[size]
  const paddingH = sizing.paddingHorizontal
  const height = sizing.height

  // Pre-compute all color values with theme to avoid calling hooks in worklets
  const isGhost = variant === 'ghost'
  const baseColor = bg ?? colors.background
  // Hover overlay color: primary uses background; others use bgInverse (ghost has no overlay)
  const baseHoverColor = !isGhost
    ? withOpacity($(variant === 'primary' ? 'background' : 'bgInverse', theme), 0.65)
    : baseColor
  
  const backgroundColor = disabled || loading 
    ? tone(baseColor, 'disabled', undefined, undefined, theme)
    : baseColor
  
  const borderColorValue = disabled || loading
    ? tone(borderColor ?? colors.border, 'disabled', undefined, undefined, theme)
    : tone(borderColor ?? colors.border, 'border', undefined, undefined, theme)
  
  const textColorValue = disabled || loading
    ? tone(textColor ?? colors.text, 'disabled', undefined, undefined, theme)
    : (textColor ?? colors.text)

  const handlePressIn = () => {
    if (disabled || loading) return
    scale.value = withSpring(0.91)
  }

  const handlePressOut = () => {
    if (disabled || loading) return
    scale.value = withSpring(1)
  }

  const handlePress = () => {
    if (disabled || loading) return
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    }
    onPress?.()
  }

  const handleMouseEnter = () => {
    if (disabled || loading || Platform.OS !== 'web') return
    // Smooth hover fade-in
    hovered.value = withTiming(1, { duration: 180 })
  }

  const handleMouseLeave = () => {
    if (disabled || loading || Platform.OS !== 'web') return
    // Smooth hover fade-out
    hovered.value = withTiming(0, { duration: 120 })
  }

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  // Disabled opacity hover - using slide overlay instead
  const hoverStyle = useAnimatedStyle(() => ({
    opacity: 1,
  }))

  // Smooth fade transition between spinner and text
  const fadeStyle = useAnimatedStyle(() => ({
    opacity: withTiming(loading ? 0 : 1, { duration: 250 }),
  }))
  const spinnerStyle = useAnimatedStyle(() => ({
    opacity: withTiming(loading ? 1 : 0, { duration: 250 }),
  }))

  // Hover overlay that instantly appears (no animation)
  const hoverOverlayStyle = useAnimatedStyle(() => {
    return {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: baseHoverColor,
      borderRadius: S.radius.md - 2,
      opacity: hovered.value,
      zIndex: 9,
      // Web paint hint + move pointer-events to style to avoid RNW deprecation warning
      ...(Platform.OS === 'web'
        ? ({ willChange: 'opacity', pointerEvents: 'none' } as any)
        : {}),
    }
  })

  return (
    <Animated.View style={[animatedStyle, style]}>
      <TouchableOpacity
        activeOpacity={0.9}
        disabled={disabled || loading}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          height,
          borderRadius: S.radius.md,
          borderColor: borderColorValue,
          borderWidth: 3,
          overflow: 'hidden',
          ...getShadowStyle('softer'),
        }}
      >
        {isGhost ? (
          // Ghost variant: No gradient, just hover effect
          <Animated.View
            style={[
              hoverStyle,
              {
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                paddingHorizontal: paddingH,
              },
            ]}
          >
            {iconLeft && !loading && (
              <View style={{ marginRight: S.space.xs }}>{iconLeft}</View>
            )}

            <Animated.View style={fadeStyle}>
              {text ? (
                <ButtonText
                  style={{
                    color: textColorValue,
                    fontSize: sizing.font,
                    zIndex: 10,
                  }}
                >
                  {text}
                </ButtonText>
              ) : (
                children
              )}
            </Animated.View>

            <Animated.View style={[spinnerStyle, { position: 'absolute' }]}>
              {loading && (
                <ActivityIndicator
                  size="small"
                  color={textColorValue}
                />
              )}
            </Animated.View>

            {iconRight && !loading && (
              <View style={{ marginLeft: S.space.xs }}>{iconRight}</View>
            )}
          </Animated.View>
        ) : (
          // All other variants: Gradient with hover
          <Animated.View style={[hoverStyle, { height: '100%', position: 'relative', overflow: 'hidden' }]}>
            {/* Background gradient layer */}
            <GradientView
              baseColor={backgroundColor}
              intensity={gradientIntensity}
              borderRadius={S.radius.md - 2}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                zIndex: 0,
              }}
            />
            
            {/* Hover color overlay */}
            <Animated.View style={hoverOverlayStyle} />
            
            {/* Content layer - always on top */}
            <View style={{
              flex: 1,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingHorizontal: paddingH,
              zIndex: 20,
            }}>
              {iconLeft && !loading && (
                <View style={{ marginRight: S.space.xs }}>{iconLeft}</View>
              )}

              <Animated.View style={fadeStyle}>
                {text ? (
                  <ButtonText
                    style={{
                      color: textColorValue,
                      fontSize: sizing.font,
                    }}
                  >
                    {text}
                  </ButtonText>
                ) : (
                  children
                )}
              </Animated.View>

              <Animated.View style={[spinnerStyle, { position: 'absolute' }]}>
                {loading && (
                  <ActivityIndicator
                    size="small"
                    color={textColorValue}
                  />
                )}
              </Animated.View>

              {iconRight && !loading && (
                <View style={{ marginLeft: S.space.xs }}>{iconRight}</View>
              )}
            </View>
          </Animated.View>
        )}
      </TouchableOpacity>
    </Animated.View>
  )
}