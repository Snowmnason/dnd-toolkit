import { ViewCust } from '@/components/ui'
import { useNavDrawer, type DrawerPosition } from '@/contexts/nav-drawer-context'
import { $, UseTheme, useScale } from '@/theme'
import React, { useEffect } from 'react'
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
const BACKDROP_OPACITY = 0.5

// ─── Types ──────────────────────────────────────────────────────────

export type NavDrawerMode = 'permanent-sidebar' | 'expandable' | 'modal'

export interface NavDrawerLayerProps {
  /** Desktop: all 3 modes. Mobile: 'modal' | 'permanent-sidebar'. */
  mode: NavDrawerMode
  /** Position for mobile modal (left or right). Desktop modal is always right. Defaults to 'left'. */
  position?: DrawerPosition
  /** Content for collapsed/permanent state (icons only). Used by permanent-sidebar + expandable collapsed. */
  childrenClosed?: React.ReactNode
  /** Content for expanded/modal state (full content). Used by expandable expanded + modal. */
  childrenOpen?: React.ReactNode
  /** Custom toggle render for expandable mode. If omitted, a default chevron toggle is rendered. */
  renderToggle?: (isExpanded: boolean, onToggle: () => void) => React.ReactNode
}

// ─── Shared: Permanent Sidebar ──────────────────────────────────────

/**
 * Fixed-width sidebar, always visible. Renders childrenClosed (icon-only content).
 * Shared between desktop and mobile permanent-sidebar modes.
 */
function PermanentSidebar({ children }: { children?: React.ReactNode }) {
  const { theme } = UseTheme()
  const S = useScale()

  const SIDEBAR_WIDTH = S.space.lg * 2.5 // ~72px

  return (
    <View
      style={{
        width: SIDEBAR_WIDTH,
        height: '100%',
        backgroundColor: $('surface', theme),
        borderRightWidth: 1,
        borderRightColor: $('borderSubtle', theme),
        overflow: 'hidden',
        paddingVertical: S.space.md,
        paddingHorizontal: S.space.sm,
        gap: S.space.sm,
      }}
    >
      {children}
    </View>
  )
}

// ─── Desktop: Expandable Sidebar ────────────────────────────────────

/**
 * Animated sidebar that toggles between collapsed (childrenClosed) and expanded (childrenOpen).
 * Width animates between COLLAPSED_WIDTH (~72px) and EXPANDED_WIDTH (~240px).
 * Includes a default chevron toggle that can be overridden via renderToggle.
 */
function DesktopExpandableSidebar({
  childrenClosed,
  childrenOpen,
  renderToggle,
}: {
  childrenClosed?: React.ReactNode
  childrenOpen?: React.ReactNode
  renderToggle?: (isExpanded: boolean, onToggle: () => void) => React.ReactNode
}) {
  const { isExpanded, setExpanded } = useNavDrawer()
  const { theme } = UseTheme()
  const S = useScale()

  const COLLAPSED_WIDTH = S.space.lg * 2.5 // ~72px
  const EXPANDED_WIDTH = S.space.lg * 12   // ~240px

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

  const handleToggle = () => setExpanded(!isExpanded)

  return (
    <Animated.View
      style={[
        {
          height: '100%',
          backgroundColor: $('surface', theme),
          borderRightWidth: 1,
          borderRightColor: $('borderSubtle', theme),
          overflow: 'hidden',
          paddingVertical: S.space.md,
          paddingHorizontal: S.space.sm,
          gap: S.space.sm,
        },
        sidebarAnimStyle,
      ]}
    >
      {/* Toggle action — default chevron or custom renderToggle */}
      {renderToggle
        ? renderToggle(isExpanded, handleToggle)
        : <DefaultToggle isExpanded={isExpanded} onToggle={handleToggle} />
      }

      {/* Content slot: collapsed icons or expanded full content */}
      {isExpanded ? childrenOpen : childrenClosed}
    </Animated.View>
  )
}

// ─── Default Toggle (Chevron) ───────────────────────────────────────

function DefaultToggle({ isExpanded, onToggle }: { isExpanded: boolean; onToggle: () => void }) {
  const { theme } = UseTheme()
  const S = useScale()

  return (
    <Pressable
      onPress={onToggle}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: S.space.sm,
      }}
    >
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
    </Pressable>
  )
}

// ─── Desktop: Modal Overlay ─────────────────────────────────────────

/**
 * Right-positioned overlay with dimmed backdrop. Renders childrenOpen.
 * Triggered via show()/hide() from NavDrawer context (e.g. top bar button).
 * Uses position:fixed so it doesn't affect flex layout.
 */
function DesktopModalOverlay({ children }: { children?: React.ReactNode }) {
  const { drawer, hide } = useNavDrawer()
  const { height: screenHeight } = useWindowDimensions()
  const { theme } = UseTheme()
  const S = useScale()

  const MODAL_WIDTH = S.space.lg * 12 // ~240px (EXPANDED_WIDTH)

  const backdropOpacity = useSharedValue(0)
  const backdropAnimStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value * BACKDROP_OPACITY,
  }))

  useEffect(() => {
    backdropOpacity.value = withTiming(drawer.visible ? 1 : 0, { duration: ANIMATION_DURATION })
  }, [drawer.visible, backdropOpacity])

  if (!drawer.visible) return null

  return (
    <View
      style={{
        position: 'fixed' as any,
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 9999,
      }}
    >
      {/* Tap outside to close */}
      <Pressable onPress={hide} style={StyleSheet.absoluteFillObject} />

      {/* Dimmed backdrop with gradient */}
      <Animated.View
        style={[
          StyleSheet.absoluteFillObject,
          { pointerEvents: 'none' },
          backdropAnimStyle,
        ]}
      >
        <ViewCust
          gradient
          gradientColor={$('background', theme)}
          gradientColor2="transparent"
          gradientDirection={270}
          gradientTransitionPoint={70}
          style={{ flex: 1 }}
        />
      </Animated.View>

      {/* Drawer panel — always right-positioned on desktop */}
      <Animated.View
        entering={FadeInRight.duration(ANIMATION_DURATION)}
        exiting={FadeOutRight.duration(ANIMATION_DURATION)}
        style={{
          position: 'absolute',
          top: 0,
          right: 0,
          width: MODAL_WIDTH,
          height: screenHeight,
          backgroundColor: $('surface', theme),
          borderLeftWidth: 1,
          borderLeftColor: $('borderSubtle', theme),
          zIndex: 10000,
          pointerEvents: 'auto',
          paddingVertical: S.space.md,
          paddingHorizontal: S.space.sm,
          gap: S.space.sm,
        }}
      >
        {children}
      </Animated.View>
    </View>
  )
}

