import { $, tone } from '@/theme'
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
}

/**
 * 🧭 IconButtonBar (v2)
 * Accent base with smooth tone opacity transitions.
 */
export function IconButtonBar({
  icon,
  onPress,
  color = $('accent'),
  iconColor = $('surface'),
  size = 38,
  disabled = false,
  style,
}: IconButtonBarProps) {
  const [hovered, setHovered] = useState(false)
  const [pressed, setPressed] = useState(false)

  // base 40%, hover 80%, press 100%
  const getBg = () => {
    if (pressed) return tone(color, 'changeOpacity', undefined, 1)
    if (hovered) return tone(color, 'changeOpacity', undefined, 0.8)
    return tone(color, 'changeOpacity', undefined, 0.4)
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
          borderRadius: size / 2,
          backgroundColor: getBg(),
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {typeof icon === 'string' ? (
        <Text
          style={{
            fontSize: size / 2,
            color: iconColor,
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
