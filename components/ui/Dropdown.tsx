import { IconSymbol } from '@/components/built-in/icon-symbol';
import { Body, ObjHeading } from '@/components/ui/AppText';
import { $, S, tone, useThemeTokens } from '@/theme';
import React, { useMemo, useState } from 'react';
import {
  FlatList,
  Platform,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

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
  onCard?: boolean
  style?: any
}

/**
 * 🎛️ Dropdown
 * Modern animated dropdown with optional search + heading support.
 */
export default function Dropdown({
  items,
  value,
  onChange,
  placeholder = 'Select an option',
  enableSearch = false,
  heading,
  onCard = false,
  style,
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [search, setSearch] = useState('')
  const rotate = useSharedValue(0)
  const scale = useSharedValue(0.9)
  const opacity = useSharedValue(0)
  const shadow = useSharedValue(0)

  const { resolve } = useThemeTokens()
  const textColor = resolve({
    color: onCard ? '$textPrimary' : '$textInverse',
  }).color
  const borderColor = $('accent')
  const background = $('surface')

  // Animate chevron rotation
  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotate.value}deg` }],
  }))

  // Animate dropdown container
const dropdownAnimStyle = useAnimatedStyle(() => ({
  opacity: opacity.value,
  transform: [{ scale: scale.value }],
  shadowOpacity: 0.1 + shadow.value * 0.15, // smooth depth
  shadowRadius: 4 + shadow.value * 3,
  elevation: 1 + shadow.value * 4, // Android
}))

  const toggleDropdown = () => {
  const toOpen = !isOpen
  setIsOpen(toOpen)
  rotate.value = withTiming(toOpen ? 180 : 0, { duration: 220 })

  if (toOpen) {
    opacity.value = withTiming(1, { duration: 100 })
    scale.value = withSpring(1, {
      damping: 12,
      stiffness: 120,
      mass: 0.6,
    })
    shadow.value = withTiming(1, { duration: 200 })
  } else {
    opacity.value = withTiming(0, { duration: 150 })
    scale.value = withSpring(0.9, {
      damping: 15,
      stiffness: 120,
      mass: 0.6,
    })
    shadow.value = withTiming(0, { duration: 150 })
  }
}

  const filteredItems = useMemo(() => {
    if (!enableSearch || search.trim() === '') return items
    return items.filter((i) =>
      i.label.toLowerCase().includes(search.trim().toLowerCase())
    )
  }, [items, search, enableSearch])

  const selectedLabel =
    items.find((item) => item.value === value)?.label || placeholder

  return (
    <View style={[{ width: '100%' }, style]}>
      {/* Heading */}
      {heading ? (
        <ObjHeading
          color={textColor}
          style={{ marginBottom: S.space.xs, marginLeft: S.space.xs }}
        >
          {heading}
        </ObjHeading>
      ) : null}

      {/* Dropdown header */}
      <TouchableOpacity
        accessibilityRole="button"
        activeOpacity={0.8}
        onPress={toggleDropdown}
        style={[
          styles.header,
          {
            borderColor,
            backgroundColor: background,
          },
        ]}
      >
        <Body
          color={value ? textColor : $('textSecondary')}
          style={{ flex: 1 }}
        >
          {selectedLabel}
        </Body>
        <Animated.View style={chevronStyle}>
          <IconSymbol
            name="chevron.right"
            size={18}
            weight="medium"
            color={$('textSecondary')}
            style={{ transform: [{ rotate: isOpen ? '90deg' : '0deg' }] }}
          />
        </Animated.View>
      </TouchableOpacity>

      {/* Dropdown content */}
      {isOpen && (
        <Animated.View
          style={[
            styles.dropdown,
            {
              borderColor,
              backgroundColor: background,
              shadowColor: $('textInverse'),
            },
            dropdownAnimStyle,
          ]}
        >
          {enableSearch && (
            <TextInput
              placeholder="Search..."
              value={search}
              onChangeText={setSearch}
              placeholderTextColor={$('textSecondary')}
              style={[
                styles.searchInput,
                {
                  borderColor,
                  color: textColor,
                },
              ]}
            />
          )}

          <FlatList
            data={filteredItems}
            keyExtractor={(item) => item.value}
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
                  },
                ]}
              >
                <Body
                  color={
                    item.value === value ? $('accent') : $('textPrimary')
                  }
                >
                  {item.label}
                </Body>
              </TouchableOpacity>
            )}
            ItemSeparatorComponent={() => (
              <View
                style={{
                  height: 1,
                  backgroundColor: tone($('accent'), 'hover'),
                  opacity: 0.2,
                }}
              />
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
    borderRadius: S.radius.md,
    paddingVertical: S.space.sm,
    paddingHorizontal: S.space.md,
  },
  dropdown: {
    marginTop: S.space.xs,
    borderWidth: 1.5,
    borderRadius: S.radius.md,
    overflow: 'hidden',
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 6,
    elevation: 3,
  },
  item: {
    paddingVertical: S.space.sm,
    paddingHorizontal: S.space.md,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: S.radius.sm,
    paddingVertical: Platform.OS === 'ios' ? 8 : 6,
    paddingHorizontal: S.space.sm,
    margin: S.space.sm,
  },
})
