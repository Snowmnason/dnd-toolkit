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

interface IconButtonProps {
  icon: ReactNode | string
  onPress?: (event: GestureResponderEvent) => void
  color?: string                // background color (semi-transparent if provided)
  iconColor?: string            // 👈 new: icon/text color
  size?: 'sm' | 'md' | 'lg' | number
  disabled?: boolean
  style?: ViewStyle
}

export function IconButton({
  icon,
  onPress,
  color = 'transparent',
  iconColor = '$textPrimary',   // 👈 default uses theme text color
  size = 'md',
  disabled = false,
  style,
}: IconButtonProps) {
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
  const baseColor = color === 'transparent' ? 'transparent' : tone(color, 'alt')

  return (
    <Pressable
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
          backgroundColor: hovered
            ? tone($('surface'), 'alt')
            : baseColor === 'transparent'
            ? 'transparent'
            : `${baseColor}B3`, // 70% opacity
        },
        style,
      ]}
    >
      {typeof icon === 'string' ? (
        <Text
          style={[
            styles.icon,
            {
              fontSize: buttonSize / 2,
              color: iconColor, // 👈 theme-aware icon color
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
