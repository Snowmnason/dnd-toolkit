/**
 * SnackBarLayer Component
 * 
 * Owns positioning, animation, and auto-dismiss for global snackbars.
 * Renders one snackbar at a time from the centralized queue (AppSnackbarContext).
 * SnackBar is pure visual — this layer handles everything else.
 * 
 * Pattern modeled after AppToastLayer / NotificationContainer:
 * - Absolute positioning (bottom, keyboard-aware)
 * - Enter/exit animations via Reanimated
 * - No full-screen wrapper (no pointer-event blocking)
 */

import { useAppSnackbar } from '@/contexts/app-snackbar-context'
import { useScale } from '@/theme'
import * as Haptics from 'expo-haptics'
import { useEffect, useState } from 'react'
import { Keyboard, Platform, Pressable } from 'react-native'
import Animated, { FadeInUp, FadeOutDown } from 'react-native-reanimated'
import { SnackBar } from '../ui/Snackbar'

export function SnackBarLayer() {
  const { snackbar, hide } = useAppSnackbar()
  const S = useScale()
  const [keyboardHeight, setKeyboardHeight] = useState(0)

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

  // Haptic feedback when snackbar appears
  useEffect(() => {
    if (snackbar.visible && Platform.OS !== 'web') {
      Haptics.notificationAsync(
        snackbar.tone === 'success'
          ? Haptics.NotificationFeedbackType.Success
          : snackbar.tone === 'error'
          ? Haptics.NotificationFeedbackType.Error
          : Haptics.NotificationFeedbackType.Warning
      )
    }
  }, [snackbar.visible, snackbar.tone])

  if (!snackbar.visible) return null

  return (
    <Animated.View
      entering={FadeInUp.duration(250).springify().damping(0.8)}
      exiting={FadeOutDown.duration(200)}
      style={{
        position: 'absolute',
        bottom: keyboardHeight + S.space.xl,
        left: S.space.lg,
        right: S.space.lg,
        zIndex: 9999,
        pointerEvents: 'box-none' as const,
      }}
    >
      <Pressable
        onPress={hide}
        pointerEvents="auto"
      >
        <SnackBar
          message={snackbar.message}
          tone={snackbar.tone}
          actionText={snackbar.actionText}
          onAction={snackbar.onAction}
        />
      </Pressable>
    </Animated.View>
  )
}
