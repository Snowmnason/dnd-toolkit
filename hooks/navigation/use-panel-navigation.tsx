import { usePlatform } from '@/providers'
import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'
import { Platform } from 'react-native'

/**
 * PanelNavigationContext
 * 
 * Provides panel navigation state to the entire subtree (including TopBar).
 * This enables the TopBar back button to be aware of panel state and intercept
 * back navigation when a right panel is visible on mobile.
 */
interface PanelNavigationContextType {
  activePanel: 'left' | 'right'
  showLeftPanel: boolean
  showRightPanel: boolean
  goToRightPanel: () => void
  goToLeftPanel: () => void
  /** Returns true if the back was handled (right→left), false if not (needs router navigation) */
  handleBackPress: () => boolean
  isDesktop: boolean
  isActualMobile: boolean
  /** Whether any screen in this subtree has active panel navigation (AppSplit mounted) */
  isActive: boolean
}

const PanelNavigationContext = createContext<PanelNavigationContextType | null>(null)

interface PanelNavigationProviderProps {
  children: React.ReactNode
  onPanelChange?: (panel: 'left' | 'right') => void
}

/**
 * PanelNavigationProvider
 * 
 * Wrap around any layout that contains an AppSplit screen.
 * Provides shared panel navigation state to all children, including the TopBar.
 * 
 * ✅ Gate-Free: Does not depend on kernel phases.
 * ✅ Reusable: Works for any AppSplit screen (worlds, characters, encounters, etc.)
 * ✅ TopBar Aware: TopBar back button can check `handleBackPress()` before router.back()
 * 
 * Usage:
 *   <PanelNavigationProvider>
 *     <Stack />  (Contains AppSplit screens)
 *   </PanelNavigationProvider>
 */
export function PanelNavigationProvider({ children, onPanelChange }: PanelNavigationProviderProps) {
  const { isDesktop } = usePlatform()
  const [activePanel, setActivePanel] = useState<'left' | 'right'>('left')

  const isActualMobile = Platform.OS === 'ios' || Platform.OS === 'android'

  const showLeftPanel = isDesktop || activePanel === 'left'
  const showRightPanel = isDesktop || activePanel === 'right'

  const goToRightPanel = useCallback(() => {
    if (!isDesktop) {
      setActivePanel('right')
      onPanelChange?.('right')
    }
  }, [isDesktop, onPanelChange])

  const goToLeftPanel = useCallback(() => {
    if (!isDesktop) {
      setActivePanel('left')
      onPanelChange?.('left')
    }
  }, [isDesktop, onPanelChange])

  const handleBackPress = useCallback((): boolean => {
    if (!isDesktop && activePanel === 'right') {
      setActivePanel('left')
      onPanelChange?.('left')
      return true
    }
    return false
  }, [isDesktop, activePanel, onPanelChange])

  const value = useMemo(() => ({
    activePanel,
    showLeftPanel,
    showRightPanel,
    goToRightPanel,
    goToLeftPanel,
    handleBackPress,
    isDesktop,
    isActualMobile,
    isActive: true,
  }), [activePanel, showLeftPanel, showRightPanel, goToRightPanel, goToLeftPanel, handleBackPress, isDesktop, isActualMobile])

  return (
    <PanelNavigationContext.Provider value={value}>
      {children}
    </PanelNavigationContext.Provider>
  )
}

// Default no-op value for when no provider is mounted (single-panel screens)
const NO_PANEL_NAVIGATION: PanelNavigationContextType = {
  activePanel: 'left',
  showLeftPanel: true,
  showRightPanel: true,
  goToRightPanel: () => {},
  goToLeftPanel: () => {},
  handleBackPress: () => false,
  isDesktop: true,
  isActualMobile: false,
  isActive: false,
}

/**
 * usePanelNavigation
 * 
 * Access panel navigation state from any component in the subtree.
 * Safe to call even outside a PanelNavigationProvider — returns no-op defaults.
 * This is how single-panel screens (Settings, etc.) remain unaffected.
 * 
 * Key behaviors:
 * - AppSplit screens: Wrap layout with PanelNavigationProvider, get real panel state
 * - Single-panel screens: No provider needed, hook returns safe defaults (isActive: false)
 * - TopBar: Calls handleBackPress() — returns true if panel navigation handled back, false if router should
 * 
 * TODO: Add hardware back button support (Android)
 * TODO: Add swipe gesture support (iOS/Android only)
 * TODO: Add panel transition animations
 */
export function usePanelNavigation() {
  const context = useContext(PanelNavigationContext)
  return context ?? NO_PANEL_NAVIGATION
}
