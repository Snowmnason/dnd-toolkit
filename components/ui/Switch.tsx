import { $, tone, useScale, UseTheme } from '@/theme'
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
  const { theme } = UseTheme()
  const [isOn, setIsOn] = useState(checked)
  const anim = React.useRef(new Animated.Value(checked ? 1 : 0)).current

  // Sync internal state with external checked prop
  React.useEffect(() => {
    if (checked !== isOn) {
      setIsOn(checked)
      Animated.timing(anim, {
        toValue: checked ? 1 : 0,
        duration: 200,
        easing: Easing.out(Easing.ease),
        useNativeDriver: false,
      }).start()
    }
  }, [checked, isOn, anim])

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

  // Scale-aware dimensions
  const trackWidth = S.space.lg * 1.5  // ~40-48px depending on scale
  const trackHeight = S.space.md       // ~24-28px depending on scale
  const thumbSize = trackHeight - 4    // thumb is 4px smaller than track height
  const thumbTravel = trackWidth - thumbSize - 4  // travel distance (accounting for 2px padding on each side)

  const thumbTranslate = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [2, thumbTravel],
  })

  const trackColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [tone($('borderSubtle', theme), 'alt', undefined, undefined, theme), $('accent', theme)],
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
          <Body style={{ color: $('textSecondary', theme), fontSize: 14 }}>
            {leftLabel}
          </Body>
        )}

        {/* Switch */}
        <Animated.View
          style={{
            width: trackWidth,
            height: trackHeight,
            borderRadius: trackHeight,
            backgroundColor: trackColor,
            justifyContent: 'center',
            paddingHorizontal: 2,
          }}
        >
          <Animated.View
            style={{
              width: thumbSize,
              height: thumbSize,
              borderRadius: thumbSize / 2,
              backgroundColor: $('surface', theme),
              transform: [{ translateX: thumbTranslate }],
              boxShadow: `0px 1px 2px #000`,
            }}
          />
        </Animated.View>

        {/* Right Label */}
        {rightLabel && (
          <Body style={{ color: $('textSecondary', theme), fontSize: 14 }}>
            {rightLabel}
          </Body>
        )}
      </Pressable>
    </View>
  )
}
