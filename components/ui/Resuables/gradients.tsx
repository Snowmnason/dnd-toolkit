import { gradientVariant } from '@/theme'
import React from 'react'
import { Platform, View } from 'react-native'

/**
 * Advanced gradient configuration for fine-tuned control
 */
export interface GradientConfig {
  /** Array of colors for the gradient (minimum 2, supports unlimited) */
  colors: string[]
  /** Direction in degrees: 0=bottom-to-top, 90=left-to-right, 180=top-to-bottom (default), 270=right-to-left */
  direction?: number
  /** Custom color stop positions (0-100). Must match colors array length. Example: [0, 50, 100] */
  locations?: number[]
  /** Use repeating-linear-gradient instead of linear-gradient. Default: false (web only) */
  repeating?: boolean
}

/**
 * Simplified gradient configuration for GradientView component
 * Sensible defaults optimized for visual appeal
 */
export interface GradientViewConfig {
  /** Primary color - the main color of the gradient */
  color: string
  /** Optional additional colors. Auto-generated if not provided */
  color2?: string
  color3?: string
  color4?: string
  color5?: string
  /** Direction in degrees: 0=bottom-to-top, 90=left-to-right, 180=top-to-bottom (default), 270=right-to-left */
  direction?: number
  /** Custom color stop positions (0-100). Must match number of colors provided */
  locations?: number[]
  /** 
   * Position of the transition midpoint between color1 and color2 (0-100). Default: 50.
   * - 0% = transition starts at top (color1) → ends at bottom (color2)
   * - 25% = tight gradient at top quarter
   * - 50% = smooth transition across entire element (DEFAULT)
   * - 75% = tight gradient at bottom quarter
   * - 100% = transition starts at bottom (color2) → ends at top (color1)
   * Ignored if locations provided.
   */
  transitionPoint?: number
  /** How much to adjust the generated color2 (positive=lighter, negative=darker). Default: 20 */
  intensity?: number
}

/**
 * ��� gradient()
 * Platform-aware gradient generator
 * - Web: Returns backgroundImage style with CSS linear-gradient
 * - Native: Returns backgroundColor (solid fallback)
 *
 * @example
 * // Simple 2-color gradient
 * <View style={{ ...gradient({ color1: '#FF0000', color2: '#00FF00' }) }} />
 *
 * @example
 * // Auto-generated lighter color2
 * <View style={{ ...gradient({ color1: '#3498db' }) }} />
 *
 * @example
 * // 3-color gradient with custom midpoint
 * <View style={{ ...gradient({ color1: '#FF0000', color2: '#00FF00', color3: '#0000FF', midpoint: 30 }) }} />
 *
 * @example
 * // Horizontal gradient
 * <View style={{ ...gradient({ color1: '#FF0000', color2: '#00FF00', direction: 90 }) }} />
 *
 * @example
 * // Custom color stops (overrides color3/midpoint)
 * <View style={{ ...gradient({ color1: '#FF0000', color2: '#00FF00', color3: '#0000FF', stops: [0, 25, 75, 100] }) }} />
 *
 * @example
 * // Repeating gradient for stripes
 * <View style={{ ...gradient({ color1: '#FF0000', color2: '#FFFFFF', stops: [0, 50, 100], repeating: true }) }} />
 */
export function gradient(config: GradientConfig): any {
  const {
    colors,
    direction = 180,
    locations,
    repeating = false,
  } = config

  // Validation
  if (!colors || colors.length < 2) {
    console.warn('[gradient] At least 2 colors required')
    return { backgroundColor: colors?.[0] || '#2f353d' }
  }

  // Fallback color
  const fallback = colors[0]

  // Platform-specific return
  if (Platform.OS === 'web') {
    // Web: CSS linear-gradient or repeating-linear-gradient
    const gradientType = repeating ? 'repeating-linear-gradient' : 'linear-gradient'
    const cssAngle = directionToCSSAngle(direction)
    
    let colorStops: string[]
    
    if (locations && locations.length === colors.length) {
      // Custom locations provided
      colorStops = colors.map((color, i) => `${color} ${locations[i]}%`)
    } else {
      // Auto-distribute evenly
      const step = 100 / (colors.length - 1)
      colorStops = colors.map((color, i) => `${color} ${Math.round(i * step)}%`)
    }

    const gradientString = `${gradientType}(${cssAngle}deg, ${colorStops.join(', ')})`

    return {
      backgroundImage: gradientString,
      backgroundColor: fallback,
    }
  }

  // Native: Solid color fallback (first color)
  return {
    backgroundColor: fallback,
  }
}

/**
 * Simple helper to create common gradient directions
 */
export const gradientDirections = {
  topToBottom: 180,
  bottomToTop: 0,
  leftToRight: 90,
  rightToLeft: 270,
} as const

/**
 * Convert direction degrees to start/end points for react-native-linear-gradient
 * Direction: 0=bottom-to-top, 90=left-to-right, 180=top-to-bottom, 270=right-to-left
 */
