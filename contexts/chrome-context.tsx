import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'

// ─── Types ───────────────────────────────────────────────────────────

export interface ChromeContextType {
  // TopBar: SettingsMenu modal state
  settingsMenuVisible: boolean
  openSettingsMenu: () => void
  closeSettingsMenu: () => void

  // BottomBar: Active tab state (mobile only)
  activeTab: string
  setActiveTab: (tab: string) => void
}

// ─── Context ─────────────────────────────────────────────────────────

const ChromeContext = createContext<ChromeContextType | undefined>(undefined)

// ─── Provider ────────────────────────────────────────────────────────

/**
 * 🔲 ChromeProvider
 *
 * Centralized state for persistent navigation chrome (TopBar + BottomBar).
 *
 * TopBar state:
 *   - SettingsMenu visibility (openSettingsMenu / closeSettingsMenu)
 *
 * BottomBar state:
 *   - Active tab key for mobile tab navigation (activeTab / setActiveTab)
 *
 * ✅ Gate-Free: Does not depend on kernel phases.
 * UI chrome components consume this via useChrome() hook.
 */
export function ChromeProvider({ children }: { children: React.ReactNode }) {
  // TopBar: SettingsMenu visibility
  const [settingsMenuVisible, setSettingsMenuVisible] = useState(false)

  // BottomBar: Active tab key (mobile only, default to first tab)
  const [activeTab, setActiveTab] = useState('characters')

  const openSettingsMenu = useCallback(() => {
    setSettingsMenuVisible(true)
  }, [])

  const closeSettingsMenu = useCallback(() => {
    setSettingsMenuVisible(false)
  }, [])

  const contextValue: ChromeContextType = useMemo(() => ({
    settingsMenuVisible,
    openSettingsMenu,
    closeSettingsMenu,
    activeTab,
    setActiveTab,
  }), [settingsMenuVisible, openSettingsMenu, closeSettingsMenu, activeTab])

  return (
    <ChromeContext.Provider value={contextValue}>
      {children}
    </ChromeContext.Provider>
  )
}

// ─── Hook ────────────────────────────────────────────────────────────

/**
 * 🔲 useChrome
 *
 * Consumer hook for navigation chrome state (TopBar + BottomBar).
 *
 * Usage:
 * ```tsx
 * const { openSettingsMenu, closeSettingsMenu, settingsMenuVisible } = useChrome();
 * const { activeTab, setActiveTab } = useChrome();
 * ```
 */
export function useChrome(): ChromeContextType {
  const context = useContext(ChromeContext)

  if (!context) {
    throw new Error('useChrome must be used within ChromeProvider')
  }

  return context
}
