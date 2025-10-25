import { IconSymbol } from '@/components/built-in/icon-symbol'
import { Body, ObjHeading, TextType } from '@/components/ui/AppText'
import { $, tone, useScale } from '@/theme'
import React, { useMemo, useState } from 'react'
import {
  FlatList,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

interface DropdownItem {
  label: string
  value: string
}

interface DropdownProps {
  items: DropdownItem[]
  value: string | null
  onChange: (value: string | null) => void
  placeholder?: string
  enableSearch?: boolean
  heading?: string
  textType?: TextType
  style?: any
}

export default function Dropdown({
  items,
  value,
  onChange,
  placeholder = 'Select an option',
  enableSearch = false,
  heading,
  textType = 'secondary',
  style,
}: DropdownProps) {
  const S = useScale()
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const rotate = useSharedValue(0)
  const scale = useSharedValue(0.9)
  const opacity = useSharedValue(0)
  const shadow = useSharedValue(0)

  const borderColor = $('accent')
  const background = $('surface')

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotate.value}deg` }],
  }))

  const dropdownAnimStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ scale: scale.value }],
    shadowOpacity: 0.1 + shadow.value * 0.15,
    shadowRadius: 4 + shadow.value * 3,
    elevation: 1 + shadow.value * 4,
  }))

  const toggleDropdown = () => {
    const toOpen = !isOpen
    setIsOpen(toOpen)
    rotate.value = withTiming(toOpen ? 180 : 0, { duration: 220 })

    if (toOpen) {
      opacity.value = withTiming(1, { duration: 100 })
      scale.value = withSpring(1, { damping: 12, stiffness: 120, mass: 0.6 })
      shadow.value = withTiming(1, { duration: 200 })
    } else {
      opacity.value = withTiming(0, { duration: 150 })
      scale.value = withSpring(0.9, { damping: 15, stiffness: 120, mass: 0.6 })
      shadow.value = withTiming(0, { duration: 150 })
    }
  }

  const filteredItems = useMemo(() => {
    if (!enableSearch || search.trim() === '') return items
    return items.filter((i) => i.label.toLowerCase().includes(search.trim().toLowerCase()))
  }, [items, search, enableSearch])

  const selectedLabel = items.find((item) => item.value === value)?.label || placeholder

  return (
    <View style={[{ width: '100%' }, style]}>
      {heading ? (
        <ObjHeading textType={textType} style={{ marginBottom: S.space.xs, marginLeft: S.space.xs }}>
          {heading}
        </ObjHeading>
      ) : null}

      <TouchableOpacity
        accessibilityRole="button"
        activeOpacity={0.8}
        onPress={toggleDropdown}
        style={[
          styles.header,
          {
            borderColor,
            backgroundColor: background,
            borderRadius: S.radius.md,
            paddingVertical: S.space.sm,
            paddingHorizontal: S.space.md,
          },
        ]}
      >
        <Body textType={value ? textType : 'secondary'} style={{ flex: 1 }}>
          {selectedLabel}
        </Body>
        <Animated.View style={chevronStyle}>
          <IconSymbol
            name="chevron.right"
            size={18}
            weight="medium"
            color={$(`textSecondary`)}
            style={{ transform: [{ rotate: isOpen ? '90deg' : '0deg' }] }}
          />
        </Animated.View>
      </TouchableOpacity>

      {isOpen && (
        <Animated.View
          style={[
            styles.dropdown,
            {
              borderColor,
              backgroundColor: background,
              shadowColor: $('textInverse'),
              marginTop: S.space.xs,
              borderRadius: S.radius.md,
            },
            dropdownAnimStyle,
          ]}
        >
          {enableSearch && (
            <TextInput
              placeholder="Search..."
              value={search}
              onChangeText={setSearch}
              placeholderTextColor={$(`textSecondary`)}
              style={[
                styles.searchInput,
                {
                  borderColor,
                  color: $('textPrimary'),
                  borderRadius: S.radius.sm,
                  paddingHorizontal: S.space.sm,
                  margin: S.space.sm,
                },
              ]}
            />
          )}

          <FlatList
            data={filteredItems}
            keyExtractor={(item) => item.value}
            ItemSeparatorComponent={() => (
              <View
                style={{
                  height: 1,
                  backgroundColor: tone($('accent'), 'hover'),
                  opacity: 0.2,
                }}
              />
            )}
            renderItem={({ item }) => (
              <TouchableOpacity
                activeOpacity={0.8}
                onPress={() => {
                  onChange(item.value)
                  toggleDropdown()
                }}
                style={[
                  styles.item,
                  {
                    borderColor,
                    borderWidth: 1.5,
                    borderRadius: S.radius.md,
                    paddingVertical: S.space.sm,
                    paddingHorizontal: S.space.md,
                  },
                ]}
              >
                <Body color={item.value === value ? $('accent') : $('textPrimary')}>
                  {item.label}
                </Body>
              </TouchableOpacity>
            )}
          />
        </Animated.View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
  },
  dropdown: {
    borderWidth: 1.5,
    overflow: 'hidden',
    boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
    elevation: 3,
  },
  item: {},
  searchInput: {
    borderWidth: 1,
    paddingVertical: Platform.OS === 'ios' ? 8 : 6,
  },
})
