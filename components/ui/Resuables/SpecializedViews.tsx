import { Sizing, useScale } from '@/theme'
import { ReactNode } from 'react'
import { StyleProp, View, ViewStyle } from 'react-native'
import { getShadowStyle, ShadowMode } from './shadows'

/* ───────────────────────────────
   📋 GroupView
   Container for form groups (radio, toggle, input, etc.)
   - Simple layout container
   - No gradients
   - Border and padding support
──────────────────────────────── */

export interface GroupViewProps {
  /** Gap between items */
  gap?: keyof Sizing['space']
  /** Padding */
  padding?: keyof Sizing['space']
  /** Border width */
  borderWidth?: number
  /** Border color */
  borderColor?: string
  /** Border radius key */
  borderRadius?: keyof Sizing['radius']
  /** Background color */
  backgroundColor?: string
  /** Flex direction */
  direction?: 'row' | 'column'
  /** Enable wrapping for row layouts */
  wrap?: boolean
  /** Justify content alignment */
  justifyContent?: 'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly'
  /** Align items */
  alignItems?: 'flex-start' | 'center' | 'flex-end' | 'stretch'
  /** Additional styles */
  style?: StyleProp<ViewStyle>
  /** Group content */
  children?: ReactNode
}

/**
 * 📋 GroupView - Simple container for form groups
 * Never uses gradients - just clean layout container
 */
export function GroupView({
  gap = 'md',
  padding,
  borderWidth = 0,
  borderColor = 'transparent',
  borderRadius = 'md',
  backgroundColor = 'transparent',
  direction = 'column',
  wrap = false,
  justifyContent,
  alignItems,
  style,
  children,
}: GroupViewProps) {
  const S = useScale()

  return (
    <View
      style={[
        {
          flexDirection: direction,
          flexWrap: wrap ? 'wrap' : 'nowrap',
          gap: S.space[gap],
          padding: padding ? S.space[padding] : undefined,
          borderWidth,
          borderColor,
          borderRadius: S.radius[borderRadius],
          backgroundColor,
          justifyContent,
          alignItems,
        },
        style,
      ]}
    >
      {children}
    </View>
  )
}

/* ───────────────────────────────
   📣 NotificationView
   Container for notification/snackbar components
   - Solid background (no gradient)
   - Border and shadow support
   - Flex row layout
──────────────────────────────── */

export interface NotificationViewProps {
  /** Background color */
  backgroundColor: string
  /** Border color */
  borderColor?: string
  /** Border width */
  borderWidth?: number
  /** Border radius key */
  borderRadius?: keyof Sizing['radius']
  /** Padding horizontal */
  paddingHorizontal?: keyof Sizing['space']
  /** Padding vertical */
  paddingVertical?: keyof Sizing['space']
  /** Opacity */
  opacity?: number
  /** Shadow mode */
  shadow?: ShadowMode
  /** Additional styles */
  style?: StyleProp<ViewStyle>
  /** Notification content */
  children?: ReactNode
}

/**
 * 📣 NotificationView - Container for notifications and snackbars
 * Simple solid backgrounds, no gradients
 */
export function NotificationView({
  backgroundColor,
  borderColor,
  borderWidth = 2,
  borderRadius = 'lg',
  paddingHorizontal = 'md',
  paddingVertical = 'sm',
  opacity,
  shadow = 'combined',
  style,
  children,
}: NotificationViewProps) {
  const S = useScale()

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'flex-start',
          backgroundColor,
          borderWidth,
          borderColor,
          borderRadius: S.radius[borderRadius],
          paddingHorizontal: S.space[paddingHorizontal],
          paddingVertical: S.space[paddingVertical],
          opacity,
          ...getShadowStyle(shadow),
        },
        style,
      ]}
    >
      {children}
    </View>
  )
}

/* ───────────────────────────────
   🔘 SwitchContainerView
   Container for switch/toggle components
   - Simple flex row layout
   - No gradients
──────────────────────────────── */

export interface SwitchContainerViewProps {
  /** Gap between switch and label */
  gap?: keyof Sizing['space']
  /** Background color */
  backgroundColor?: string
  /** Additional styles */
  style?: StyleProp<ViewStyle>
  /** Switch content */
  children?: ReactNode
}

/**
 * 🔘 SwitchContainerView - Container for switch components
 * Simple row layout, no gradients
 */
export function SwitchContainerView({
  gap = 'sm',
  backgroundColor = 'transparent',
  style,
  children,
}: SwitchContainerViewProps) {
  const S = useScale()

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          alignItems: 'center',
          gap: S.space[gap],
          backgroundColor,
        },
        style,
      ]}
    >
      {children}
    </View>
  )
}
