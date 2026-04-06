import { useScale } from '@/theme'
import React from 'react'
import { ScrollView, View, ViewStyle } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

// =============================================================================
// AppNavDrawer — Pure visual inner layout for drawer content
// =============================================================================

interface AppNavDrawerProps {
  /** Drawer items */
  children: React.ReactNode
  /** Scroll content when it overflows */
  scrollable?: boolean
  /** Additional style merged onto the container */
  style?: ViewStyle
}

/**
 * Inner layout wrapper rendered inside NavDrawerLayer's content slot.
 *
 * Provides:
 * - Safe-area-aware top/bottom padding
 * - Consistent horizontal padding + vertical gap between items
 * - Optional ScrollView for overflow
 *
 * Does NOT own: width, height, background, positioning, or animations
 * (NavDrawerLayer handles all of that).
 */
export function AppNavDrawer({
  children,
  scrollable = true,
  style,
}: AppNavDrawerProps) {
  const S = useScale()
  const insets = useSafeAreaInsets()

  const containerStyle: ViewStyle = {
    flex: 1,
    paddingTop: insets.top + S.space.sm,
    paddingBottom: insets.bottom + S.space.sm,
    paddingHorizontal: S.space.md,
    gap: S.space.sm,
    ...style,
  }

  if (scrollable) {
    return (
      <ScrollView
        contentContainerStyle={containerStyle}
        showsVerticalScrollIndicator={false}
      >
        {children}
      </ScrollView>
    )
  }

  return <View style={containerStyle}>{children}</View>
}
