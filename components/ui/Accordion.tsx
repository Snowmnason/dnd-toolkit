import { $, S, tone } from '@/theme'
import * as Haptics from 'expo-haptics'
import React, { useRef, useState } from 'react'
import { Animated, Pressable, View } from 'react-native'
import { Body, ObjHeading } from './AppText'

interface AccordionProps {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
  bordered?: boolean
}

/**
 * 🗂 Accordion
 * Expand/collapse container for notes or detail sections.
 */
export function Accordion({
  title,
  children,
  defaultOpen = false,
  bordered = true,
}: AccordionProps) {
  const [open, setOpen] = useState(defaultOpen)
  const animation = useRef(new Animated.Value(defaultOpen ? 1 : 0)).current

  const toggle = () => {
    setOpen((prev) => !prev)
    Haptics.selectionAsync()
    Animated.spring(animation, {
      toValue: open ? 0 : 1,
      friction: 8,
      useNativeDriver: false,
    }).start()
  }

  const height = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1000],
  })
  const opacity = animation.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  })

  return (
    <View
      style={{
        marginBottom: S.space.md,
        borderWidth: bordered ? 1 : 0,
        borderColor: bordered ? tone($('border'), 'subtle') : 'transparent',
        borderRadius: S.radius.md,
        backgroundColor: tone($('surface'), 'alt'),
        overflow: 'hidden',
      }}
    >
      <Pressable
        onPress={toggle}
        style={{
          paddingVertical: S.space.sm,
          paddingHorizontal: S.space.md,
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <ObjHeading>{title}</ObjHeading>
        <Body style={{ color: $('accent') }}>{open ? '−' : '+'}</Body>
      </Pressable>

      <Animated.View
        style={{
          height,
          opacity,
          overflow: 'hidden',
          paddingHorizontal: S.space.md,
          paddingBottom: open ? S.space.md : 0,
        }}
      >
        {children}
      </Animated.View>
    </View>
  )
}
