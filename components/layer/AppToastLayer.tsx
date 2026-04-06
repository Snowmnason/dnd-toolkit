/**
 * AppToastLayer Component
 * 
 * Owns positioning, animation, and auto-dismiss for global toasts.
 * Renders one toast at a time from the centralized queue (AppToastContext).
 * AppToast is pure visual — this layer handles everything else.
 * 
 * Pattern modeled after NotificationContainer:
 * - Absolute positioning (top-right on desktop)
 * - Enter/exit animations via Reanimated
 * - No full-screen wrapper (no pointer-event blocking)
 */

import { useAppToast } from '@/contexts/app-toast-context'
import { useScale } from '@/theme'
import { Pressable } from 'react-native'
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated'
import { AppToast } from '../ui/AppToast'

export function AppToastLayer() {
  const { toast, hide } = useAppToast()
  const S = useScale()

  if (!toast.visible) return null

  return (
    <Animated.View
      entering={FadeInDown.duration(300).springify().damping(0.8)}
      exiting={FadeOutUp.duration(200)}
      style={{
        position: 'absolute',
        top: S.space.xxl * 2,
        right: S.space.xl * 2,
        zIndex: 9999,
        pointerEvents: 'box-none' as const,
      }}
    >
      <Pressable
        onPress={hide}
        pointerEvents="auto"
      >
        <AppToast
          title={toast.title}
          message={toast.message}
          type={toast.type}
        />
      </Pressable>
    </Animated.View>
  )
}
