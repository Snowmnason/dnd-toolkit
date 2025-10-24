import { $, S, tone, UseTheme } from '@/theme'
import React from 'react'
import { View, ViewStyle } from 'react-native'

interface CardProps {
  toneVariant?: 'base' | 'accent' | 'alt'
  bordered?: boolean
  padded?: boolean
  radius?: keyof typeof S.radius
  shadow?: boolean
  style?: ViewStyle
  children: React.ReactNode
}

/**
 * 🪶 Card
 * A raised, theme-aware content container for lists, tiles, or modal sections.
 * Automatically adjusts tone and shadow based on current theme.
 */
export function Card({
  toneVariant = 'base',
  bordered = true,
  padded = true,
  radius = 'md',
  shadow = true,
  style,
  children,
}: CardProps) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { theme: _theme } = UseTheme()

  // Tone-based background
  const bg =
    toneVariant === 'accent'
      ? tone($('accent'), 'alt')
      : toneVariant === 'alt'
      ? tone($('surface'), 'alt')
      : $('surface')

  // Unified shadow tone (light on dark, dark on light)
  const shadowColor = $('shadow')

  return (
    <View
      style={[
        {
          backgroundColor: bg,
          borderRadius: S.radius[radius],
          borderWidth: bordered ? 1 : 0,
          borderColor: bordered ? tone($('border'), 'subtle') : 'transparent',
          padding: padded ? S.space.md : 0,
          shadowColor: shadow ? shadowColor : 'transparent',
          shadowOpacity: shadow ? 0.35 : 0,
          shadowRadius: shadow ? 6 : 0,
          shadowOffset: shadow ? { width: 0, height: 3 } : { width: 0, height: 0 },
          elevation: shadow ? 3 : 0,
        },
        style,
      ]}
    >
      {children}
    </View>
  )
}
