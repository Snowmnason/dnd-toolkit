import { Body, ViewCust } from '@/components/ui'
import { useNavDrawer } from '@/contexts/nav-drawer-context'
import { $, UseTheme, useScale } from '@/theme'
import { useEffect } from 'react'
import { Modal, Platform, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native'
import Animated, {
  FadeInLeft,
  FadeInRight,
  FadeOutLeft,
  FadeOutRight,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated'

const ANIMATION_DURATION = 150

/**
 * 🎯 NavDrawerLayer
 * 
 * Platform-split rendering:
 * 
 * Desktop (web): Inline sidebar in layout flow. Always renders.
 *   - Collapsed: icon-width (~72px scaled), shows icons/abbreviations
 *   - Expanded: full-width (~240px scaled), shows icons + text
 *   - Animated width transitions (150ms, synchronized with main content flex)
 *   - Main content flex-grows/shrinks naturally (no overlay, no backdrop)
 * 
 * Mobile (native): Modal overlay, 60% net viewport width.
 *   - Only renders when drawer.visible
 *   - Dim backdrop, tap-to-close
 *   - FadeIn/Out slide animations
 */

// ─── Desktop Sidebar (Web) ───────────────────────────────────────────

function DesktopSidebar() {
  const { drawer, isExpanded, setExpanded } = useNavDrawer()
  const { theme } = UseTheme()
  const S = useScale()

  const COLLAPSED_WIDTH = S.space.lg * 2.5 // ~72px
  const EXPANDED_WIDTH = S.space.lg * 12   // ~240px

  const drawerBg = $('surface', theme)
  const borderColor = $('borderSubtle', theme)

  // Animated width
  const animatedWidth = useSharedValue(isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH)

  useEffect(() => {
    animatedWidth.value = withTiming(
      isExpanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH,
      { duration: ANIMATION_DURATION }
    )
  }, [isExpanded, EXPANDED_WIDTH, COLLAPSED_WIDTH, animatedWidth])

  const sidebarAnimStyle = useAnimatedStyle(() => ({
    width: animatedWidth.value,
  }))

  return (
    <Animated.View
      style={[
        {
          height: '100%',
          backgroundColor: drawerBg,
          borderRightWidth: 1,
          borderRightColor: borderColor,
          overflow: 'hidden',
        },
        sidebarAnimStyle,
      ]}
    >
      {/* Toggle expand/collapse area — shown at top */}
      <Pressable
        onPress={() => setExpanded(!isExpanded)}
        style={{
          paddingVertical: S.space.md,
          paddingHorizontal: S.space.sm,
          flexDirection: 'row',
          alignItems: 'center',
          gap: S.space.sm,
        }}
      >
        {/* Chevron icon */}
        <View style={{ width: S.space.lg, height: S.space.lg, justifyContent: 'center', alignItems: 'center' }}>
          <View
            style={{
              width: S.space.sm,
              height: S.space.sm,
              borderLeftWidth: 2,
              borderBottomWidth: 2,
              borderColor: $('textSecondary', theme),
              transform: [{ rotate: isExpanded ? '45deg' : '-135deg' }],
            }}
          />
        </View>
        {/* Text shows inline when expanded */}
        {isExpanded && (
          <Body style={{ color: $('textPrimary', theme), flex: 1 }}>NavDraw</Body>
        )}
      </Pressable>

      {/* Drawer content slot */}
      {drawer.content}
    </Animated.View>
  )
}

// ─── Mobile Modal Overlay (Native) ──────────────────────────────────

function MobileDrawerOverlay() {
  const { drawer, hide } = useNavDrawer()
  const { width: screenWidth, height: screenHeight } = useWindowDimensions()
  const { theme } = UseTheme()

  const DRAWER_WIDTH = screenWidth * 0.6 // 60% net viewport width
  const BACKDROP_OPACITY = 0.6

  const backdropBaseColor = $('background', theme)
  const drawerBg = $('surface', theme)

  // Backdrop animation
  const backdropOpacity = useSharedValue(0)

  const backdropAnimStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value * BACKDROP_OPACITY,
  }))

  // Drawer enter/exit
  const drawerEnterAnim =
    drawer.position === 'left'
      ? FadeInLeft.duration(ANIMATION_DURATION)
      : FadeInRight.duration(ANIMATION_DURATION)

  const drawerExitAnim =
    drawer.position === 'left'
      ? FadeOutLeft.duration(ANIMATION_DURATION)
      : FadeOutRight.duration(ANIMATION_DURATION)

  useEffect(() => {
    if (drawer.visible) {
      backdropOpacity.value = withTiming(1, { duration: ANIMATION_DURATION })
    } else {
      backdropOpacity.value = withTiming(0, { duration: ANIMATION_DURATION })
    }
  }, [drawer.visible, backdropOpacity])

  if (!drawer.visible) return null

  const gradientDirection = drawer.position === 'left' ? 90 : 270

  // ─── Web fallback (mobile web) ───
  if (Platform.OS === 'web') {
    return (
      <View
        style={{
          position: 'fixed' as any,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 9999,
          pointerEvents: 'box-none',
        }}
      >
        <Pressable
          onPress={() => hide()}
          style={StyleSheet.absoluteFillObject}
        />

        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            { pointerEvents: 'none' },
            backdropAnimStyle,
          ]}
        >
          <ViewCust
            gradient
            gradientColor={backdropBaseColor}
            gradientColor2="transparent"
            gradientDirection={gradientDirection}
            gradientTransitionPoint={70}
            style={{ flex: 1 }}
          />
        </Animated.View>

        {drawer.visible && (
          <Animated.View
            entering={drawerEnterAnim}
            exiting={drawerExitAnim}
            style={{
              position: 'absolute',
              top: 0,
              [drawer.position]: 0,
              width: DRAWER_WIDTH,
              height: screenHeight,
              backgroundColor: drawerBg,
              zIndex: 10000,
              pointerEvents: 'auto',
            }}
          >
            {drawer.content}
          </Animated.View>
        )}
      </View>
    )
  }

  // ─── Native Modal ───
  return (
    <Modal transparent animationType="fade" visible={drawer.visible}>
      <View style={{ flex: 1 }}>
        <Pressable
          onPress={() => hide()}
          style={StyleSheet.absoluteFillObject}
        />

        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            { pointerEvents: 'none' },
            backdropAnimStyle,
          ]}
        >
          <ViewCust
            gradient
            gradientColor={backdropBaseColor}
            gradientColor2="transparent"
            gradientDirection={gradientDirection}
            gradientTransitionPoint={70}
            style={{ flex: 1 }}
          />
        </Animated.View>

        {drawer.visible && (
          <Animated.View
            entering={drawerEnterAnim}
            exiting={drawerExitAnim}
            style={{
              position: 'absolute',
              top: 0,
              [drawer.position]: 0,
              width: DRAWER_WIDTH,
              height: screenHeight,
              backgroundColor: drawerBg,
            }}
          >
            {drawer.content}
          </Animated.View>
        )}
      </View>
    </Modal>
  )
}

// ─── Exported Component ─────────────────────────────────────────────

/**
 * NavDrawerLayer — renders the appropriate drawer variant per platform.
 * 
 * On web (desktop): Renders DesktopSidebar (inline, always visible, animated width).
 *   Must be placed INSIDE a flexDirection:'row' container beside main content.
 * 
 * On native (mobile): Renders MobileDrawerOverlay (modal, 60% width).
 *   Can be placed anywhere in the tree (Modal renders as portal).
 */
export function NavDrawerLayer() {
  if (Platform.OS === 'web') {
    return <DesktopSidebar />
  }

  return <MobileDrawerOverlay />
}
