import { $, tone, useScale, UseTheme } from '@/theme'
import * as Haptics from 'expo-haptics'
import { useEffect, useState } from 'react'
import { Pressable, View } from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'
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
  
  // Reanimated shared values
  const animProgress = useSharedValue(checked ? 1 : 0)

  // Sync internal state with external checked prop
  useEffect(() => {
    if (checked !== isOn) {
      setIsOn(checked)
      animProgress.value = withTiming(checked ? 1 : 0, { duration: 200 })
    }
  }, [checked, isOn, animProgress])

  const toggle = () => {
    if (disabled) return
    const newState = !isOn
    setIsOn(newState)
    onChange?.(newState)
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)
    animProgress.value = withTiming(newState ? 1 : 0, { duration: 200 })
  }

  // Scale-aware dimensions
  const trackWidth = S.space.lg * 1.5  // ~40-48px depending on scale
  const trackHeight = S.space.md       // ~24-28px depending on scale
  const thumbSize = trackHeight - 4    // thumb is 4px smaller than track height
  const thumbTravel = trackWidth - thumbSize - 8  // travel distance (accounting for 2px padding on each side)

  // Animated styles
  const thumbTransformStyle = useAnimatedStyle(() => ({
    transform: [
      {
        translateX: animProgress.value * thumbTravel + 2,
      },
    ],
  }))

  // Pre-compute off and on colors outside animated style
  const offColor = tone($('borderSubtle', theme), 'alt', undefined, undefined, theme)
  const onColor = tone($('accent', theme), 'base', undefined, undefined, theme)

  const trackColorStyle = useAnimatedStyle(() => {
    // Simple color interpolation (0 = off, 1 = on)
    return {
      backgroundColor: animProgress.value === 0 ? offColor : onColor,
    }
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

        {/* Switch Track */}
        <Animated.View
          style={[
            {
              width: trackWidth,
              height: trackHeight,
              borderRadius: trackHeight,
              justifyContent: 'center',
              paddingHorizontal: 2,
            },
            trackColorStyle,
          ]}
        >
          {/* Switch Thumb */}
          <Animated.View
            style={[
              {
                width: thumbSize,
                height: thumbSize,
                borderRadius: thumbSize / 2,
                backgroundColor: $('surface'),
              },
              thumbTransformStyle,
            ]}
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
