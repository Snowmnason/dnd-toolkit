import { Platform } from 'react-native'
import { UseTheme } from '../ThemeProvider'
import { ThemeTokens, TokenName } from '../tokens'

/**
 * $(token, theme?)
 * - Web without theme param: returns CSS variable for color tokens (live updates)
 * - Web with theme param: returns resolved value (for tone() calculations)
 * - Native: always returns resolved value
 * - All platforms: returns resolved value for sizing/spacing tokens
 *
 * This is the primary way to access theme tokens in components.
 * 
 * Examples:
 *   backgroundColor: $('surface')           // CSS var on web, color on native
 *   color: $('textPrimary')                 // CSS var on web, color on native
 *   tone($('accent', theme), 'alt', ...)    // Resolved value (theme passed)
 *   fontSize: $('lg')                       // Direct value (sizing token)
 */
export function $(token: TokenName, theme?: ThemeTokens): string {
  // Check if this is a color token (exists in ThemeTokens)
  const isColorToken = [
    'primary', 'background', 'surface', 'elevated', 'bgInverse',
    'textPrimary', 'textSecondary', 'textInverse', 'textOnAccent',
    'border', 'borderSubtle', 'accent', 'accentHover', 'accentText',
    'accentLight', 'accentDark', 'success', 'warning', 'danger',
    'overlayLight', 'overlayDark', 'shadow', 'glow',
    'primaryButtonBg', 'primaryButtonBorder', 'primaryButtonText', 'primaryButtonHover',
    'secondaryButtonBg', 'secondaryButtonBorder', 'secondaryButtonText', 'secondaryButtonHover',
    'destructiveButton', 'destructiveButtonText',
    'cancelButton', 'cancelButtonText', 'solidOutButton',
    'fontFamilyTitle', 'fontFamily', 'fontFamilyPara',
    // Derived tokens synced to CSS vars
    'surfaceAlt', 'accentAlt', 'borderSubtle'
  ].includes(token as string)

  // If theme is explicitly passed, always return resolved value
  // (this indicates the caller needs the actual color for computations like tone())
  if (theme) {
    return theme[token]
  }

  // For color tokens on web (no theme passed), use CSS variables for instant updates
  if (isColorToken && Platform.OS === 'web') {
    return `var(--${token})`
  }

  // For all other cases, resolve from context
  const t = UseTheme().theme
  return t[token]
}
