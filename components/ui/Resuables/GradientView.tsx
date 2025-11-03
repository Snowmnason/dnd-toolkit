import React from 'react'
import { Platform, View, ViewStyle } from 'react-native'

export type GradientIntensity = 'subtle' | 'moderate' | 'dramatic'
export type GradientDirection = 'top-to-bottom' | 'bottom-to-top'

interface GradientViewProps {
  /** Base color token or hex value */
  baseColor: string
  /** Gradient intensity */
  intensity?: GradientIntensity
  /** Gradient direction */
  direction?: GradientDirection
  /** Border radius for native overlay clipping */
  borderRadius?: number
  /** Opacity for the gradient/background layer (0..1). Children remain fully opaque. */
  gradientOpacity?: number
  /** If true, fade from baseColor to transparent along the direction. */
  fadeToTransparent?: boolean
  /** Scale the computed white mix (0.0-2.0). 1 = default; lower to reduce white at the start. */
  lightScale?: number
  /** Scale the computed black mix (0.0-2.0). 1 = default; lower to reduce black at the end. */
  darkScale?: number
  /** Override the computed white percentage (0-100). Takes precedence over lightScale. */
  lightOverride?: number
  /** Override the computed black percentage (0-100). Takes precedence over darkScale. */
  darkOverride?: number
  /** Additional style */
  style?: ViewStyle
  /** Child content */
  children?: React.ReactNode
  endColor?: string
}

/**
 * Calculate relative luminance of a color (0-1 scale)
 * Used to determine if a color is light or dark
 */
function getLuminance(color: string): number {
  // Handle CSS variables - assume medium luminance
  if (color.startsWith('var(')) return 0.5

  // Parse hex color
  let hex = color.replace('#', '')
  if (hex.length === 3) {
    hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2]
  }
  
  const r = parseInt(hex.substr(0, 2), 16) / 255
  const g = parseInt(hex.substr(2, 2), 16) / 255
  const b = parseInt(hex.substr(4, 2), 16) / 255
  
  // Apply gamma correction and calculate luminance
  const [rL, gL, bL] = [r, g, b].map(val => 
    val <= 0.03928 ? val / 12.92 : Math.pow((val + 0.055) / 1.055, 2.4)
  )
  
  return 0.2126 * rL + 0.7152 * gL + 0.0722 * bL
}

/**
 * 🌈 GradientView
 * Cross-platform gradient container that works on both web and native.
 * - Web: Uses CSS linear-gradient with color-mix for live theme updates
 * - Native: Uses semi-transparent overlay layers for gradient effect
 * 
 * @example
 * <GradientView baseColor={$('surface')} intensity="dramatic">
 *   <Text>Content</Text>
 * </GradientView>
 */
