import Color from 'color'
import { UseTheme } from '../index'

function adjustBrightness(hex: string, delta: number) {
  const c = Color(hex)
  return delta > 0 ? c.lighten(delta).hex() : c.darken(Math.abs(delta)).hex()
}

function mixColors(base: string, blend: string, ratio: number) {
  const c1 = Color(base)
  const c2 = Color(blend)
  return c1.mix(c2, ratio).hex()
}

function isThemeDark(colorHex: string): boolean {
  try {
    return Color(colorHex).isDark()
  } catch {
    return false
  }
}

/**
 * 🎨 Tone helper
 * Applies subtle, consistent transformations for hover, border, disabled,
 * alt (light/dark adaptive), accent (tinted), and subtle (faint) tones.
 */
export function tone(
  base: string,
  mode:
    | 'base'
    | 'hover'
    | 'border'
    | 'disabled'
    | 'alt'
    | 'accent'
    | 'subtle' = 'base',
  variant?: 'solid' | 'outlined' | 'ghost'
) {
  const { theme } = UseTheme()
  const c = Color(base)
  const darkMode = isThemeDark(theme.background ?? '#222')

  switch (mode) {
    case 'hover':
      return c.lighten(0.08).hex()

    case 'border':
      return c.darken(0.12).hex()

    case 'subtle':
      // very faint version of border — slightly lighter in dark mode, darker in light mode
      return darkMode ? c.lighten(0.25).alpha(0.5).string() : c.darken(0.1).alpha(0.3).string()

    case 'disabled':
      if (variant === 'outlined' || variant === 'ghost') {
        return c.desaturate(0.4).lighten(0.3).hex()
      }
      return c.alpha(Math.min(c.alpha(), 0.5)).string()

    case 'alt': {
      const delta = darkMode ? 0.08 : -0.06
      return adjustBrightness(base, delta)
    }

    case 'accent': {
      const accentColor = theme.accent ?? '#8B4513'
      return mixColors(base, accentColor, 0.25)
    }

    default:
      return c.hex()
  }
}
