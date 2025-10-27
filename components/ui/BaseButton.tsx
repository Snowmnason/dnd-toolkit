import { $, tone, useScale, UseTheme } from '@/theme'
import * as Haptics from 'expo-haptics'
import React from 'react'
import {
  ActivityIndicator,
  Platform,
  StyleProp,
  StyleSheet,
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
        background: $('secondaryButtonBg', theme),
        border: $('secondaryButtonBorder', theme),
        text: $('secondaryButtonText', theme),
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
        background: $('solidOutButton', theme),
        border: 'transparent',
        text: $('primary', theme),
        //hover: tone($('solidOutButton', theme), 'hover', undefined, undefined, theme),
      }
    case 'outlined':
      return {
        background: 'transparent',
        border: tone($('solidOutButton', theme), 'border', undefined, undefined, theme),
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
        background: $('primaryButtonBg', theme),
        border: $('primaryButtonBorder', theme),
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
  const backgroundColor = disabled || loading 
    ? tone(bg ?? colors.background, 'disabled', undefined, undefined, theme)
    : (bg ?? colors.background)
  
  const backgroundColorHover = disabled || loading
    ? tone(bg ?? colors.background, 'disabled', undefined, undefined, theme)
    : tone(bg ?? colors.background, 'hover', undefined, undefined, theme)
  
  const borderColorValue = disabled || loading
    ? tone(borderColor ?? colors.border, 'disabled', undefined, undefined, theme)
    : tone(borderColor ?? colors.border, 'border', undefined, undefined, theme)
  
  const textColorValue = disabled || loading
    ? tone(textColor ?? colors.text, 'disabled', undefined, undefined, theme)
    : (textColor ?? colors.text)

  const handlePressIn = () => {
    if (disabled || loading) return
    scale.value = withSpring(0.96)
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
    hovered.value = withTiming(1, { duration: 50 })
  }

  const handleMouseLeave = () => {
    if (disabled || loading || Platform.OS !== 'web') return
    hovered.value = withTiming(0, { duration: 50 })
  }

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const hoverStyle = useAnimatedStyle(() => ({
    backgroundColor: hovered.value ? backgroundColorHover : backgroundColor,
  }))

  // Smooth fade transition between spinner and text
  const fadeStyle = useAnimatedStyle(() => ({
    opacity: withTiming(loading ? 0 : 1, { duration: 150 }),
  }))
  const spinnerStyle = useAnimatedStyle(() => ({
    opacity: withTiming(loading ? 1 : 0, { duration: 150 }),
  }))

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
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          height,
          paddingHorizontal: paddingH,
          borderRadius: S.radius.md,
          borderColor: borderColorValue,
          borderWidth: 2,
        }}
      >
        <Animated.View
          style={[
            hoverStyle,
            { ...StyleSheet.absoluteFillObject, borderRadius: (S.radius.md - 2) },
          ]}
        />

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
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
      </TouchableOpacity>
    </Animated.View>
  )
}