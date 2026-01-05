import Color from 'color'
import { ThemeTokens } from '../tokens'

/**
 * Check if a color string is a CSS variable
 */
function isCSSVariable(color: string): boolean {
  return typeof color === 'string' && color.includes('var(')
}

function adjustBrightness(hex: string, delta: number) {
  // If it's a CSS variable, return as-is
  if (isCSSVariable(hex)) return hex
  
  try {
    const c = Color(hex)
    return delta > 0 ? c.lighten(delta).hex() : c.darken(Math.abs(delta)).hex()
  } catch {
    // If color parsing fails, return the original color
    return hex
  }
}

function mixColors(base: string, blend: string, ratio: number) {
  // If either is a CSS variable, return base as-is
  if (isCSSVariable(base) || isCSSVariable(blend)) return base
  
  try {
    const c1 = Color(base)
    const c2 = Color(blend)
    return c1.mix(c2, ratio).hex()
  } catch {
    // If color parsing fails, return the base color
    return base
  }
}

/**
 * Create a gradient-friendly variation of a color
 * Lightens dark colors more aggressively, darkens light colors subtly
 * Preserves saturation AND alpha channel for rich, visible gradients
 */
export function gradientVariant(base: string): string {
  if (isCSSVariable(base)) return base
  
  try {
    const c = Color(base)
    const luminance = c.luminosity()
    const originalAlpha = c.alpha()
    
    let adjusted
    // For dark colors (< 0.3 luminance), lighten more aggressively
    if (luminance < 0.3) {
      adjusted = c.lighten(0.5) // 50% lighter for dark colors
    }
    // For medium colors (0.3 - 0.6), moderate adjustment
    else if (luminance < 0.6) {
      adjusted = c.lighten(0.2) // 20% lighter for medium colors
    }
    // For light colors (> 0.6), darken slightly
    else {
      adjusted = c.darken(0.15) // 15% darker for light colors
    }
    
    // Preserve the original alpha channel
    if (originalAlpha < 1) {
      return adjusted.alpha(originalAlpha).string()
    }
    return adjusted.hex()
  } catch {
    return base
  }
}

function isThemeDark(colorHex: string): boolean {
  // CSS variables can't be evaluated at runtime, assume light/dark based on context
  if (isCSSVariable(colorHex)) return false
  
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
  // If baseColor is a CSS variable, return it as-is (can't generate gradients for vars)
  if (isCSSVariable(baseColor)) {
    return [baseColor]
  }
  
  try {
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
  } catch {
    // If color parsing fails, return baseColor as single stop
    return [baseColor]
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
  // If base is a CSS variable, return as-is (can't transform CSS variables at runtime)
  if (isCSSVariable(base)) return base
  
  try {
    const c = Color(base)

    // Early return for simple cases that don't need theme
    if (mode === 'base') return c.hex()
    if (mode === 'hover') return c.lighten(0.3).hex()
    if (mode === 'border') return c.darken(0.12).hex()
    if (mode === 'changeOpacity') return c.alpha(amount).string()

    // Determine dark mode without importing ThemeProvider to avoid require cycles
    // Prefer explicit theme if provided; otherwise infer from base color
    const inferredBg = theme?.background ?? base ?? '#222'
    const darkMode = isThemeDark(inferredBg)

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
        return mixColors(base, theme?.accent ?? '#8B4513', 0.25)

      default:
        return c.hex()
    }
  } catch {
    // If color parsing fails, return base color as-is
    return base
  }
}
