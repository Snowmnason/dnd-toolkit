import Color from 'color'

/**
 * Tone helper
 * Applies subtle, consistent transformations for hover, border, and disabled colors.
 */
export function tone(
  base: string,
  mode: 'base' | 'hover' | 'border' | 'disabled' = 'base',
  variant?: 'solid' | 'outlined' | 'ghost'
) {
  const c = Color(base)

  switch (mode) {
    case 'hover':
      return c.lighten(0.08).hex()
    case 'border':
      return c.darken(0.12).hex()
    case 'disabled':
      if (variant === 'outlined' || variant === 'ghost') {
        return c.desaturate(0.4).lighten(0.3).hex()
      }
      return c.alpha(Math.min(c.alpha(), 0.5)).string()
    default:
      return c.hex()
  }
}