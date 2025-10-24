import { IconButton } from '@/components/ui'
import { $, S, tone } from '@/theme'
import * as Haptics from 'expo-haptics'
import React, { useEffect, useState } from 'react'
import { Animated, Pressable, View } from 'react-native'

interface ToggleItem {
  key: string
  icon: string | React.ReactNode
  color?: string
  tooltip?: string
}

interface ToggleGroupProps {
  items: ToggleItem[]
  defaultActive?: string[]
  exclusive?: boolean
  maxActive?: number
  onChange?: (activeKeys: string[]) => void
  direction?: 'horizontal' | 'vertical'
  spacing?: keyof typeof S.space
}

/**
 * 🎛️ ToggleGroup (Enhanced)
 * Icon-based control with hover + active tint and haptic press feedback.
 */
export function ToggleGroup({
  items,
  defaultActive = [],
  exclusive = true,
  maxActive,
  onChange,
  direction = 'horizontal',
  spacing = 'sm',
}: ToggleGroupProps) {
  const [activeKeys, setActiveKeys] = useState<string[]>(defaultActive)

  useEffect(() => {
    onChange?.(activeKeys)
  }, [activeKeys, onChange])

  const handleToggle = (key: string) => {
    setActiveKeys((prev) => {
      if (exclusive) return prev.includes(key) ? [] : [key]
      if (maxActive) {
        const isActive = prev.includes(key)
        if (isActive) return prev.filter((k) => k !== key)
        if (prev.length >= maxActive) return [...prev.slice(1), key]
        return [...prev, key]
      }
      return prev.includes(key)
        ? prev.filter((k) => k !== key)
        : [...prev, key]
    })
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
  }

  return (
    <View
      style={{
        flexDirection: direction === 'horizontal' ? 'row' : 'column',
        gap: S.space[spacing],
      }}
    >
      {items.map((item) => {
        const isActive = activeKeys.includes(item.key)
        const scale = new Animated.Value(1) // ✅ no hook, safe inside map

        const animateScale = (toValue: number) =>
          Animated.spring(scale, {
            toValue,
            friction: 5,
            tension: 200,
            useNativeDriver: true,
          }).start()

        return (
          <Animated.View key={item.key} style={{ transform: [{ scale }] }}>
            <Pressable
              onPressIn={() => animateScale(0.9)}
              onPressOut={() => animateScale(1)}
              onPress={() => handleToggle(item.key)}
              style={({ pressed }) => ({
                backgroundColor: pressed
                  ? tone($('surface'), 'accent')
                  : isActive
                  ? tone($('accent'), 'alt')
                  : 'transparent',
                borderRadius: S.radius.md,
                padding: 4,
              })}
            >
              <IconButton
                icon={item.icon}
                color={isActive ? '$accent' : item.color ?? '$textSecondary'}
              />
            </Pressable>
          </Animated.View>
        )
      })}
    </View>
  )
}
