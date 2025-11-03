import { $, tone, UseTheme } from '@/theme'
import React, { ReactNode, useState } from 'react'
import {
  GestureResponderEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native'

interface IconButtonBarProps {
  icon: ReactNode | string
  onPress?: (event: GestureResponderEvent) => void
  color?: string            // base accent background
  iconColor?: string        // icon/text color
  size?: number             // full diameter
  disabled?: boolean
  style?: ViewStyle
  fontsize?: number
}

/**
 * 🧭 IconButtonBar (v2)
 * Accent base with smooth tone opacity transitions.
 */
export function IconButtonBar({
  icon,
  onPress,
  color,
  iconColor,
  size = 38,
  disabled = false,
  style,
  fontsize = size / 2,
}: IconButtonBarProps) {
  const { theme } = UseTheme()
  // For tone() operations, we need the actual color value, not CSS var
  const effectiveColor = color || theme.accent
  const effectiveIconColor = iconColor || $('surface', theme)
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)

  // base 40%, hover 80%, press 100%
  const getBg = () => {
    if (pressed) return tone(effectiveColor, 'changeOpacity', undefined, 1, theme)
    if (hovered) return tone(effectiveColor, 'changeOpacity', undefined, 0.8, theme)
    return tone(effectiveColor, 'changeOpacity', undefined, 0.4, theme)
  }

  return (
    <Pressable
      accessibilityRole="button"
      onPress={disabled ? undefined : onPress}
      onHoverIn={() => !disabled && setHovered(true)}
      onHoverOut={() => !disabled && setHovered(false)}
      onPressIn={() => !disabled && setPressed(true)}
      onPressOut={() => !disabled && setPressed(false)}
      disabled={disabled}
      style={[
        styles.base,
        {
          width: size,
          height: size,
          borderRadius: 3,
          backgroundColor: getBg(),
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {typeof icon === 'string' ? (
        <Text
          style={{
            fontSize: fontsize,
            color: effectiveIconColor,
            textAlign: 'center',
          }}
        >
          {icon}
        </Text>
      ) : (
        icon
      )}
    </Pressable>
  )
}

const styles = StyleSheet.create({
  base: {
    justifyContent: 'center',
    alignItems: 'center',
    ...(Platform.OS === 'web' ? { cursor: 'pointer' as const } : {}),
  },
})
