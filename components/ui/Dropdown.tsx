import { IconSymbol } from '@/components/built-in/icon-symbol'
import { Body, ObjHeading, TextType } from '@/components/ui/AppText'
import { $, tone, useScale, UseTheme } from '@/theme'
import React, { useMemo, useRef, useState } from 'react'
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
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
import { scheduleOnRN } from 'react-native-worklets'

interface DropdownItem {
  label: string
  value: string
}

interface DropdownItemProps {
  item: DropdownItem
  isSelected: boolean
  onPress: () => void
  borderColor: string
  accentColor: string
  textPrimaryColor: string
  S: ReturnType<typeof useScale>
  theme: any
}

function DropdownItemComponent({
  item,
  isSelected,
  onPress,
  borderColor,
  accentColor,
  textPrimaryColor,
  S,
  theme,
}: DropdownItemProps) {
  const [isHovered, setIsHovered] = useState(false)

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      onPressIn={() => setIsHovered(true)}
      onPressOut={() => setIsHovered(false)}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={[
        {
          borderColor,
          borderWidth: 1.5,
          borderRadius: S.radius.md,
          paddingVertical: S.space.sm,
          paddingHorizontal: S.space.md,
          backgroundColor: isHovered
            ? tone($('bgInverse', theme), 'hover', undefined, undefined, theme)
            : isSelected
            ? tone(accentColor, 'subtle', undefined, undefined, theme)
            : 'transparent',
          transform: isHovered ? [{ scale: 1.02 }] : [{ scale: 1 }],
        },
      ]}
    >
      <Body color={isSelected ? accentColor : textPrimaryColor}>
        {item.label}
      </Body>
    </TouchableOpacity>
  )
}

interface DropdownProps {
  items: DropdownItem[]
  value: string | null
  onChange: (value: string | null) => void
  placeholder?: string
  enableSearch?: boolean
  heading?: string
  textTypeHeading?: TextType
  textType?: TextType
  style?: any
  /**
   * Additive adjustment applied to the dropdown's max height.
   * Positive values increase, negative values decrease.
   * Example: -10 shrinks by 10, 20 grows by 20.
   */
  maxHeightDelta?: number
}

