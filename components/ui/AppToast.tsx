import { $, S, tone, UseTheme } from '@/theme'
import React, { useEffect } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from 'react-native-reanimated'
import { scheduleOnRN } from 'react-native-worklets'; // ✅ new import

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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { theme: _theme } = UseTheme() // keep reactive
  const opacity = useSharedValue(0)
  const translateY = useSharedValue(30)
  const baseSurface = $('surface')

  useEffect(() => {
    if (visible) {
      opacity.value = withTiming(1, { duration: 200 })
      translateY.value = withTiming(0, { duration: 200 })
      const timeout = setTimeout(() => {
        opacity.value = withTiming(0, { duration: 200 }, () => {
          if (onHide) scheduleOnRN(onHide)
        })
      }, duration)
      return () => clearTimeout(timeout)
    }
  }, [visible, duration, onHide, opacity, translateY]) // ✅ include deps

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }))

const background =
  type === 'success'
    ? tone(baseSurface, 'accent')
    : type === 'error'
    ? tone(baseSurface, 'border')
    : tone(baseSurface, 'alt')

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <View style={[styles.toast, { backgroundColor: background }]}>
        <Text style={[styles.text, { color: $('textPrimary') }]}>{message}</Text>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    bottom: S.space.xl,
    alignSelf: 'center',
    zIndex: 9999,
  },
  toast: {
    borderRadius: S.radius.md,
    paddingHorizontal: S.space.lg,
    paddingVertical: S.space.md,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    elevation: 5,
  },
  text: {
    fontSize: S.font.md,
    fontWeight: '600',
  },
})
