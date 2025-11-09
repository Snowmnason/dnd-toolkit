import { $, useScale, UseTheme } from '@/theme'
import * as Haptics from 'expo-haptics'
import { useEffect, useState } from 'react'
import { Keyboard, Pressable, Text, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { Paragraph } from './AppText'
import { getShadowStyle } from './Resuables/shadows'

interface SnackBarProps {
  visible: boolean
  message: string
  tone?: 'success' | 'warning' | 'error' | 'info'
  duration?: number
  actionText?: string // Optional action text (e.g., "Undo", "Retry")
  onAction?: () => void // Optional action handler
  onHide?: () => void
}

/**
 * 🍫 SnackBar
 * Platform-aware alert bar with optional action button and tone support.
 * - Always bottom-anchored (traditional snackbar)
 * - Action button is optional (e.g., "Undo", "Retry", "Saved")
 */
export function SnackBar({
  visible,
  message,
  tone: toneType = 'info',
  duration = 4000,
  actionText,
  onAction,
  onHide,
}: SnackBarProps) {
  const { theme } = UseTheme()
  const S = useScale()
  const [keyboardHeight, setKeyboardHeight] = useState(0)
  
  // Reanimated shared values
  const translateY = useSharedValue(100)
  const opacity = useSharedValue(0)

  // Keyboard listeners for mobile keyboard awareness
  useEffect(() => {
    const showListener = Keyboard.addListener('keyboardDidShow', (e) => {
      setKeyboardHeight(e.endCoordinates.height)
    })
    const hideListener = Keyboard.addListener('keyboardDidHide', () => {
      setKeyboardHeight(0)
    })
    
    return () => {
      showListener.remove()
      hideListener.remove()
    }
  }, [])

  // feedback color mapping
  const bgColor =
    toneType === 'success'
      ? $('success', theme)
      : toneType === 'error'
      ? $('danger', theme)
      : toneType === 'warning'
      ? $('warning', theme)
      : $('info', theme)

  // Animated style
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }))

  // Slide animation
  useEffect(() => {
    if (visible) {
      // Animate in
      opacity.value = withTiming(1, { duration: 250 })
      translateY.value = withSpring(0, { damping: 60 })

      // Haptic feedback
      Haptics.notificationAsync(
        toneType === 'success'
          ? Haptics.NotificationFeedbackType.Success
          : toneType === 'error'
          ? Haptics.NotificationFeedbackType.Error
          : Haptics.NotificationFeedbackType.Warning
      )

      // Auto-hide with reverse animation
      const timer = setTimeout(() => {
        opacity.value = withTiming(0, { duration: 200 })
        translateY.value = withTiming(100, { duration: 200 }, () => {
          onHide?.()
        })
      }, duration)
      return () => clearTimeout(timer)
    } else {
      // Reset to initial state when not visible
      translateY.value = 100
      opacity.value = 0
    }
  }, [visible, toneType, duration, onHide, opacity, translateY])

  if (!visible) return null

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          bottom: keyboardHeight + S.space.xl,
          left: S.space.lg,
          right: S.space.lg,
        },
        animatedStyle,
      ]}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: bgColor,
          paddingVertical: S.space.sm,
          paddingHorizontal: S.space.md,
          borderRadius: S.radius.lg,
          ...getShadowStyle('softer'),
        }}
      >
        <Paragraph style={{ flex: 1 }}>
          {message}
        </Paragraph>

        {/* Fixed action column - always reserve space */}
        <View style={{ alignItems: 'flex-end', minWidth: 80 }}>
          {actionText && onAction && (
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
                onAction()
              }}
            >
              <Text
                style={{
                  color: $('accent', theme),
                  fontWeight: '600',
                }}
              >
                {actionText}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    </Animated.View>
  )
}
