import { $, UseTheme } from '@/theme'
import React, { ReactNode, useState } from 'react'
import {
  GestureResponderEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native'

interface IconButtonProps {
  icon: ReactNode | string
  onPress?: (event: GestureResponderEvent) => void
  size?: 'sm' | 'md' | 'lg' | number
  disabled?: boolean
  /** accent background when true */
  selected?: boolean
  style?: ViewStyle
  fontColor?: string
}

/**
 * 🔘 IconButton
 * - Transparent by default
 * - Accent background on hover or selected
 * - No color injection; icon renders exactly as given
 */
export function IconButton({
  icon,
  onPress,
  size = 'md',
  disabled = false,
  selected = false,
  style,
  fontColor,
}: IconButtonProps) {
  const { theme } = UseTheme()
  const [hovered, setHovered] = useState(false)

  const getSize = (): number => {
    switch (size) {
      case 'sm':
        return 28
      case 'md':
        return 38
      case 'lg':
        return 48
      default:
        return typeof size === 'number' ? size : 38
    }
  }

  const buttonSize = getSize()
  const isHot = !disabled && (hovered || selected)

  const backgroundColor = isHot ? $('accent', theme) : 'transparent'

  return (
    <Pressable
      accessibilityRole="button"
      onPress={disabled ? undefined : onPress}
      onHoverIn={() => !disabled && setHovered(true)}
      onHoverOut={() => !disabled && setHovered(false)}
      disabled={disabled}
      style={[
        styles.base,
        {
          width: buttonSize,
          height: buttonSize,
          borderRadius: buttonSize / 2,
          backgroundColor,
          opacity: disabled ? 0.5 : 1,
        },
        style,
      ]}
    >
      {typeof icon === 'string' ? (
        <Text
          style={[
            styles.icon,
            {
              color: fontColor,
              fontSize: buttonSize / 2,
            },
          ]}
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
  icon: {
    textAlign: 'center',
  },
})
