import { $, S, tone } from '@/theme'
import * as Haptics from 'expo-haptics'
import React, { useEffect, useRef } from 'react'
import { Animated, Pressable, Text } from 'react-native'

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
  const translateY = useRef(new Animated.Value(100)).current
  const opacity = useRef(new Animated.Value(0)).current

  // tone color mapping
  const bgColor =
    toneType === 'success'
      ? tone($('accent'), 'alt')
      : toneType === 'error'
      ? tone($('destructiveButton'), 'alt')
      : toneType === 'warning'
      ? tone($('warning'), 'alt')
      : tone($('surface'), 'accent')

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

      // Auto-hide
      const timer = setTimeout(() => onHide?.(), duration)
      return () => clearTimeout(timer)
    } else {
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
      ]).start()
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
        backgroundColor: bgColor,
        borderRadius: S.radius.lg,
        paddingVertical: S.space.sm,
        paddingHorizontal: S.space.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        shadowColor: $('shadow'),
        shadowOpacity: 0.35,
        shadowRadius: 8,
        elevation: 3,
      }}
    >
      <Text
        style={{
          color: $('textPrimary'),
          fontSize: S.font.sm,
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
              color: $('accent'),
              fontWeight: '600',
              marginLeft: S.space.md,
            }}
          >
            {actionText}
          </Text>
        </Pressable>
      )}
    </Animated.View>
  )
}
