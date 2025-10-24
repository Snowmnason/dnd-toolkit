import { $, S, tone } from '@/theme'
import * as Haptics from 'expo-haptics'
import React, { useState } from 'react'
import { Animated, Easing, Pressable } from 'react-native'
import { Body } from './AppText'

interface SwitchProps {
  checked?: boolean
  onChange?: (value: boolean) => void
  disabled?: boolean
  label?: string
}

export function Switch({
  checked = false,
  onChange,
  disabled = false,
  label,
}: SwitchProps) {
  const [isOn, setIsOn] = useState(checked)
  const anim = React.useRef(new Animated.Value(checked ? 1 : 0)).current

  // Animate thumb and color when toggled
  const toggle = () => {
    if (disabled) return
    const newState = !isOn
    setIsOn(newState)
    onChange?.(newState)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    Animated.timing(anim, {
      toValue: newState ? 1 : 0,
      duration: 200,
      easing: Easing.out(Easing.ease),
      useNativeDriver: false,
    }).start()
  }

  const thumbTranslate = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [2, 22],
  })

  const trackColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [tone($('borderSubtle'), 'alt'), $('accent')],
  })

  return (
    <Pressable
      onPress={toggle}
      disabled={disabled}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        opacity: disabled ? 0.6 : 1,
        gap: S.space.sm,
      }}
    >
      <Animated.View
        style={{
          width: 40,
          height: 24,
          borderRadius: 24,
          backgroundColor: trackColor,
          justifyContent: 'center',
          paddingHorizontal: 2,
        }}
      >
        <Animated.View
          style={{
            width: 20,
            height: 20,
            borderRadius: 10,
            backgroundColor: $('surface'),
            transform: [{ translateX: thumbTranslate }],
            shadowColor: '#000',
            shadowOpacity: 0.25,
            shadowRadius: 2,
            shadowOffset: { width: 0, height: 1 },
          }}
        />
      </Animated.View>

      {label && (
        <Body
          style={{
            color: $('textPrimary'),
            fontSize: 14,
          }}
        >
          {label}
        </Body>
      )}
    </Pressable>
  )
}
