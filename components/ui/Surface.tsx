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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { theme: _theme } = UseTheme()
  const S = useScale()

  // Dynamic background tone
  const bg =
    variant === 'base'
      ? $('background')
      : variant === 'accent'
      ? tone($('accent'), 'alt')
      : variant === 'elevated'
      ? tone($('surface'), 'alt')
      : $('surface')

  // Theme-aware shadow color (slightly tinted)
  const shadowColor = $('shadow')

  const borderColor = bordered ? tone($('border'), 'subtle') : 'transparent'

  return (
    <View
      style={[
        {
          backgroundColor: bg,
          borderRadius: S.radius[radius],
          padding: padded ? S.space.md : 0,
          borderWidth: bordered ? 1 : 0,
          borderColor,
          shadowColor,
          shadowOpacity: 0.4,
          shadowRadius: 6,
          shadowOffset: { width: 0, height: 3 },
          elevation: 2,
        },
        style,
      ]}
    >
      {children}
    </View>
  )
}