function directionToStartEnd(direction: number): { start: { x: number; y: number }; end: { x: number; y: number } } {
  const normalized = direction % 360
  
  if (normalized === 0) {
    // Bottom to top
    return { start: { x: 0.5, y: 1 }, end: { x: 0.5, y: 0 } }
  } else if (normalized === 90) {
    // Left to right
    return { start: { x: 0, y: 0.5 }, end: { x: 1, y: 0.5 } }
  } else if (normalized === 180) {
    // Top to bottom
    return { start: { x: 0.5, y: 0 }, end: { x: 0.5, y: 1 } }
  } else if (normalized === 270) {
    // Right to left
    return { start: { x: 1, y: 0.5 }, end: { x: 0, y: 0.5 } }
  } else {
    // Default to top-to-bottom for other angles
    return { start: { x: 0.5, y: 0 }, end: { x: 0.5, y: 1 } }
  }
}

/**
 * Convert direction degrees to CSS angle
 */
function directionToCSSAngle(direction: number): number {
  // CSS angles: 0deg=top-to-bottom, 90deg=right, 180deg=bottom, 270deg=left
  // Our direction: 180=top-to-bottom, 270=right, 0=bottom, 90=right
  // So CSS angle = (direction + 180) % 360
  const normalized = direction % 360
  return (normalized + 180) % 360
}

/**
 * Platform-aware GradientView component
 * Smart defaults for quick, beautiful gradients with minimal config
 * Supports 2-5 colors with auto-generation and custom positioning
 *
 * @example
 * // Simplest usage - just pass a color (auto-generates 2nd color)
 * <GradientView color="#3498db" style={{ height: 200 }} />
 *
 * @example
 * // 2-color gradient
 * <GradientView color="#FF0000" color2="#00FF00" style={{ height: 200 }}>
 *   <Text>Content</Text>
 * </GradientView>
 *
 * @example
 * // 3-color gradient
 * <GradientView 
 *   color="#FF0000" 
 *   color2="#FFFF00"
 *   color3="#00FF00"
 *   style={{ height: 200 }} 
 * />
 *
 * @example
 * // 5-color gradient with custom locations
 * <GradientView 
 *   color="#FF0000" 
 *   color2="#FF7F00"
 *   color3="#FFFF00"
 *   color4="#00FF00"
 *   color5="#0000FF"
 *   locations={[0, 25, 50, 75, 100]}
 *   style={{ height: 200 }} 
 * />
 *
 * @example
 * // Horizontal gradient
 * <GradientView 
 *   color="#FF0000" 
 *   color2="#00FF00"
 *   direction={90}
 *   style={{ height: 200 }} 
 * />
 *
 * @example
 * // Toggle gradient on/off
 * <GradientView enabled={false} color="#3498db" style={{ height: 200 }} />
 *
 * @example
 * // With opacity (for semi-transparent gradients)
 * <GradientView 
 *   color="#3498db" 
 *   opacity={0.5}
 *   style={{ height: 200 }} 
 * />
 */