export default function Dropdown({
  items,
  value,
  onChange,
  placeholder = 'Select an option',
  enableSearch = false,
  heading,
  textTypeHeading = 'primary',
  textType = 'inverse',
  style,
  maxHeightDelta = 0,
}: DropdownProps) {
  const S = useScale()
  const { theme } = UseTheme()
  const [isOpen, setIsOpen] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const [search, setSearch] = useState('')
  const rotate = useSharedValue(0)
  const scale = useSharedValue(0.9)
  const opacity = useSharedValue(0)
  const shadow = useSharedValue(0)

  const borderColor = $('accent', theme)
  const background = $('bgInverse', theme)
  // Pre-compute theme colors before any animated styles that reference them
  const textPrimaryColor = $('textInverse', theme)
  const shadowColor = $('shadow', theme)
  const accentColor = $('accentDark', theme)
  const separatorColor = tone($('accent', theme), 'hover', undefined, undefined, theme)

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotate.value}deg` }],
  }))

  const dropdownAnimStyle = useAnimatedStyle(() => {
    const style: any = {
      opacity: opacity.value,
      transform: [{ scale: scale.value }],
    }
    if (Platform.OS === 'web') {
      // Use our unified "combined" shadow on web
      // Two-layer shadow similar to ElevatedView 'combined'
      style.boxShadow = `0px 4px 4px ${shadowColor}, 0px 12px 12px ${shadowColor}`
    } else {
      // Native platforms: keep elevation (shadow* props are fine on native)
      style.elevation = 1 + shadow.value * 4
    }
    return style
  })

  const openDropdown = () => {
    setIsMounted(true)
    setIsOpen(true)
    rotate.value = withTiming(180, { duration: 220 })
    opacity.value = withTiming(1, { duration: 120 })
    scale.value = withSpring(1, { damping: 10, stiffness: 250, mass: 0.5 })
    shadow.value = withTiming(1, { duration: 200 })
  }

  const closeDropdown = () => {
    setIsOpen(false)
    // Use spring for a nicer reverse on the chevron as well
    rotate.value = withSpring(0, { damping: 12, stiffness: 140, mass: 0.6 })
    // Reverse animations and unmount after fade completes
    opacity.value = withTiming(0, { duration: 150 }, (finished) => {
      if (finished) {
        scheduleOnRN(() => {
          setIsMounted(false)
          setSearch('')
        })
      }
    })
    scale.value = withSpring(0.9, { damping: 15, stiffness: 120, mass: 0.6 })
    shadow.value = withTiming(0, { duration: 150 })
  }

  // Note: toggleDropdown was replaced by explicit open/close calls

  const filteredItems = useMemo(() => {
    if (!enableSearch || search.trim() === '') return items
    return items.filter((i) => i.label.toLowerCase().includes(search.trim().toLowerCase()))
  }, [items, search, enableSearch])

  const selectedLabel = items.find((item) => item.value === value)?.label || placeholder
  const SAFE_AREA = 24
  const headerRef = useRef<View>(null)
  const [anchor, setAnchor] = useState<{ x: number; y: number; width: number; height: number } | null>(null)
  const [searchHeight, setSearchHeight] = useState(0)

  // We open with index 0 aligned to the button (no translation needed)

  // Base max height plus optional additive delta
  const baseMaxHeight = S.space.xxl * 10
  const computedMaxHeight = Math.max(100, baseMaxHeight + (maxHeightDelta))

  return (
  <View style={[{ width: '100%', position: 'relative' }, style]}>
      {heading ? (
        <ObjHeading textType={textTypeHeading} style={{ marginBottom: S.space.xs, marginLeft: S.space.xs }}>
          {heading}
        </ObjHeading>
      ) : null}

      <TouchableOpacity
        ref={headerRef}
        accessibilityRole="button"
        activeOpacity={0.8}
        onPress={() => {
          const toOpen = !isOpen
          if (toOpen) {
            openDropdown()
            // Measure on next frame so layout is settled
            requestAnimationFrame(() => {
              headerRef.current?.measureInWindow?.((x, y, width, height) => {
                setAnchor({ x, y, width, height })
              })
            })
          } else {
            closeDropdown()
          }
        }}
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
        <Body textType={value ? textType : 'inverse'} style={{ flex: 1 }}>
          {selectedLabel}
        </Body>
        <Animated.View style={chevronStyle}>
          <IconSymbol
            name="chevron.right"
            size={18}
            weight="medium"
            color={$(`textInverse`, theme)}
            style={{ transform: [{ rotate: isOpen ? '90deg' : '0deg' }] }}
          />
        </Animated.View>
      </TouchableOpacity>

      {isMounted && anchor && (
        <Modal transparent animationType="fade">
          <View style={{ flex: 1 }}>
            {/* Full-screen backdrop closes dropdown when pressed anywhere */}
            <Pressable style={StyleSheet.absoluteFillObject} onPress={closeDropdown} />

            {/* Positioned container with safety padding so clicks near dropdown won't close */}
            <View
              // On native, use pointerEvents prop; on web, omit and rely on layout
              {...(Platform.OS !== 'web' ? { pointerEvents: 'box-none' as any } : {})}
              style={{
                position: 'absolute',
                top: Math.max(anchor.y - SAFE_AREA, 0),
                left: Math.max(anchor.x - SAFE_AREA, 0),
                width: anchor.width + SAFE_AREA * 2,
                padding: SAFE_AREA,
              }}
            >
              <Animated.View
                style={[
                  styles.dropdown,
                  {
                    borderColor,
                    backgroundColor: background,
                    // Web shadow handled in dropdownAnimStyle; fallback here for non-animated cases
                    ...(Platform.OS === 'web' ? { boxShadow: `0px 4px 4px ${shadowColor}, 0px 12px 12px ${shadowColor}` } : {}),
                    borderRadius: S.radius.md,
                    maxHeight: computedMaxHeight,
                    transformOrigin: 'top center',
                  },
                  dropdownAnimStyle,
                ]}
              >
          {enableSearch && (
            <View
              onLayout={(e) => setSearchHeight(e.nativeEvent.layout.height)}
              style={{ 
                position: 'absolute', 
                top: 0, 
                left: 0, 
                right: 0, 
                paddingHorizontal: S.space.md,
                paddingVertical: S.space.sm,
                zIndex: 15,
                backgroundColor: background,
              }}
            >
              <TextInput
                placeholder="Search..."
                value={search}
                onChangeText={setSearch}
                placeholderTextColor={$(`textInverse`, theme)}
                style={[
                  styles.searchInput,
                  {
                    borderColor,
                    color: $('textPrimary', theme),
                    //borderRadius: S.radius.sm,
                    paddingHorizontal: S.space.md,
                  },
                ]}
              />
            </View>
          )}

          <FlatList
            data={filteredItems}
            keyExtractor={(item) => item.value}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={enableSearch ? { paddingTop: searchHeight } : undefined}
            ItemSeparatorComponent={() => (
              <View
                style={{
                  height: 1,
                  backgroundColor: separatorColor,
                  opacity: 0.2,
                }}
              />
            )}
            renderItem={({ item }) => (
              <DropdownItemComponent
                item={item}
                isSelected={item.value === value}
                onPress={() => {
                  onChange(item.value)
                  closeDropdown()
                }}
                borderColor={borderColor}
                accentColor={accentColor}
                textPrimaryColor={textPrimaryColor}
                S={S}
                theme={theme}
              />
            )}
          />
              </Animated.View>
            </View>
          </View>
        </Modal>
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
