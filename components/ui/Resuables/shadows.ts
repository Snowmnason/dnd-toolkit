import { $ } from '@/theme'
import { Platform, ViewStyle } from 'react-native'

/**
 * Shadow presets for cross-platform elevated components
 */
export type ShadowMode = 'combined' | 'harder' | 'softer' | 'none'

/**
 * 🌑 getShadowStyle
 * Returns pre-configured shadow styles for web and native using theme-aware shadow color.
 * 
 * @param mode - Shadow intensity/configuration
 * 
 * @example
 * <View style={getShadowStyle('combined')}>
 *   <Text>Elevated content</Text>
 * </View>
 */
export function getShadowStyle(mode: ShadowMode = 'combined'): ViewStyle {
  if (mode === 'none') {
    return {}
  }

  // Always use theme shadow token for consistent theme-aware shadows
  const color = $('shadow')

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

/**
 * Pre-exported shadow styles for convenience
 */
export const shadows = {
  combined: getShadowStyle('combined'),
  harder: getShadowStyle('harder'),
  softer: getShadowStyle('softer'),
  none: {},
} as const
