import { $, tone, useScale } from '@/theme'
import * as Haptics from 'expo-haptics'
import React, { useState } from 'react'
import { Animated, Easing, Pressable, View } from 'react-native'
import { Body, ObjHeading } from './AppText'

interface SwitchProps {
  checked?: boolean
  onChange?: (value: boolean) => void
  disabled?: boolean
  /** Optional heading above the switch row */
  heading?: string
  /** Optional left label (e.g., "Off", "Dark") */
  leftLabel?: string
  /** Optional right label (e.g., "On", "Light") */
  rightLabel?: string
}

/**
 * ⚙️ Switch (v2)
 * Animated switch with optional heading and side labels.
 * Supports accessibility and haptic feedback.
 */
export function Switch({
  checked = false,
  onChange,
  disabled = false,
  heading,
  leftLabel,
  rightLabel,
}: SwitchProps) {
  const S = useScale()
  const [isOn, setIsOn] = useState(checked)
  const anim = React.useRef(new Animated.Value(checked ? 1 : 0)).current

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
    <View style={{ width: '100%' }}>
      {/* Heading (above switch row) */}
      {heading && (
        <ObjHeading style={{ marginBottom: S.space.xs }}>
          {heading}
        </ObjHeading>
      )}

      <Pressable
        onPress={toggle}
        disabled={disabled}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          opacity: disabled ? 0.6 : 1,
          gap: S.space.sm,
        }}
      >
        {/* Left Label */}
        {leftLabel && (
          <Body style={{ color: $('textSecondary'), fontSize: 14 }}>
            {leftLabel}
          </Body>
        )}

        {/* Switch */}
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

        {/* Right Label */}
        {rightLabel && (
          <Body style={{ color: $('textSecondary'), fontSize: 14 }}>
            {rightLabel}
          </Body>
        )}
      </Pressable>
    </View>
  )
}
