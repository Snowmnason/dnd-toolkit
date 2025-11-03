import { $, tone, useScale, UseTheme } from '@/theme'
import * as Haptics from 'expo-haptics'
import React, { useEffect, useState } from 'react'
import { Animated, LayoutChangeEvent, Platform, Pressable, ScrollView, View } from 'react-native'
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
  bottomSpace?: boolean // Add space below tabs for content separation
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
  bottomSpace = true,
}: TabsProps) {
  const { theme } = UseTheme()
  const S = useScale()
  const [active, setActive] = useState(defaultActive ?? tabs[0]?.key)
  const [underlineX] = useState(new Animated.Value(0))
  const [underlineWidth] = useState(new Animated.Value(0))
  const [tabLayouts, setTabLayouts] = useState<Record<string, { x: number; w: number }>>({})

  useEffect(() => {
    onChange?.(active)
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
    <View style={{ marginBottom: bottomSpace ? S.space.md : 0 }}>
      <View
        style={{
          borderBottomWidth: 1,
          borderBottomColor: $('borderSubtle' as any, theme),
        }}
      >
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={true}
          contentContainerStyle={{
            flexDirection: 'row',
            justifyContent: fullWidth ? 'space-around' : 'flex-start',
            flexGrow: fullWidth ? 1 : 0,
          }}
          style={
            Platform.OS === 'web'
              ? ({
                  scrollbarWidth: 'thin',
                  scrollbarColor: `${tone($('textSecondary', theme), 'changeOpacity', undefined, 0.8, theme)} transparent`,
                } as any)
              : {}
          }
        >
          {tabs.map((tab) => {
            const isActive = active === tab.key
            return (
              <Pressable
                key={tab.key}
                onPress={() => {
                  // Trigger haptics only on explicit user interaction and only on native
                  if (Platform.OS === 'ios' || Platform.OS === 'android') {
                    Haptics.selectionAsync()
                  }
                  setActive(tab.key)
                }}
                onLayout={(e) => handleLayout(tab.key, e)}
                style={{
                  paddingVertical: S.space.sm,
                  paddingHorizontal: S.space.md,
                }}
              >
                <Body
                  style={{
                    color: isActive ? $('accent', theme) : $('textSecondary', theme),
                    fontWeight: isActive ? '600' : '400',
                  }}
                >
                  {tab.label}
                </Body>
              </Pressable>
            )
          })}
        </ScrollView>
      </View>

      {/* underline */}
      <Animated.View
        style={{
          position: 'absolute',
          bottom: 0,
          left: underlineX,
          width: underlineWidth,
          height: 2,
          backgroundColor: $('accent', theme),
          borderRadius: 1,
        }}
      />
    </View>
  )
}
