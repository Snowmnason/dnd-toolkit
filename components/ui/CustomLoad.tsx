import { $, UseTheme } from '@/theme'
import React, { useEffect, useState } from 'react'
import { ActivityIndicator, Image, ImageProps } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

interface CustomLoadProps extends Omit<ImageProps, 'source' | 'style'> {
  size?: 'small' | 'medium' | 'large' | 'xlarge' | number
  resizeMode?: 'cover' | 'contain' | 'stretch' | 'repeat' | 'center'
  variant?: 'default' | 'accent' | 'minimal'
  style?: ImageProps['style']
}

export default function CustomLoad({
  size = 'large',
  resizeMode = 'contain',
  variant = 'default',
  style,
  ...props
}: CustomLoadProps) {
  const [failed, setFailed] = useState(false)
  const opacity = useSharedValue(0)
  
  // Try to get theme; fall back to hardcoded colors if provider not available
  let themeContext: any = null;
  try {
    themeContext = UseTheme()
  } catch {
    // Theme provider not available (e.g., during early initialization)
  }
  
  const theme = themeContext?.theme

  useEffect(() => {
    opacity.value = withTiming(1, { duration: 300 })
  }, [opacity])

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))

  const getSizeValue = (): number => {
    switch (size) {
      case 'small': return 30
      case 'medium': return 50
      case 'large': return 100
      case 'xlarge': return 150
      default: return typeof size === 'number' ? size : 60
    }
  }

  const activitySize = getSizeValue() <= 30 ? 'small' : 'large'
  
  // Fallback colors if theme not available
  const fallbackColors = {
    accent: '#D4AF37',
    textPrimary: '#F5E6D3',
    primary: '#8b4513ff',
  }
  
  const color = theme
    ? (variant === 'accent'
        ? $('accent', theme)
        : variant === 'minimal'
        ? $('textPrimary', theme)
        : $('primary', theme))
    : (variant === 'accent'
        ? fallbackColors.accent
        : variant === 'minimal'
        ? fallbackColors.textPrimary
        : fallbackColors.primary)

  return (
    <Animated.View style={animatedStyle}>
      {failed ? (
        <ActivityIndicator size={activitySize} color={color} style={style} />
      ) : (
        <Image
          source={require('../../assets/images/load.gif')}
          style={[{ width: getSizeValue(), height: getSizeValue() }, style]}
          resizeMode={resizeMode}
          onError={() => setFailed(true)}
          {...props}
        />
      )}
    </Animated.View>
  )
}
