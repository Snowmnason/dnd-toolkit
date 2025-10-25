import { $, tone, useScale } from '@/theme'
import * as Haptics from 'expo-haptics'
import React, { useEffect, useState } from 'react'
import { Animated, LayoutChangeEvent, Pressable, View } from 'react-native'
import { Body } from './AppText'

interface TabItem {
  key: string
  label: string
}

interface TabsProps {
  tabs: TabItem[]
  defaultActive?: string
  onChange?: (key: string) => void
  fullWidth?: boolean
}

/**
 * 🧭 Tabs
 * Simple tab bar with animated underline and theme-aware tones.
 */
export function Tabs({
  tabs,
  defaultActive,
  onChange,
  fullWidth = false,
}: TabsProps) {
  const S = useScale()
  const [active, setActive] = useState(defaultActive ?? tabs[0]?.key)
  const [underlineX] = useState(new Animated.Value(0))
  const [underlineWidth] = useState(new Animated.Value(0))
  const [tabLayouts, setTabLayouts] = useState<Record<string, { x: number; w: number }>>({})

  useEffect(() => {
    onChange?.(active)
    Haptics.selectionAsync()
    const layout = tabLayouts[active]
    if (layout) {
      Animated.parallel([
        Animated.timing(underlineX, {
          toValue: layout.x,
          duration: 200,
          useNativeDriver: false,
        }),
        Animated.timing(underlineWidth, {
          toValue: layout.w,
          duration: 200,
          useNativeDriver: false,
        }),
      ]).start()
    }
  }, [active, tabLayouts, onChange, underlineWidth, underlineX])

  const handleLayout = (key: string, e: LayoutChangeEvent) => {
    const { x, width } = e.nativeEvent.layout
    setTabLayouts((prev) => ({ ...prev, [key]: { x, w: width } }))
  }

  return (
    <View>
      <View
        style={{
          flexDirection: 'row',
          justifyContent: fullWidth ? 'space-around' : 'flex-start',
          borderBottomWidth: 1,
          borderBottomColor: tone($('border'), 'subtle'),
        }}
      >
        {tabs.map((tab) => {
          const isActive = active === tab.key
          return (
            <Pressable
              key={tab.key}
              onPress={() => setActive(tab.key)}
              onLayout={(e) => handleLayout(tab.key, e)}
              style={{
                paddingVertical: S.space.sm,
                paddingHorizontal: S.space.md,
              }}
            >
              <Body
                style={{
                  color: isActive ? $('accent') : $('textSecondary'),
                  fontWeight: isActive ? '600' : '400',
                }}
              >
                {tab.label}
              </Body>
            </Pressable>
          )
        })}
      </View>

      {/* underline */}
      <Animated.View
        style={{
          position: 'absolute',
          bottom: 0,
          left: underlineX,
          width: underlineWidth,
          height: 2,
          backgroundColor: $('accent'),
          borderRadius: 1,
        }}
      />
    </View>
  )
}
