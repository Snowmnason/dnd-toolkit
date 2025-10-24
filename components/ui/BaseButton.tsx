import { $, S, tone, UseTheme } from '@/theme'
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
function getVariantColors(variant: ButtonVariant) {
  switch (variant) {
    case 'secondary':
      return {
        background: $('secondaryButtonBg'),
        border: $('secondaryButtonBorder'),
        text: $('secondaryButtonText'),
        hover: tone($('secondaryButtonBg'), 'hover'),
      }
    case 'destructive':
      return {
        background: $('destructiveButton'),
        border: tone($('destructiveButton'), 'border'),
        text: $('destructiveButtonText'),
        hover: tone($('destructiveButton'), 'hover'),
      }
    case 'ghost':
      return {
        background: 'transparent',
        border: 'transparent',
        text: $('ghostButtonText'),
        hover: 'transparent',
      }
    case 'solid':
      return {
        background: $('solidOutButton'),
        border: 'transparent',
        text: $('solidOutButtonText'),
        hover: tone($('solidOutButton'), 'hover'),
      }
    case 'outlined':
      return {
        background: 'transparent',
        border: tone($('solidOutButton'), 'border'),
        text: $('solidOutButtonText'),
        hover: tone($('solidOutButton'), 'hover'),
      }
    case 'cancel':
      return {
        background: $('cancelButton'),
        border: tone($('cancelButton'), 'border'),
        text: $('cancelButtonText'),
        hover: tone($('cancelButton'), 'hover'),
      }
    case 'primary':
    default:
      return {
        background: $('primaryButtonBg'),
        border: $('primaryButtonBorder'),
        text: $('primaryButtonText'),
        hover: tone($('primaryButtonBg'), 'hover'),
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { theme: _theme } = UseTheme()
  const scale = useSharedValue(1)
  const hovered = useSharedValue(0)

  const colors = getVariantColors(variant)
  const sizing = S.button[size]
  const paddingH = sizing.paddingHorizontal
  const height = sizing.height

  const getColor = (color: string, type?: 'hover' | 'border') => {
    if (disabled || loading) return tone(color, 'disabled')
    if (type === 'hover') return tone(color, 'hover')
    if (type === 'border') return tone(color, 'border')
    return color
  }

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
    hovered.value = withTiming(1, { duration: 150 })
  }

  const handleMouseLeave = () => {
    if (disabled || loading || Platform.OS !== 'web') return
    hovered.value = withTiming(0, { duration: 150 })
  }

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }))

  const hoverStyle = useAnimatedStyle(() => ({
    backgroundColor: hovered.value
      ? getColor(bg ?? colors.hover, 'hover')
      : getColor(bg ?? colors.background),
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
          borderColor: getColor(borderColor ?? colors.border, 'border'),
          borderWidth: 1,
        }}
      >
        <Animated.View
          style={[
            hoverStyle,
            { ...StyleSheet.absoluteFillObject, borderRadius: S.radius.md },
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
                  color: getColor(textColor ?? colors.text),
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
                color={getColor(textColor ?? colors.text)}
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