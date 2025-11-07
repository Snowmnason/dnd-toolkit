import { usePlatform } from '@/contexts/PlatformContext'
import { $, useScale, UseTheme } from '@/theme'
import { Ionicons } from '@expo/vector-icons'
import * as Haptics from 'expo-haptics'
import { useEffect, useRef } from 'react'
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Body, Caption } from './AppText'
import { GradientView } from './Resuables/gradients'
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
  const { theme } = UseTheme()
  const S = useScale()
  const { isMobile } = usePlatform()
  const insets = useSafeAreaInsets()
  // Solid surface background
  
  const translateY = useRef(new Animated.Value(-200)).current
  const opacity = useRef(new Animated.Value(0)).current
  const nativeDriver = Platform.OS !== 'web'

  // Icon based on type
  const iconName = 
    type === 'message' ? 'chatbubble' :
    type === 'update' ? 'refresh-circle' :
    type === 'alert' ? 'warning' :
    'information-circle'

  const iconColor = 
    type === 'message' ? $('accent', theme) :
    type === 'update' ? $('info', theme) :
    type === 'alert' ? $('warning', theme) :
    $('textSecondary', theme)

  // Slide animation
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: nativeDriver,
        }),
        Animated.spring(translateY, {
          toValue: 0,
          friction: 8,
          tension: 80,
          useNativeDriver: nativeDriver,
        }),
      ]).start()

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
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 200,
          useNativeDriver: nativeDriver,
        }),
        Animated.timing(translateY, {
          toValue: -200,
          duration: 200,
          useNativeDriver: nativeDriver,
        }),
      ]).start()
    }
  }, [visible, type, opacity, translateY, nativeDriver])

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
  const stackOffset = index * (isMobile ? 90 : 100) // Slightly tighter on mobile
  const baseTop = (isMobile ? insets.top + 12 : 80)

  return (
    <Animated.View
      style={[
        styles.container,
        isMobile ? styles.containerMobile : styles.containerDesktop,
        {
          // Use base top + stackOffset to avoid Animated.add(number) on native
          top: baseTop + stackOffset,
          // On mobile span with insets; on desktop keep right-anchored
          left: isMobile ? S.space.lg : undefined,
          right: isMobile ? S.space.lg : undefined,
          transform: [
            { translateY }
          ],
          opacity,
          // Stacking z-index: higher index = lower z-index (appear behind)
          zIndex: 9999 - index,
          // Avoid blocking touches outside the banner
          pointerEvents: 'box-none' as const,
        },
      ]}
    >
      <Pressable onPress={handlePress} disabled={!onPress}>
        <GradientView
          enabled={true}
          color={$('surface', theme) as any}
          direction={0}
          transitionPoint={30}
          intensity={15}
          opacity={0.2}
          style={[
            styles.notification,
            {
              borderRadius: S.radius.lg,
              paddingHorizontal: S.space.md,
              paddingVertical: S.space.sm,
              minWidth: isMobile ? undefined : 320,
              maxWidth: isMobile ? undefined : 400,
              ...getShadowStyle('combined'),
              borderWidth: 2,
              borderColor: $('borderSubtle' as any, theme),
            },
          ]}
        >
          <View style={styles.content}>
            {/* Icon */}
            <View style={[styles.iconContainer, { marginRight: S.space.sm }]}>
              <Ionicons name={iconName as any} size={24} color={iconColor} />
            </View>

            {/* Text content */}
            <View style={styles.textContainer}>
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
              style={[styles.dismissButton, { padding: S.space.xs }]}
              hitSlop={8}
            >
              <Ionicons
                name="close"
                size={18}
                color={$('textSecondary', theme)}
              />
            </Pressable>
          </View>
        </GradientView>
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

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
  },
  containerDesktop: {
    top: 80, // Below top bar
    right: 16,
  },
  containerMobile: {
    top: 60, // Below mobile header
    left: 16,
    right: 16,
  },
  notification: {
    flexDirection: 'column',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  iconContainer: {
    paddingTop: 2, // Align with text baseline
  },
  textContainer: {
    flex: 1,
    marginRight: 8,
  },
  dismissButton: {
    marginLeft: 'auto',
  },
})
