import { $, UseTheme } from '@/theme'
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

function LoadingOverlayContent({
  message = 'Loading...',
  error,
  assetsLoaded = false,
}: LoadingOverlayProps) {
  const { theme } = UseTheme()

  React.useEffect(() => {
    if (Platform.OS === 'web') {
      const activeElement = document.activeElement as HTMLElement
      if (activeElement?.blur) activeElement.blur()
    }
  }, [])

  const displayMessage = React.useMemo(
    () => (assetsLoaded ? 'Checking authentication...' : message),
  [assetsLoaded, message]
  )

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
          backgroundColor: `${$('background', theme)}E6`, // adds ~90% alpha
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
          color: $('textPrimary', theme),
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
            color: $('accent', theme),
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

// Error boundary wrapper to handle theme provider errors
class LoadingOverlayErrorBoundary extends React.Component<
  LoadingOverlayProps,
  { hasError: boolean }
> {
  constructor(props: LoadingOverlayProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.warn('LoadingOverlay error (likely ThemeProvider not ready):', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      // Fallback UI without theme
      return (
        <Animated.View
          style={{
            flex: 1,
            justifyContent: 'center',
            alignItems: 'center',
            backgroundColor: '#1a1a1aE6',
            zIndex: 9999,
          }}
          accessible
          accessibilityRole="progressbar"
          accessibilityLabel={this.props.message || 'Loading...'}
        >
          <CustomLoad />
        </Animated.View>
      )
    }

    return <LoadingOverlayContent {...this.props} />
  }
}

export default LoadingOverlayErrorBoundary
