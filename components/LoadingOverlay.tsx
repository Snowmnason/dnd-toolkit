import { $ } from '@/theme'
import React from 'react'
import { Platform } from 'react-native'
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'
import { Body } from './ui/AppText'
import CustomLoad from './ui/CustomLoad'

interface LoadingOverlayProps {
  message?: string
  error?: Error | null
  assetsLoaded?: boolean
}

export default function LoadingOverlay({
  message = 'Loading...',
  error,
  assetsLoaded = false,
}: LoadingOverlayProps) {
  React.useEffect(() => {
    if (Platform.OS === 'web') {
      const activeElement = document.activeElement as HTMLElement
      if (activeElement?.blur) activeElement.blur()
    }
  }, [])

  const displayMessage = assetsLoaded ? 'Checking authentication...' : message

  // subtle fade-in
  const opacity = useSharedValue(0)
  React.useEffect(() => {
    opacity.value = withTiming(1, { duration: 400 })
  }, [opacity])
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }))

  return (
    <Animated.View
      style={[
        {
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: $('background'),
          zIndex: 9999,
        },
        animatedStyle,
      ]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={displayMessage}
    >
      <CustomLoad />

      <Body
        style={{
          marginTop: 20,
          color: $('textPrimary'),
          textAlign: 'center',
          fontSize: 16,
        }}
      >
        {displayMessage}
      </Body>

      {error && (
        <Body
          style={{
            marginTop: 10,
            color: $('accent'),
            textAlign: 'center',
            fontSize: 12,
            opacity: 0.8,
            paddingHorizontal: 20,
          }}
        >
          Some assets failed to load but the app will continue...
        </Body>
      )}
    </Animated.View>
  )
}
