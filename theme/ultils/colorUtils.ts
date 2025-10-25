import Color from 'color'
import { UseTheme } from '../ThemeProvider'
import { ThemeTokens } from '../tokens'

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
    | 'changeOpacity'
    | 'alt'
    | 'accent'
    | 'subtle' = 'base',
  variant?: 'solid' | 'outlined' | 'ghost',
  amount: number = 0.5,
  theme?: ThemeTokens
) {
  // If theme is provided directly, use it; otherwise call the hook
  const themeToUse = theme || UseTheme().theme
  const c = Color(base)
  const darkMode = isThemeDark(themeToUse.background ?? '#222')

  switch (mode) {
    case 'hover':
      return c.lighten(0.3).hex()

    case 'border':
      return c.darken(0.12).hex()

    case 'subtle':
      // very faint version of border — slightly lighter in dark mode, darker in light mode
      return darkMode ? c.lighten(0.25).alpha(0.5).string() : c.darken(0.1).alpha(0.3).string()

    case 'disabled':
      if (variant === 'outlined' || variant === 'ghost') {
        return c.desaturate(0.6).lighten(0.3).hex()
      }
      return c.alpha(Math.min(c.alpha(), 0.5)).string()

    case 'alt': {
      const delta = darkMode ? 0.08 : -0.06
      return adjustBrightness(base, delta)
    }

    case 'accent': {
      const accentColor = themeToUse.accent ?? '#8B4513'
      return mixColors(base, accentColor, 0.25)
    }

    case 'changeOpacity':
      return c.alpha(amount).string()

    default:
      return c.hex()
  }
}