// ─── Mobile: Modal Overlay ──────────────────────────────────────────

/**
 * Position-aware modal overlay for native platforms.
 * 60% viewport width, slides in from left or right based on position prop.
 * Only renders when drawer.visible AND drawer.position matches this instance's position.
 * Supports two independent drawers (left + right) via separate NavDrawerLayer instances.
 */
function MobileModalOverlay({
  children,
  position = 'left',
}: {
  children?: React.ReactNode
  position?: DrawerPosition
}) {
  const { drawer, hide } = useNavDrawer()
  const { width: screenWidth, height: screenHeight } = useWindowDimensions()
  const { theme } = UseTheme()
  const S = useScale()

  const DRAWER_WIDTH = screenWidth * 0.6
  const isVisible = drawer.visible && drawer.position === position

  const backdropOpacity = useSharedValue(0)
  const backdropAnimStyle = useAnimatedStyle(() => ({
    opacity: backdropOpacity.value * BACKDROP_OPACITY,
  }))

  const enterAnim = position === 'left'
    ? FadeInLeft.duration(ANIMATION_DURATION)
    : FadeInRight.duration(ANIMATION_DURATION)

  const exitAnim = position === 'left'
    ? FadeOutLeft.duration(ANIMATION_DURATION)
    : FadeOutRight.duration(ANIMATION_DURATION)

  useEffect(() => {
    backdropOpacity.value = withTiming(isVisible ? 1 : 0, { duration: ANIMATION_DURATION })
  }, [isVisible, backdropOpacity])

  if (!isVisible) return null

  const gradientDirection = position === 'left' ? 90 : 270

  return (
    <Modal transparent animationType="fade" visible>
      <View style={{ flex: 1 }}>
        {/* Tap outside to close */}
        <Pressable onPress={hide} style={StyleSheet.absoluteFillObject} />

        {/* Dimmed backdrop with gradient */}
        <Animated.View
          style={[
            StyleSheet.absoluteFillObject,
            { pointerEvents: 'none' },
            backdropAnimStyle,
          ]}
        >
          <ViewCust
            gradient
            gradientColor={$('background', theme)}
            gradientColor2="transparent"
            gradientDirection={gradientDirection}
            gradientTransitionPoint={70}
            style={{ flex: 1 }}
          />
        </Animated.View>

        {/* Drawer panel — position-aware */}
        <Animated.View
          entering={enterAnim}
          exiting={exitAnim}
          style={{
            position: 'absolute',
            top: 0,
            [position]: 0,
            width: DRAWER_WIDTH,
            height: screenHeight,
            backgroundColor: $('surface', theme),
            paddingVertical: S.space.md,
            paddingHorizontal: S.space.sm,
            gap: S.space.sm,
          }}
        >
          {children}
        </Animated.View>
      </View>
    </Modal>
  )
}

// ─── Exported Component ─────────────────────────────────────────────

/**
 * NavDrawerLayer — Skeletal navigation drawer system.
 *
 * Handles platform-specific rendering, animations, sizing, and backdrop behavior.
 * Content is provided via children props; mode determines rendering strategy.
 *
 * Desktop (Web/Electron):
 *   - permanent-sidebar: Fixed-width icon sidebar, always visible (childrenClosed)
 *   - expandable: Animated collapse/expand with toggle (childrenClosed ↔ childrenOpen)
 *   - modal: Right-positioned overlay with dimmed backdrop (childrenOpen)
 *
 * Mobile (iOS/Android):
 *   - modal: Position-aware overlay, 60% viewport, dimmed backdrop (childrenOpen)
 *   - permanent-sidebar: Fixed-width icon sidebar (childrenClosed)
 */
export function NavDrawerLayer({
  mode,
  position = 'left',
  childrenClosed,
  childrenOpen,
  renderToggle,
}: NavDrawerLayerProps) {
  if (Platform.OS === 'web') {
    switch (mode) {
      case 'permanent-sidebar':
        return <PermanentSidebar>{childrenClosed}</PermanentSidebar>
      case 'expandable':
        return (
          <DesktopExpandableSidebar
            childrenClosed={childrenClosed}
            childrenOpen={childrenOpen}
            renderToggle={renderToggle}
          />
        )
      case 'modal':
        return <DesktopModalOverlay>{childrenOpen}</DesktopModalOverlay>
    }
  }

  // Mobile (native)
  switch (mode) {
    case 'modal':
      return <MobileModalOverlay position={position}>{childrenOpen}</MobileModalOverlay>
    case 'permanent-sidebar':
      return <PermanentSidebar>{childrenClosed}</PermanentSidebar>
    default:
      return null
  }
}
