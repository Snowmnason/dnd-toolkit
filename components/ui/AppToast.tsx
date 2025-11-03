import { $, useScale, UseTheme } from '@/theme';
import React, { useEffect } from 'react';
import { StyleSheet, Text } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets'; // ✅ new import
import { GradientView } from './Resuables/GradientView';
import { getShadowStyle } from './Resuables/shadows';

type ToastType = 'info' | 'success' | 'error' | 'warning'

interface AppToastProps {
  message: string
  type?: ToastType
  visible?: boolean
  duration?: number // ms
  onHide?: () => void
}

/**
 * 🪶 AppToast
 * Appears temporarily, fades/slides up, auto-dismisses.
 */
export function AppToast({
  message,
  type = 'info',
  visible = false,
  duration = 2500,
  onHide,
}: AppToastProps) {
  const { theme } = UseTheme()
  const S = useScale()
  const opacity = useSharedValue(0)
  const translateY = useSharedValue(-30)

  useEffect(() => {
    if (visible) {
      // Animate in: fade + slide down from top
      opacity.value = withTiming(1, { duration: 200 })
      translateY.value = withTiming(0, { duration: 200 })
      
      const timeout = setTimeout(() => {
        // Animate out: fade + slide up (reverse)
        opacity.value = withTiming(0, { duration: 200 })
        translateY.value = withTiming(-30, { duration: 200 }, () => {
          if (onHide) scheduleOnRN(onHide)
        })
      }, duration)
      return () => clearTimeout(timeout)
    } else {
      // Reset to initial state when not visible
      opacity.value = 0
      translateY.value = -30
    }
  }, [visible, duration, onHide, opacity, translateY]) // ✅ include deps

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }))

  const background =
    type === 'success'
      ? $('success', theme)
      : type === 'error'
      ? $('danger', theme)
      : type === 'warning'
      ? $('warning', theme)
      : $('info', theme)

  return (
  <Animated.View style={[styles.container, { top: S.space.xl, right: S.space.xl }, animatedStyle]}>
      <GradientView
        baseColor={background}
        intensity="moderate"
        direction='top-to-bottom'
        fadeToTransparent={true}
        borderRadius={S.radius.md}
        style={{
          borderColor: background,
          borderWidth: 3,
          paddingHorizontal: S.space.lg,
          paddingVertical: S.space.md,
          ...getShadowStyle('softer'),
        }}
      >
        <Text style={[styles.text, { color: $('textPrimary', theme), fontSize: S.font.subtitle }]}>
          {message}
        </Text>
      </GradientView>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    zIndex: 9999,
  },
  toast: {
    ...getShadowStyle('softer'),
  },
  text: {
    fontWeight: '600',
  },
})

// dynamic spacing and radius applied inline via S
