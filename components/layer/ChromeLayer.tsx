import { ChromeBottomBar } from '@/components/chrome/ChromeBottomBar'
import { ChromeTopBar } from '@/components/chrome/ChromeTopBar'
import { useChrome } from '@/contexts/chrome-context'
import { Platform } from 'react-native'

// ═══════════════════════════════════════════════════════════════════════
// ChromeLayer — Orchestration skeleton for navigation chrome
//
// This layer handles ONLY:
//   - Context connection (useChrome for state)
//   - Platform detection (mobile vs desktop)
//   - Visibility logic (when to show/hide sections)
//   - Composition (which chrome components to render)
//
// All visual styling (colors, fonts, text) lives in the components:
//   - ChromeTopBar  → components/chrome/ChromeTopBar.tsx
//   - ChromeBottomBar → components/chrome/ChromeBottomBar.tsx
// ═══════════════════════════════════════════════════════════════════════

export interface ChromeLayerTopBarProps {
  title: string
  showBackButton: boolean
  showHamburger: boolean
  onBackPress?: () => void
  a11yFocusTarget?: 'title' | 'firstInteractive' | 'none'
}

export interface ChromeLayerBottomBarProps {
  /** Whether to show the bottom bar (mobile only, route-dependent) */
  visible: boolean
  /** Current active tab key */
  activeTab: string
  /** Tab change handler — typically navigates to tab route */
  onTabChange: (tabKey: string) => void
}

export interface ChromeLayerProps {
  topBar: ChromeLayerTopBarProps
  bottomBar?: ChromeLayerBottomBarProps
}

export function ChromeLayer({ topBar, bottomBar }: ChromeLayerProps) {
  const { openSettingsMenu } = useChrome()
  const isMobile = Platform.OS !== 'web'

  return (
    <>
      <ChromeTopBar
        title={topBar.title}
        showBackButton={topBar.showBackButton}
        showHamburger={topBar.showHamburger}
        onBackPress={topBar.onBackPress}
        onHamburgerPress={openSettingsMenu}
        a11yFocusTarget={topBar.a11yFocusTarget}
      />

      {/* BottomBar: Mobile only, when visible */}
      {isMobile && bottomBar?.visible && (
        <ChromeBottomBar
          activeTab={bottomBar.activeTab}
          onTabChange={bottomBar.onTabChange}
        />
      )}
    </>
  )
}
