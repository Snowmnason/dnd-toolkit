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
 * 🌈 Creates a tight, dramatic gradient from light to dark
 * Returns an array of color stops for linear gradient
 */
export function createGradientStops(
  baseColor: string,
  direction: 'top-to-bottom' | 'bottom-to-top' = 'top-to-bottom',
  intensity: 'subtle' | 'moderate' | 'dramatic' = 'dramatic'
): string[] {
  const c = Color(baseColor)
  
  // Intensity determines how much lighter/darker the gradient gets
  const lightAdjust = intensity === 'dramatic' ? 0.25 : intensity === 'moderate' ? 0.15 : 0.08
  const darkAdjust = intensity === 'dramatic' ? 0.3 : intensity === 'moderate' ? 0.18 : 0.1
  
  const lightEnd = c.lighten(lightAdjust).hex()
  const darkEnd = c.darken(darkAdjust).hex()
  
  // Tight transition in the middle (70% through for dramatic effect)
  if (direction === 'top-to-bottom') {
    return [
      `${lightEnd} 0%`,
      `${baseColor} 70%`,
      `${darkEnd} 100%`,
    ]
  } else {
    return [
      `${darkEnd} 0%`,
      `${baseColor} 30%`,
      `${lightEnd} 100%`,
    ]
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
): string {
  const c = Color(base)

  // Early return for simple cases that don't need theme
  if (mode === 'base') return c.hex()
  if (mode === 'hover') return c.lighten(0.3).hex()
  if (mode === 'border') return c.darken(0.12).hex()
  if (mode === 'changeOpacity') return c.alpha(amount).string()

  // Lazy theme resolution only when needed
  const themeToUse = theme ?? UseTheme().theme
  const darkMode = isThemeDark(themeToUse.background ?? '#222')

  switch (mode) {
    case 'subtle':
      return darkMode 
        ? c.lighten(0.25).alpha(0.5).string() 
        : c.darken(0.1).alpha(0.3).string()

    case 'disabled':
      return (variant === 'outlined' || variant === 'ghost')
        ? c.desaturate(0.6).lighten(0.3).hex()
        : c.alpha(Math.min(c.alpha(), 0.5)).string()

    case 'alt':
      return adjustBrightness(base, darkMode ? 0.08 : -0.06)

    case 'accent':
      return mixColors(base, themeToUse.accent ?? '#8B4513', 0.25)

    default:
      return c.hex()
  }
}
