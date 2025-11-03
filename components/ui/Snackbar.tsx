import { $, useScale, UseTheme } from '@/theme'
import * as Haptics from 'expo-haptics'
import React, { useEffect, useRef } from 'react'
import { Animated, Pressable, Text } from 'react-native'
import { GradientView } from './Resuables/GradientView'
import { getShadowStyle } from './Resuables/shadows'

interface SnackBarProps {
  visible: boolean
  message: string
  tone?: 'success' | 'warning' | 'error' | 'info'
  duration?: number
  actionText?: string
  onAction?: () => void
  onHide?: () => void
}

/**
 * 🍫 SnackBar
 * Bottom-anchored alert bar with optional action button and tone support.
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
  const translateY = useRef(new Animated.Value(100)).current
  const opacity = useRef(new Animated.Value(0)).current

  // feedback color mapping
  const bgColor =
    toneType === 'success'
      ? $('success', theme)
      : toneType === 'error'
      ? $('danger', theme)
      : toneType === 'warning'
      ? $('warning', theme)
      : $('info', theme)

  // Slide animation
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          friction: 6,
          useNativeDriver: true,
        }),
      ]).start()

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
        Animated.parallel([
          Animated.timing(opacity, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
          Animated.timing(translateY, {
            toValue: 100,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start(() => {
          onHide?.()
        })
      }, duration)
      return () => clearTimeout(timer)
    } else {
      // Reset to initial state when not visible
      translateY.setValue(100)
      opacity.setValue(0)
    }
  }, [visible, toneType, duration, onHide, opacity, translateY])

  if (!visible) return null

  return (
    <Animated.View
      style={{
        position: 'absolute',
        bottom: S.space.xl,
        left: S.space.lg,
        right: S.space.lg,
        transform: [{ translateY }],
        opacity,
      }}
    >
      <GradientView
        baseColor={bgColor}
        intensity="moderate"
        borderRadius={S.radius.lg}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingVertical: S.space.sm,
          paddingHorizontal: S.space.md,
          ...getShadowStyle('softer'),
        }}
      >
        <Text
          style={{
            color: $('textPrimary', theme),
            fontSize: S.font.para,
            flex: 1,
          }}
        >
          {message}
        </Text>

        {actionText && (
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
              onAction?.()
            }}
          >
            <Text
              style={{
                color: $('accent', theme),
                fontWeight: '600',
                marginLeft: S.space.md,
              }}
            >
              {actionText}
            </Text>
          </Pressable>
        )}
      </GradientView>
    </Animated.View>
  )
}