export function GradientView({
  enabled = true,
  color,
  color2,
  color3,
  color4,
  color5,
  direction = 180,
  locations,
  transitionPoint = 50,
  intensity = 30,
  opacity,
  style,
  children,
}: {
  enabled?: boolean
  color: string
  color2?: string
  color3?: string
  color4?: string
  color5?: string
  direction?: number
  locations?: number[]
  transitionPoint?: number
  intensity?: number
  opacity?: number
  style?: any
  children?: React.ReactNode
}) {
  // If gradient is disabled, just show solid color
  if (!enabled) {
    if (Platform.OS === 'web') {
      // Handle style prop - could be array or object
      let mergedStyle: any = {
        backgroundColor: color,
        opacity: opacity,
      }
      
      if (style) {
        if (Array.isArray(style)) {
          // Merge style array into object
          style.forEach((s: any) => {
            if (s) mergedStyle = { ...mergedStyle, ...s }
          })
        } else {
          // Merge style object
          mergedStyle = { ...mergedStyle, ...style }
        }
      }
      
      return <div style={mergedStyle}>{children}</div>
    }

    return (
      <View style={[{ backgroundColor: color, opacity }, style]}>
        {children}
      </View>
    )
  }

  // Build colors array
  let gradientColors: string[] = [color]
  
  // Add provided colors
  if (color2) gradientColors.push(color2)
  if (color3) gradientColors.push(color3)
  if (color4) gradientColors.push(color4)
  if (color5) gradientColors.push(color5)
  
  // If only one color, auto-generate second color using gradientVariant() for better color quality
  if (gradientColors.length === 1) {
    // Use custom gradient variant that adjusts more aggressively for dark colors
    // Dark colors get 50% lighter, medium 20% lighter, light colors 15% darker
    // This creates visible, rich gradients especially in dark mode
    const adjustedColor = gradientVariant(color)
    gradientColors.push(adjustedColor)
  }
  
  // For 2-color gradients with custom transition point (native only)
  // Expand to 4 colors to create the midpoint effect
  const use4ColorPattern = Platform.OS !== 'web' && gradientColors.length === 2 && !locations
  if (use4ColorPattern) {
    gradientColors = [gradientColors[0], gradientColors[0], gradientColors[1], gradientColors[1]]
  }
  
  // Validate colors - all must be valid strings
  if (!gradientColors.every(c => typeof c === 'string' && c.length > 0)) {
    console.warn('[GradientView] Invalid color in gradient:', gradientColors)
    return (
      <View style={[{ backgroundColor: color, opacity }, style]}>
        {children}
      </View>
    )
  }

  // Convert direction to native start/end points
  const { start, end } = directionToStartEnd(direction)

  // Build locations array for native
  let nativeLocations: number[] | undefined
  if (locations && locations.length === gradientColors.length) {
    // Custom locations provided - convert from 0-100 to 0-1
    nativeLocations = locations.map(loc => loc / 100).filter(n => !isNaN(n))
    if (nativeLocations.length === 0) nativeLocations = undefined
  } else if (use4ColorPattern) {
    // Using 4-color pattern for midpoint effect
    const mid = Math.max(0, Math.min(100, transitionPoint))
    nativeLocations = [0, Math.max(0, mid - 25) / 100, Math.min(100, mid + 25) / 100, 1]
  } else if (gradientColors.length > 2) {
    // Auto-distribute evenly
    const step = 1 / (gradientColors.length - 1)
    nativeLocations = gradientColors.map((_, i) => i * step).filter(n => !isNaN(n))
  }
  
  // Ensure locations is valid array or undefined
  if (nativeLocations && (nativeLocations.length === 0 || nativeLocations.some(isNaN))) {
    nativeLocations = undefined
  }

  // WEB PLATFORM - Use CSS
  if (Platform.OS === 'web') {
    const cssAngle = directionToCSSAngle(direction)
    
    let colorStops: string[]
    if (locations && locations.length === gradientColors.length) {
      // Custom locations provided
      colorStops = gradientColors.map((c, i) => `${c} ${locations[i]}%`)
    } else if (gradientColors.length === 2 && !locations) {
      // Simple 2-color with transition midpoint
      // transitionPoint is where the colors meet 50/50
      // Create a smooth gradient with the midpoint at the specified position
      colorStops = [`${gradientColors[0]} 0%`, `${gradientColors[0]} ${Math.max(0, transitionPoint - 25)}%`, `${gradientColors[1]} ${Math.min(100, transitionPoint + 25)}%`, `${gradientColors[1]} 100%`]
    } else {
      // Auto-distribute evenly
      const step = 100 / (gradientColors.length - 1)
      colorStops = gradientColors.map((c, i) => `${c} ${Math.round(i * step)}%`)
    }
    
    const gradientString = `linear-gradient(${cssAngle}deg, ${colorStops.join(', ')})`

    // Merge style arrays into single object for web
    let mergedStyle: any = {
      backgroundImage: gradientString,
      backgroundClip: 'padding-box', // Prevent gradient from bleeding under border
      opacity: opacity,
      borderStyle: 'solid', // Required for borders to show on web
      backgroundSize: '100% 100%', // Ensure gradient fills entire element
      backgroundRepeat: 'no-repeat', // Don't repeat the gradient
    }
    
    // Handle style prop - could be array or object
    // Flatten style arrays and filter out invalid properties for web
    if (style) {
      const flattenStyle = (s: any): any => {
        if (!s) return {}
        if (Array.isArray(s)) {
          return s.reduce((acc, item) => ({ ...acc, ...flattenStyle(item) }), {})
        }
        // Filter out React Native specific properties that don't work on web
        const { 
          shadowColor, shadowOffset, shadowOpacity, shadowRadius,
          elevation, 
          ...webSafeStyle 
        } = s
        return webSafeStyle
      }
      
      const flatStyle = flattenStyle(style)
      mergedStyle = { ...mergedStyle, ...flatStyle }
    }

    return (
      <div style={mergedStyle}>
        {children}
      </div>
    )
  }

  // NATIVE PLATFORMS (iOS/Android) - Use react-native-linear-gradient
  // Dynamically import to avoid web bundler errors
  if ((Platform.OS as any) !== 'web') {
    try {
      // @ts-ignore - Dynamic require for platform-specific module
      const NativeLinearGradient = require('react-native-linear-gradient').default
      
      // Build native style - handle array merging
      let nativeStyle: any = { opacity }
      if (style) {
        if (Array.isArray(style)) {
          style.forEach((s: any) => {
            if (s) nativeStyle = { ...nativeStyle, ...s }
          })
        } else {
          nativeStyle = { ...nativeStyle, ...style }
        }
      }
      
      return (
        <NativeLinearGradient
          colors={gradientColors}
          start={start}
          end={end}
          locations={nativeLocations}
          style={nativeStyle}
        >
          {children}
        </NativeLinearGradient>
      )
    } catch {
      // Fallback to solid color if library not available
      return (
        <View style={[{ backgroundColor: color, opacity }, style]}>
          {children}
        </View>
      )
    }
  }

  // Fallback for web or any other platform
  return (
    <View style={[{ backgroundColor: color, opacity }, style]}>
      {children}
    </View>
  )
}
