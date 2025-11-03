import { $, useScale, UseTheme } from '@/theme'
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
  const S = useScale()
  const { theme } = UseTheme()
  const [open, setOpen] = useState(defaultOpen)
  const [contentHeight, setContentHeight] = useState(0)
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
    outputRange: [0, contentHeight + 50], // content height + 50px padding
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
        borderColor: bordered ? $('borderSubtle' as any, theme) : 'transparent',
        borderRadius: S.radius.md,
        backgroundColor: $('surfaceAlt' as any, theme),
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
        <Body style={{ color: $('accent', theme) }}>{open ? '−' : '+'}</Body>
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
        <View
          onLayout={(event) => {
            const measuredHeight = event.nativeEvent.layout.height
            if (measuredHeight > 0 && measuredHeight !== contentHeight) {
              setContentHeight(measuredHeight)
            }
          }}
        >
          {children}
        </View>
      </Animated.View>
    </View>
  )
}
