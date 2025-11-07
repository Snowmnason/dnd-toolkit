import { $, useScale, UseTheme } from '@/theme'
import * as Haptics from 'expo-haptics'
import React, { useEffect, useRef } from 'react'
import { Animated, Pressable, View } from 'react-native'
import { Body } from './AppText'

interface RadioButtonProps {
  checked?: boolean
  onChange?: (value: boolean) => void
  label?: string
  disabled?: boolean
  color?: string                 // accent override
  size?: number                  // circle diameter
}

/**
 * 🔘 RadioButton
 * Animated, theme-aware radio circle with inner accent dot.
 */
export function RadioButton({
  checked = false,
  onChange,
  label,
  disabled = false,
  color = $('accent'),
  size = 22,
}: RadioButtonProps) {
  const { theme } = UseTheme()
  const S = useScale()
  const anim = useRef(new Animated.Value(checked ? 1 : 0)).current

  useEffect(() => {
    Animated.timing(anim, {
      toValue: checked ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start()
  }, [checked, anim])

  const innerScale = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  })

  const handlePress = () => {
    if (disabled) return
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    onChange?.(!checked)
  }

  return (
    <Pressable
      onPress={handlePress}
      disabled={disabled}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: S.space.sm,
        opacity: disabled ? 0.6 : 1,
      }}
    >
      <View
        style={{
          width: size,
          height: size,
          borderRadius: size / 2,
          borderWidth: 2,
          borderColor: checked ? color : $('borderSubtle' as any),
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: $('surface', theme),
        }}
      >
        <Animated.View
          style={{
            width: size / 2.4,
            height: size / 2.4,
            borderRadius: size / 4.8,
            backgroundColor: color,
            transform: [{ scale: innerScale }],
          }}
        />
      </View>

      {label && (
        <Body
          style={{
            color: $('textPrimary', theme),
            fontSize: 15,
          }}
        >
          {label}
        </Body>
      )}
    </Pressable>
  )
}
