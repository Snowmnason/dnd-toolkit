import { $, S, tone } from '@/theme'
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
            <Text style={[styles.text, { color: $('textPrimary') }]}>{text}</Text>
          </Animated.View>
        )}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  tooltip: {
    position: 'absolute',
    bottom: '100%',
    left: '50%',
    transform: [{ translateX: -50 }],
    backgroundColor: tone($('surface'), 'alt'),
    paddingHorizontal: S.space.sm,
    paddingVertical: S.space.xs,
    borderRadius: S.radius.sm,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
    elevation: 3,
    marginBottom: S.space.xs,
    zIndex: 100,
  },
  text: {
    fontSize: S.font.sm,
    textAlign: 'center',
  },
})
