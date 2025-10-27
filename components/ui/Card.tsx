import { $, tone, useScale, UseTheme, type Sizing } from '@/theme'
import React from 'react'
import { View, ViewStyle } from 'react-native'

type RadiusKey = keyof Sizing['radius']

interface CardProps {
  toneVariant?: 'base' | 'accent' | 'alt'
  bordered?: boolean
  padded?: boolean
  radius?: RadiusKey
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
  const S = useScale()
  const { theme } = UseTheme()

  // Tone-based background - calculate directly for reactivity
  const bg =
    toneVariant === 'accent'
      ? tone($('accent', theme), 'alt', undefined, undefined, theme)
      : toneVariant === 'alt'
      ? tone($('surface', theme), 'alt', undefined, undefined, theme)
      : $('surface', theme)

  // Unified shadow tone (light on dark, dark on light)
  const shadowColor = $('shadow', theme)

  // Border color
  const borderColor = bordered 
    ? tone($('border', theme), 'subtle', undefined, undefined, theme) 
    : 'transparent'

  // Box shadow - works on web and modern React Native
  const boxShadow = shadow ? `0px 3px 6px ${shadowColor}66` : 'none'

  return (
    <View
      style={[
        {
          backgroundColor: bg,
          borderRadius: S.radius[radius],
          borderWidth: bordered ? 1 : 0,
          borderColor: borderColor,
          padding: padded ? S.space.md : 0,
          ...(shadow && { boxShadow: boxShadow }),
        },
        style,
      ]}
    >
      {children}
    </View>
  )
}