export function GradientView({
  baseColor,
  endColor,
  intensity = 'moderate',
  direction = 'top-to-bottom',
  borderRadius = 0,
  gradientOpacity = 1,
  fadeToTransparent = false,
  lightScale = 0.8,
  darkScale = 0.8,
  lightOverride,
  darkOverride,
  style,
  children,
}: GradientViewProps) {
  // Calculate luminance to understand the color brightness
  const luminance = getLuminance(baseColor)
  
  // Define intensity multipliers
  const intensityMultiplier = intensity === 'dramatic' ? 1.5 : intensity === 'moderate' ? 1.0 : 0.6
  
  // Sophisticated gradient calculation based on luminance spectrum
  // The key insight: colors at extremes (very dark/very light) need CONTRAST
  // Colors in middle range need more subtle gradients
  
  let lightPct: number
  let darkPct: number
  
  if (luminance < 0.15) {
    // Very dark colors (e.g., #2f353d): Need significant white, minimal black
    lightPct = 40 * intensityMultiplier
    darkPct = 8 * intensityMultiplier
  } else if (luminance < 0.35) {
    // Dark colors: Need more white than black
    lightPct = 30 * intensityMultiplier
    darkPct = 12 * intensityMultiplier
  } else if (luminance < 0.50) {
    // Medium-dark colors: Balanced but favor white
    lightPct = 22 * intensityMultiplier
    darkPct = 18 * intensityMultiplier
  } else if (luminance < 0.65) {
    // Medium-light colors: Balanced but favor black
    lightPct = 18 * intensityMultiplier
    darkPct = 22 * intensityMultiplier
  } else if (luminance < 0.85) {
    // Light colors: Need more black than white
    lightPct = 12 * intensityMultiplier
    darkPct = 30 * intensityMultiplier
  } else {
    // Very light colors (e.g., #F5E6D3): Need minimal white, significant black
    lightPct = 8 * intensityMultiplier
    darkPct = 40 * intensityMultiplier
  }

  // Apply overrides or scaling, then clamp to [0,100]
  if (typeof lightOverride === 'number') lightPct = lightOverride
  else lightPct = lightPct * lightScale
  if (typeof darkOverride === 'number') darkPct = darkOverride
  else darkPct = darkPct * darkScale
  lightPct = Math.max(0, Math.min(100, lightPct))
  darkPct = Math.max(0, Math.min(100, darkPct))

  if (Platform.OS === 'web') {
    // Web: Use an absolute background layer so opacity does not affect children
    const dir = direction === 'top-to-bottom' ? '180deg' : '0deg'
    let backgroundImage: any
    if (endColor) {
      // Explicit end color override: simple two-stop gradient
      const startStop = `${baseColor} 0%`
      const endStop = `${endColor} 100%`
      backgroundImage = `linear-gradient(${dir}, ${startStop}, ${endStop})`
    } else if (fadeToTransparent) {
      // Fade from baseColor to fully transparent
      const startStop = `${baseColor} 0%`
      const endStopColor = `color-mix(in srgb, ${baseColor}, transparent 100%)`
      const endStop = `${endStopColor} 100%`
      backgroundImage = `linear-gradient(${dir}, ${startStop}, ${endStop})`
    } else {
      const start = `color-mix(in srgb, ${baseColor}, white ${lightPct}%) 0%`
      const mid = `${baseColor} 60%`
      const end = `color-mix(in srgb, ${baseColor}, black ${darkPct}%) 100%`
      backgroundImage = `linear-gradient(${dir}, ${start}, ${mid}, ${end})`
    }

    return (
      <View
        style={[
          {
            position: 'relative',
            overflow: 'hidden',
            borderRadius,
          } as ViewStyle,
          style,
        ]}
      >
        {/* Background gradient layer with configurable opacity */}
        <View
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            borderRadius,
            backgroundColor: fadeToTransparent ? ('transparent' as any) : (baseColor as any),
            backgroundImage,
            opacity: gradientOpacity,
          }}
        />
        {/* Content layer */}
        <View style={{ position: 'relative', zIndex: 1 }}>{children}</View>
      </View>
    )
  }

  // Native: Use overlay layers for gradient effect with adaptive opacity
  const topColor = direction === 'top-to-bottom' ? '#FFFFFF' : '#000000'
  const bottomColor = direction === 'top-to-bottom' ? '#000000' : '#FFFFFF'
  
  // Calculate opacity based on luminance spectrum (convert percentages to opacity)
  // Top overlay gets the light percentage, bottom gets the dark percentage
  const topOpacity = direction === 'top-to-bottom' 
    ? lightPct / 100  // White overlay on top for top-to-bottom
    : darkPct / 100   // Black overlay on top for bottom-to-top
    
  const bottomOpacity = direction === 'top-to-bottom'
    ? darkPct / 100   // Black overlay on bottom for top-to-bottom
    : lightPct / 100  // White overlay on bottom for bottom-to-top

  // Native explicit endColor: approximate base -> end with stepped overlays of endColor
  if (endColor) {
    const steps = [
      { top: '0%', height: '60%', opacity: 0.10 },
      { top: '60%', height: '20%', opacity: 0.30 },
      { top: '80%', height: '12%', opacity: 0.55 },
      { top: '92%', height: '8%', opacity: 0.80 },
    ]
    const isTopToBottom = direction === 'top-to-bottom'
    const mapped = isTopToBottom
      ? steps
      : steps.map((s) => ({
          top: undefined,
          bottom: s.top,
          height: s.height,
          opacity: s.opacity,
        }))

    return (
      <View
        style={[
          { position: 'relative', overflow: 'hidden', borderRadius },
          style,
        ]}
      >
        {/* Base color layer */}
        <View
          style={{
            position: 'absolute',
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
            borderRadius,
            backgroundColor: baseColor,
            opacity: gradientOpacity,
          }}
        />
        {/* Overlays toward endColor */}
        {mapped.map((s: any, idx) => (
          <View
            key={idx}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              ...(isTopToBottom
                ? { top: s.top as any }
                : { bottom: s.bottom as any }),
              height: s.height as any,
              backgroundColor: endColor,
              opacity: (s.opacity as number) * gradientOpacity,
              borderTopLeftRadius: isTopToBottom ? borderRadius : 0,
              borderTopRightRadius: isTopToBottom ? borderRadius : 0,
              borderBottomLeftRadius: isTopToBottom ? 0 : borderRadius,
              borderBottomRightRadius: isTopToBottom ? 0 : borderRadius,
            }}
          />
        ))}
        {/* Content layer */}
        <View style={{ position: 'relative', zIndex: 1 }}>{children}</View>
      </View>
    )
  }

  // Native fallback
  if (fadeToTransparent) {
    // Approximate a fade-to-transparent with stepped overlays from top to bottom
    // to avoid extra dependencies. This degrades gracefully on native.
    const steps = [
      { top: '0%', height: '60%', opacity: 1.0 },
      { top: '60%', height: '20%', opacity: 0.6 },
      { top: '80%', height: '12%', opacity: 0.35 },
      { top: '92%', height: '8%', opacity: 0.15 },
    ]
    const isTopToBottom = direction === 'top-to-bottom'
    const mapped = isTopToBottom
      ? steps
      : steps.map((s) => ({
          top: undefined,
          bottom: s.top,
          height: s.height,
          opacity: s.opacity,
        }))

    return (
      <View
        style={[
          { position: 'relative', overflow: 'hidden', borderRadius },
          style,
        ]}
      >
        {mapped.map((s: any, idx) => (
          <View
            key={idx}
            style={{
              position: 'absolute',
              left: 0,
              right: 0,
              ...(isTopToBottom
                ? { top: s.top as any }
                : { bottom: s.bottom as any }),
              height: s.height as any,
              backgroundColor: baseColor,
              opacity: (s.opacity as number) * gradientOpacity,
              borderTopLeftRadius: isTopToBottom ? borderRadius : 0,
              borderTopRightRadius: isTopToBottom ? borderRadius : 0,
              borderBottomLeftRadius: isTopToBottom ? 0 : borderRadius,
              borderBottomRightRadius: isTopToBottom ? 0 : borderRadius,
            }}
          />
        ))}
        {/* Content layer */}
        <View style={{ position: 'relative', zIndex: 1 }}>{children}</View>
      </View>
    )
  }

  return (
    <View
      style={[
        { position: 'relative', overflow: 'hidden', borderRadius },
        style,
      ]}
    >
      {/* Base color layer with configurable opacity */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          bottom: 0,
          left: 0,
          borderRadius,
          backgroundColor: baseColor,
          opacity: gradientOpacity,
        }}
      />
      {/* Top gradient overlay */}
      <View
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: '50%',
          backgroundColor: topColor,
          opacity: topOpacity * gradientOpacity,
          borderTopLeftRadius: borderRadius,
          borderTopRightRadius: borderRadius,
        }}
      />
      {/* Bottom gradient overlay */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: '50%',
          backgroundColor: bottomColor,
          opacity: bottomOpacity * gradientOpacity,
          borderBottomLeftRadius: borderRadius,
          borderBottomRightRadius: borderRadius,
        }}
      />
      {/* Content layer */}
      <View style={{ position: 'relative', zIndex: 1 }}>{children}</View>
    </View>
  )
}
