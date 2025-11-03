import { $, useScale, UseTheme } from '@/theme'
import React, { useState } from 'react'
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
import { GradientView } from './Resuables/GradientView'
import { getShadowStyle } from './Resuables/shadows'

interface AppTooltipProps {
  text: string
  delay?: number
  gradientIntensity?: 'subtle' | 'moderate' | 'dramatic'
  children: React.ReactNode
}

/**
 * 💬 AppTooltip
 * Cross-platform tooltip for hover (web) or press-hold (mobile).
 */
export function AppTooltip({ 
  text, 
  delay = 500, 
  gradientIntensity = 'moderate',
  children 
}: AppTooltipProps) {
  const { theme } = UseTheme()
  const S = useScale()
  const [visible, setVisible] = useState(false)
  const opacity = useSharedValue(0)
  const translateY = useSharedValue(6)
  let timer: ReturnType<typeof setTimeout> | null = null

  const show = () => {
    timer = setTimeout(() => {
      setVisible(true)
      opacity.value = withTiming(1, { duration: 200 })
      translateY.value = withTiming(0, { duration: 200 })
    }, delay)
  }

  const hide = () => {
    if (timer) clearTimeout(timer)
    opacity.value = withTiming(0, { duration: 150 })
    translateY.value = withTiming(6, { duration: 150 }, () => {
      setVisible(false)
    })
  }

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }))

  const styles = React.useMemo(() => StyleSheet.create({
    tooltip: {
      position: 'absolute',
      bottom: '100%',
      left: '50%',
      transform: [{ translateX: -50 }],
      borderRadius: S.radius.sm,
      ...getShadowStyle('softer'),
      marginBottom: S.space.xs,
      zIndex: 100,
      overflow: 'hidden',
    },
    text: {
      fontSize: S.font.caption,
      textAlign: 'center',
    },
  }), [S])

  const baseColor = $('surfaceAlt' as any)

  return (
    <Pressable
      onHoverIn={Platform.OS === 'web' ? show : undefined}
      onHoverOut={Platform.OS === 'web' ? hide : undefined}
      onPressIn={Platform.OS !== 'web' ? show : undefined}
      onPressOut={Platform.OS !== 'web' ? hide : undefined}
    >
      <View>
        {children}
        {visible && (
          <Animated.View style={[styles.tooltip, animatedStyle]}>
            <GradientView
              baseColor={baseColor}
              intensity={gradientIntensity}
              borderRadius={S.radius.sm}
              style={{ 
                paddingHorizontal: S.space.sm,
                paddingVertical: S.space.xs,
              }}
            >
              <Text style={[styles.text, { color: $('textPrimary', theme) }]}>{text}</Text>
            </GradientView>
          </Animated.View>
        )}
      </View>
    </Pressable>
  )
}

// styles now created per-scale inside component
