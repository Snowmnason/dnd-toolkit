import { useNavDrawer } from '@/contexts/nav-drawer-context'
import { useScale } from '@/theme'
import { Platform } from 'react-native'

/**
 * useNavDrawerLayout
 * 
 * Returns sidebar layout info so components can know the current drawer width
 * and adjust their layout accordingly.
 * 
 * Desktop (web): Returns actual sidebar dimensions (collapsed vs expanded).
 * Mobile (native): Returns 0 (sidebar doesn't participate in layout flow).
 * 
 * Usage:
 * ```tsx
 * const { sidebarWidth, isExpanded, isDesktopSidebar } = useNavDrawerLayout()
 * // Use sidebarWidth to offset content, or isExpanded for conditional rendering
 * ```
 */
export function useNavDrawerLayout() {
  const { isExpanded } = useNavDrawer()
  const S = useScale()

  const isDesktopSidebar = Platform.OS === 'web'

  const collapsedWidth = S.space.lg * 2.5 // ~72px
  const expandedWidth = S.space.lg * 12   // ~240px

  const sidebarWidth = isDesktopSidebar
    ? (isExpanded ? expandedWidth : collapsedWidth)
    : 0

  return {
    isExpanded,
    isDesktopSidebar,
    sidebarWidth,
    collapsedWidth,
    expandedWidth,
  } as const
}
