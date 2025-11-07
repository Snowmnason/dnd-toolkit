import { ThemeTokens } from '@/theme/tokens'
import { Platform, ViewStyle } from 'react-native'

/**
 * Shadow presets for cross-platform elevated components
 */
export type ShadowMode = 'combined' | 'harder' | 'softer' | 'none'

/**
 * 🌑 getShadowStyle
 * Returns pre-configured shadow styles for web and native using theme-aware shadow color.
 * Call this inside components. Can pass theme to avoid calling UseTheme hook.
 * 
 * @param mode - Shadow intensity/configuration
 * @param theme - Optional theme; if not provided, will use default shadow color
 * 
 * @example
 * <View style={getShadowStyle('combined')}>
 *   <Text>Elevated content</Text>
 * </View>
 */
export function getShadowStyle(mode: ShadowMode = 'combined', theme?: ThemeTokens): ViewStyle {
  if (mode === 'none') {
    return {}
  }

  // Get shadow color from theme or use defaults
  let color: string
  if (theme) {
    color = theme.shadow as string
  } else {
    // Default shadow colors (matches dark theme)
    color = Platform.OS === 'web' ? 'rgba(66, 66, 66, 0.25)' : 'rgba(66, 66, 66, 0.25)'
  }

  switch (mode) {
    case 'combined':
      // Layered shadow for maximum depth
      return Platform.OS === 'web'
        ? {
            boxShadow: `0px 4px 4px ${color}, 0px 12px 12px ${color}` as any,
          }
        : {
            shadowColor: color as any,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.3,
            shadowRadius: 8,
            elevation: 3,
          }

    case 'harder':
      // Sharp, close shadow
      return Platform.OS === 'web'
        ? {
            boxShadow: `0px 4px 4px ${color}` as any,
          }
        : {
            shadowColor: color as any,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.25,
            shadowRadius: 4,
            elevation: 2,
          }

    case 'softer':
      // Diffused, gentle shadow
      return Platform.OS === 'web'
        ? {
            boxShadow: `0px 12px 12px ${color}` as any,
          }
        : {
            shadowColor: color as any,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.2,
            shadowRadius: 12,
            elevation: 1,
          }

    default:
      return {}
  }
}
