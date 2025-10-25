import { $, tone, useScale, UseTheme } from '@/theme'
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

interface AppTooltipProps {
  text: string
  delay?: number
  children: React.ReactNode
}

/**
 * 💬 AppTooltip
 * Cross-platform tooltip for hover (web) or press-hold (mobile).
 */
export function AppTooltip({ text, delay = 500, children }: AppTooltipProps) {
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
      paddingHorizontal: S.space.sm,
      paddingVertical: S.space.xs,
      borderRadius: S.radius.sm,
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)',
      elevation: 3,
      marginBottom: S.space.xs,
      zIndex: 100,
    },
    text: {
      fontSize: S.font.caption,
      textAlign: 'center',
    },
  }), [S])

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
          <Animated.View style={[
            styles.tooltip, 
            animatedStyle,
            { backgroundColor: tone($('surface', theme), 'alt', undefined, undefined, theme) }
          ]}>
            <Text style={[styles.text, { color: $('textPrimary', theme) }]}>{text}</Text>
          </Animated.View>
        )}
      </View>
    </Pressable>
  )
}

// styles now created per-scale inside component
