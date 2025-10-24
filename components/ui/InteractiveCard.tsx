import * as Haptics from 'expo-haptics'
import React from 'react'
import { Animated, Pressable } from 'react-native'
import { Card } from './Card'

interface InteractiveCardProps {
  onPress?: () => void
  disabled?: boolean
  toneVariant?: 'base' | 'accent' | 'alt'
  children: React.ReactNode
}

/**
 * 🪄 InteractiveCard
 * A clickable, animated card for selectable panels or large buttons.
 */
export function InteractiveCard({
  onPress,
  disabled = false,
  toneVariant = 'base',
  children,
}: InteractiveCardProps) {
  const scale = React.useRef(new Animated.Value(1)).current

  const handlePressIn = () => {
    Animated.spring(scale, {
      toValue: 0.97,
      useNativeDriver: true,
    }).start()
  }

  const handlePressOut = () => {
    Animated.spring(scale, {
      toValue: 1,
      friction: 5,
      tension: 200,
      useNativeDriver: true,
    }).start()
  }

  const handlePress = () => {
    if (disabled) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onPress?.()
  }

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={handlePress}
        disabled={disabled}
        style={({ pressed }) => ({
          opacity: pressed ? 0.95 : 1,
          transform: [{ scale: pressed ? 0.98 : 1 }],
        })}
      >
        <Card
          toneVariant={toneVariant}
          shadow
          bordered
        >
          {children}
        </Card>
      </Pressable>
    </Animated.View>
  )
}
