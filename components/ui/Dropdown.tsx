import { IconSymbol } from '@/components/built-in/icon-symbol'
import { Body, ObjHeading, TextType } from '@/components/ui/AppText'
import { useDropdownPortal } from '@/contexts/dropdown-portal-context'
import { $, tone, useScale, UseTheme } from '@/theme'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native'
import Animated, {
  SharedValue,
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
      <Pressable
        onPress={onPress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
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
      </Pressable>
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

const SAFE_AREA = 24

interface DropdownContentProps {
  items: DropdownItem[]
  value: string | null
  onChange: (value: string | null) => void
  enableSearch: boolean
  borderColor: string
  background: string
  shadowColor: string
  textInverseColor: string
  S: ReturnType<typeof useScale>
  theme: ReturnType<typeof UseTheme>['theme']
  separatorColor: string
  computedMaxHeight: number
  opacity: SharedValue<number>
  scaleVal: SharedValue<number>
  shadow: SharedValue<number>
  positionStyle: any
  onClose: () => void
  dropdownId: string
}

/**
 * Internal component rendered inside the DropdownPortal outlet.
 * Owns search state, filtered items, animated styles, and click-outside detection.
 * This keeps search responsive (state lives in the portal render tree) and
 * prevents stale-closure issues for user input.
 */
function DropdownContent({
  items,
  value,
  onChange,
  enableSearch,
  borderColor,
  background,
  shadowColor,
  textInverseColor,
  S,
  theme,
  separatorColor,
  computedMaxHeight,
  opacity,
  scaleVal,
  shadow,
  positionStyle,
  onClose,
  dropdownId,
}: DropdownContentProps) {
  const [search, setSearch] = useState('')
  const [searchHeight, setSearchHeight] = useState(0)

  const filteredItems = useMemo(() => {
    if (!enableSearch || search.trim() === '') return items
    return items.filter((i) => i.label.toLowerCase().includes(search.trim().toLowerCase()))
  }, [items, search, enableSearch])

  const dropdownAnimStyle = useAnimatedStyle(() => {
    const s: any = {
      opacity: opacity.value,
      transform: [{ scale: scaleVal.value }],
    }
    if (Platform.OS === 'web') {
      s.boxShadow = `0px 4px 4px ${shadowColor}, 0px 12px 12px ${shadowColor}`
    } else {
      s.elevation = 1 + shadow.value * 4
    }
    return s
  })

  // Web: close on click outside dropdown content or trigger
  useEffect(() => {
    if (Platform.OS !== 'web') return

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as Node
      const content = document.getElementById(`dropdown-content-${dropdownId}`)
      const trigger = document.getElementById(`dropdown-trigger-${dropdownId}`)
      if (content?.contains(target)) return
      if (trigger?.contains(target)) return
      onClose()
    }

    // Delay one tick so the opening click doesn't immediately close
    const timer = setTimeout(() => {
      document.addEventListener('pointerdown', handlePointerDown)
    }, 0)

    return () => {
      clearTimeout(timer)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [onClose, dropdownId])

  return (
    <>
      {/* Native-only backdrop — closes on tap (same UX as the previous Modal) */}
      {Platform.OS !== 'web' && (
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
      )}

      {/* Positioned container — tracks trigger position via shared values */}
      <Animated.View style={positionStyle} pointerEvents="box-none">
        <Animated.View
          nativeID={`dropdown-content-${dropdownId}`}
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
            contentContainerStyle={enableSearch ? { paddingTop: searchHeight } : {}}
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
                  onClose()
                }}
                borderColor={borderColor}
                S={S}
                theme={theme}
              />
            )}
          />
        </Animated.View>
      </Animated.View>
    </>
  )
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
  const portal = useDropdownPortal()
  const dropdownId = useRef(`dropdown-${Math.random().toString(36).slice(2)}`).current

  const [isOpen, setIsOpen] = useState(false)
  const [isMounted, setIsMounted] = useState(false)
  const rotate = useSharedValue(0)
  const scale = useSharedValue(0.9)
  const opacity = useSharedValue(0)
  const shadow = useSharedValue(0)

  // Position tracking — updated every frame by RAF loop while open
  const anchorX = useSharedValue(0)
  const anchorY = useSharedValue(0)
  const anchorW = useSharedValue(0)
  const anchorH = useSharedValue(0)

  const borderColor = $('accent')
  const background = $('bgInverse')
  const shadowColor = $('shadow')
  const textInverseColor = $('textInverse')
  const accentThemed = $('accent', theme)
  const separatorColor = useMemo(() => tone(accentThemed, 'hover', undefined, undefined, theme), [accentThemed, theme])

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotate.value}deg` }],
  }))

  // Animated position style — follows trigger via shared values so the
  // dropdown moves with page scroll without React re-renders.
  const positionStyle = useAnimatedStyle(() => ({
    position: 'absolute' as const,
    top: Math.max(anchorY.value - SAFE_AREA, 0),
    left: Math.max(anchorX.value - SAFE_AREA, 0),
    width: anchorW.value + SAFE_AREA * 2,
    padding: SAFE_AREA,
  }))

  const headerRef = useRef<View>(null)
  const isClosingRef = useRef(false)
  const baseMaxHeight = S.space.xxl * 10
  const computedMaxHeight = Math.max(100, baseMaxHeight + maxHeightDelta)

  const openDropdown = () => {
    isClosingRef.current = false
    setIsMounted(true)
    setIsOpen(true)
    rotate.value = withTiming(180, { duration: 220 })
    opacity.value = withTiming(1, { duration: 120 })
    scale.value = withSpring(1, { damping: 10, stiffness: 250, mass: 0.5 })
    shadow.value = withTiming(1, { duration: 200 })
  }

  const handleUnmount = () => {
    setIsMounted(false)
  }

  const closeDropdown = () => {
    if (isClosingRef.current) return
    isClosingRef.current = true
    setIsOpen(false)
    rotate.value = withSpring(0, { damping: 12, stiffness: 140, mass: 0.6 })
    opacity.value = withTiming(0, { duration: 150 }, (finished) => {
      if (finished) {
        setTimeout(handleUnmount, 0)
      }
    })
    scale.value = withSpring(0.9, { damping: 15, stiffness: 120, mass: 0.6 })
    shadow.value = withTiming(0, { duration: 150 })
  }

  const selectedLabel = items.find((item) => item.value === value)?.label || placeholder

  // ── RAF position tracking ──────────────────────────────────────────────
  // Continuously re-measures the trigger so the portal content follows
  // scroll position. Shared-value updates bypass React re-renders.
  useEffect(() => {
    if (!isOpen) return
    let raf: number
    const track = () => {
      headerRef.current?.measureInWindow?.((x, y, w, h) => {
        anchorX.value = x
        anchorY.value = y
        anchorW.value = w
        anchorH.value = h
      })
      raf = requestAnimationFrame(track)
    }
    track()
    return () => cancelAnimationFrame(raf)
    // Shared values are stable refs — intentionally omitted
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen])

  // ── Portal registration ────────────────────────────────────────────────
  useEffect(() => {
    if (isMounted) {
      portal.openDropdown({
        id: dropdownId,
        render: () => (
          <DropdownContent
            items={items}
            value={value}
            onChange={onChange}
            enableSearch={enableSearch}
            borderColor={borderColor}
            background={background}
            shadowColor={shadowColor}
            textInverseColor={textInverseColor}
            S={S}
            theme={theme}
            separatorColor={separatorColor}
            computedMaxHeight={computedMaxHeight}
            opacity={opacity}
            scaleVal={scale}
            shadow={shadow}
            positionStyle={positionStyle}
            onClose={closeDropdown}
            dropdownId={dropdownId}
          />
        ),
        onClose: closeDropdown,
      })
    } else {
      portal.closeDropdown(dropdownId)
    }
    // Only re-register when data-affecting deps change; others are stable refs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMounted, items, value, enableSearch])

  // Cleanup on component unmount (e.g. navigation)
  useEffect(() => {
    return () => portal.closeDropdown(dropdownId)
    // Stable refs — only runs on unmount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <View style={[{ width: '100%', position: 'relative' }, style]}>
      {heading ? (
        <ObjHeading textType={textTypeHeading} style={{ marginBottom: S.space.xs, marginLeft: S.space.xs }}>
          {heading}
        </ObjHeading>
      ) : null}

      <Pressable
        ref={headerRef}
        nativeID={`dropdown-trigger-${dropdownId}`}
        accessibilityRole="button"
        onPress={() => {
          if (!isOpen) {
            openDropdown()
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
      </Pressable>
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
  searchInput: {
    borderWidth: 1,
    paddingVertical: Platform.OS === 'ios' ? 8 : 6,
  },
})
