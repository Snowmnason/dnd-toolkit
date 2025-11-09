import { usePlatform } from '@/contexts/PlatformContext'
import { $, useScale } from '@/theme'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useEffect, useMemo } from 'react'
import { Platform, Pressable, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Body, Caption } from './AppText'
import { getShadowStyle } from './Resuables/shadows'

export type NotificationType = 'message' | 'update' | 'alert' | 'info'

export interface NotificationData {
  id: string
  type: NotificationType
  title: string
  message: string
  timestamp?: Date
  avatar?: string // URL or icon name
  onPress?: () => void
  onDismiss?: () => void
}

interface NotificationProps extends NotificationData {
  visible: boolean
  index?: number // For stacking multiple notifications
}

/**
 * 🔔 Notification
 * Platform-aware notification banner for messages, updates, and alerts.
 * - Desktop: Top-right corner, stacks vertically
 * - Mobile: Top-center (keyboard-safe), stacks vertically
 */
export function Notification({
  visible,
  type,
  title,
  message,
  timestamp,
  avatar,
  onPress,
  onDismiss,
  index = 0,
}: NotificationProps) {
  const S = useScale()
  const { isMobile } = usePlatform()
  const insets = useSafeAreaInsets()

  // Reanimated shared values
  const translateY = useSharedValue(-200)
  const opacity = useSharedValue(0)

  // Icon based on type
  const iconName = 
    type === 'message' ? 'chatbubble' :
    type === 'update' ? 'refresh-circle' :
    type === 'alert' ? 'warning' :
    'information-circle'

  const iconColor = useMemo(() => 
    type === 'message' ? $('accent') :
    type === 'update' ? $('info') :
    type === 'alert' ? $('warning') :
    $('textSecondary'),
  [type])

  const surfaceColor = useMemo(() => $('surface'), [])
  const borderColor = useMemo(() => $('borderSubtle' as any), [])
  const dismissIconColor = useMemo(() => $('textSecondary'), [])

  // Slide animation
  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, { damping: 10, stiffness: 200, mass: 0.8 })
      opacity.value = withTiming(1, { duration: 300 })

      // Haptic feedback (native only)
      if (Platform.OS !== 'web') {
        if (type === 'alert') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)
        } else {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
        }
      }
    } else {
      // Animate out
      opacity.value = withTiming(0, { duration: 200 })
      translateY.value = withTiming(-200, { duration: 200 })
    }
  }, [visible, type, translateY, opacity])

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }))

  if (!visible) return null

  const handlePress = () => {
    if (onPress) {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)
      }
      onPress()
    }
  }

  const handleDismiss = () => {
    if (onDismiss) {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
      }
      onDismiss()
    }
  }

  // Calculate vertical offset for stacking
  const stackOffset = index * (isMobile ? 90 : 100)
  const baseTop = isMobile ? insets.top + 12 : 80

  return (
    <Animated.View
      style={[
        {
          position: 'absolute',
          top: baseTop + stackOffset,
          left: isMobile ? S.space.lg : '5%',
          right: isMobile ? S.space.lg : '5%',
          zIndex: 9999 - index,
          pointerEvents: 'box-none' as const,
        },
        animatedStyle,
      ]}
    >
      <Pressable onPress={handlePress} disabled={!onPress}>
        <View
          style={{
            backgroundColor: surfaceColor,
            opacity: 0.95,
            borderRadius: S.radius.lg,
            borderWidth: 2,
            borderColor: borderColor,
            ...getShadowStyle('combined'),
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'flex-start',
              gap: S.space.sm,
              paddingHorizontal: S.space.md,
              paddingVertical: S.space.sm,
            }}
          >
            {/* Icon */}
            <View
              style={{
                alignItems: 'center',
                justifyContent: 'center',
                paddingTop: 2,
                minWidth: 24,
              }}
            >
              <Ionicons name={iconName as any} size={24} color={iconColor} />
            </View>

            {/* Text content */}
            <View style={{ flex: 1 }}>
              <Body
                fontWeight="600"
                textType="primary"
                style={{ marginBottom: 2 }}
                numberOfLines={1}
              >
                {title}
              </Body>
              <Caption
                textType="secondary"
                style={{ lineHeight: 16 }}
                numberOfLines={2}
              >
                {message}
              </Caption>
              {timestamp && (
                <Caption
                  textType="secondary"
                  opacity={0.6}
                  style={{ marginTop: 4, fontSize: S.font.caption - 1 }}
                >
                  {formatTimestamp(timestamp)}
                </Caption>
              )}
            </View>

            {/* Dismiss button */}
            <Pressable
              onPress={handleDismiss}
              style={{ padding: S.space.xs, marginLeft: 'auto' }}
              hitSlop={8}
            >
              <Ionicons
                name="close"
                size={18}
                color={dismissIconColor}
              />
            </Pressable>
          </View>
        </View>
      </Pressable>
    </Animated.View>
  )
}

/**
 * Format timestamp to relative time
 */
function formatTimestamp(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  return date.toLocaleDateString()
}
