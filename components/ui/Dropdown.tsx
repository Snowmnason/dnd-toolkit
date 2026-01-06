import { IconSymbol } from '@/components/built-in/icon-symbol'
import { Body, ObjHeading, TextType } from '@/components/ui/AppText'
import { $, tone, useScale, UseTheme } from '@/theme'
import { useMemo, useRef, useState } from 'react'
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
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

interface DropdownItem {
  label: string
  value: string
}

interface DropdownItemComponentProps {
  item: DropdownItem
  isSelected: boolean
  onPress: () => void
  borderColor: string
  S: ReturnType<typeof useScale>
  theme: ReturnType<typeof UseTheme>['theme']
}

function DropdownItemComponent({
  item,
  isSelected,
  onPress,
  borderColor,
  S,
  theme,
}: DropdownItemComponentProps) {
    // All hooks at the top before any other logic
  const hoverScale = useSharedValue(1)
  const hoverOpacity = useSharedValue(0)
  
    // Get colors using explicit theme to avoid hook calls in conditionally rendered component
  const selectedBg = $('background', theme)
  const hoverBg = $('accent', theme)
  const selectedTextColor = $('textPrimary', theme)
  const defaultTextColor = $('textInverse', theme)

    // Then animated styles (these also use hooks)
    const hoverStyle = useAnimatedStyle(() => ({
      transform: [{ scale: hoverScale.value }],
    }))

  // Background color animation based on hover state
  const hoverColorStyle = useAnimatedStyle(() => {
    // On hover (hoverOpacity > 0.5), use hoverBg
    // On selected, use selectedBg  
    // Otherwise transparent
    if (isSelected) {
      return { backgroundColor: selectedBg }
    }
    if (hoverOpacity.value > 0.5) {
      return { backgroundColor: hoverBg }
    }
    return { backgroundColor: 'transparent' }
  })

    // Event handlers (not hooks, can be anywhere)
    const handlePressIn = () => {
      hoverScale.value = withTiming(1.02, { duration: 80 })
      hoverOpacity.value = withTiming(1, { duration: 80 })
    }

    const handlePressOut = () => {
      hoverScale.value = withTiming(1, { duration: 80 })
      hoverOpacity.value = withTiming(0, { duration: 80 })
    }

  return (
    <Animated.View 
      style={[hoverStyle, hoverColorStyle]} 
      key={item.value}
    >
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onMouseEnter={handlePressIn}
        onMouseLeave={handlePressOut}
        style={[
          {
            borderColor,
            borderWidth: 1.5,
            borderRadius: S.radius.md,
            paddingVertical: S.space.xs,
            paddingHorizontal: S.space.sm,
          },
        ]}
      >
        <Body color={isSelected ? selectedTextColor : defaultTextColor}>
          {item.label}
        </Body>
      </TouchableOpacity>
    </Animated.View>
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

  const borderColor = $('accent')  // Direct style usage - use CSS vars
  const background = $('bgInverse')  // Direct style usage - use CSS vars
  const shadowColor = $('shadow')  // Direct style usage - use CSS vars
  const textInverseColor = $('textInverse')
  // For tone(), we need resolved hex values because tone() processes colors with a library
  const accentThemed = $('accent', theme)
  const separatorColor = useMemo(() => tone(accentThemed, 'hover', undefined, undefined, theme), [accentThemed, theme])

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

  const handleUnmount = () => {
    setIsMounted(false)
    setSearch('')
  }

  const closeDropdown = () => {
    setIsOpen(false)
    // Use spring for a nicer reverse on the chevron as well
    rotate.value = withSpring(0, { damping: 12, stiffness: 140, mass: 0.6 })
    // Reverse animations and unmount after fade completes
    opacity.value = withTiming(0, { duration: 150 }, (finished) => {
      if (finished) {
        // Use runOnJS to safely update React state from the animation thread
        runOnJS(handleUnmount)()
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
            color={textInverseColor}
            style={{ transform: [{ rotate: isOpen ? '90deg' : '0deg' }] }}
          />
        </Animated.View>
      </TouchableOpacity>

      {isMounted && anchor && (
        <Modal transparent animationType="fade">
          <View style={{ flex: 1 }}>
            {/* Full-screen backdrop closes dropdown when pressed anywhere */}
            <Pressable 
              style={StyleSheet.absoluteFillObject} 
              onPress={closeDropdown}
            />

            {/* Positioned container with safety padding so clicks near dropdown won't close */}
            <View
              style={{
                position: 'absolute',
                top: Math.max(anchor.y - SAFE_AREA, 0),
                left: Math.max(anchor.x - SAFE_AREA, 0),
                width: anchor.width + SAFE_AREA * 2,
                padding: SAFE_AREA,
                pointerEvents: 'box-none',
              }}
            >
              <Animated.View
                style={[
                  styles.dropdown,
                  {
                    borderColor,
                    backgroundColor: background,
                    boxShadow: `0px 4px 4px ${shadowColor}, 0px 12px 12px ${shadowColor}`,
                    borderRadius: S.radius.md,
                    maxHeight: computedMaxHeight,
                    transformOrigin: 'top center',
                    pointerEvents: 'auto',
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
                paddingHorizontal: S.space.xs,
                paddingVertical: S.space.xs,
                zIndex: 15,
                backgroundColor: background,
              }}
            >
              <TextInput
                placeholder="Search..."
                value={search}
                onChangeText={setSearch}
                placeholderTextColor={textInverseColor}
                style={[
                  styles.searchInput,
                  {
                    borderColor,
                    color: textInverseColor,
                    paddingHorizontal: S.space.md,
                    paddingVertical: S.space.xs,
                    fontSize: S.font.body1,
                    fontFamily: Platform.OS === 'web' ? (theme?.fontFamily || 'system-ui, -apple-system, sans-serif') : undefined,
                  },
                ]}
              />
            </View>
          )}

          <FlatList
            data={filteredItems}
            keyExtractor={(item) => item.value}
            scrollEnabled={true}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={enableSearch ? { paddingTop: searchHeight } : {  }}
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
    flex: 1,
  },
  item: {},
  searchInput: {
    borderWidth: 1,
    paddingVertical: Platform.OS === 'ios' ? 8 : 6,
  },
})
