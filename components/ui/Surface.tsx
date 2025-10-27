import { $, tone, useScale, UseTheme } from '@/theme'
import type { Sizing } from '@/theme/ultils/sizing'
import React from 'react'
import { View, ViewStyle } from 'react-native'

type RadiusKey = keyof Sizing['radius']

interface SurfaceProps {
  variant?: 'base' | 'surface' | 'elevated' | 'accent'
  padded?: boolean
  radius?: RadiusKey
  bordered?: boolean
  style?: ViewStyle
  children: React.ReactNode
}

/**
 * 🌗 Surface
 * A flexible themed container for background panels and sections.
 * Adapts to theme mode automatically (light/dark shadow and tone handling).
 */
export function Surface({
  variant = 'surface',
  padded = true,
  radius = 'md',
  bordered = false,
  style,
  children,
}: SurfaceProps) {
  const { theme } = UseTheme()
  const S = useScale()

  // Dynamic background tone
  const bg =
    variant === 'base'
      ? $('background', theme)
      : variant === 'accent'
      ? tone($('accent', theme), 'alt', undefined, undefined, theme)
      : variant === 'elevated'
      ? tone($('surface', theme), 'alt', undefined, undefined, theme)
      : $('surface', theme)

  // Theme-aware shadow color (slightly tinted)
  const shadowColor = $('shadow', theme)

  const borderColor = bordered ? tone($('border', theme), 'subtle', undefined, undefined, theme) : 'transparent'

  return (
    <View
      style={[
        {
          backgroundColor: bg,
          borderRadius: S.radius[radius],
          padding: padded ? S.space.md : 0,
          borderWidth: bordered ? 1 : 0,
          borderColor,
          boxShadow: `0px 3px 6px ${shadowColor}66`,
          elevation: 2,
        },
        style,
      ]}
    >
      {children}
    </View>
  )
}
