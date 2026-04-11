import React, { createContext, useCallback, useContext, useMemo, useState } from 'react'

// ─── Types ───────────────────────────────────────────────────────────

export interface ChromeContextType {
  // TopBar: SettingsMenu modal state
  settingsMenuVisible: boolean
  openSettingsMenu: () => void
  closeSettingsMenu: () => void
}

// ─── Context ─────────────────────────────────────────────────────────

const ChromeContext = createContext<ChromeContextType | undefined>(undefined)

// ─── Provider ────────────────────────────────────────────────────────

/**
 * 🔲 ChromeProvider
 *
 * Centralized state for persistent navigation chrome UI state (TopBar only).
 *
 * TopBar state:
 *   - SettingsMenu visibility (openSettingsMenu / closeSettingsMenu)
 *
 * ✅ Gate-Free: Does not depend on kernel phases.
 * UI chrome components consume this via useChrome() hook.
 *
 * Note: Bottom bar behavior is now managed separately by useChromeBottom() hook.
 */
export function ChromeProvider({ children }: { children: React.ReactNode }) {
  // TopBar: SettingsMenu visibility
  const [settingsMenuVisible, setSettingsMenuVisible] = useState(false)

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
  }), [settingsMenuVisible, openSettingsMenu, closeSettingsMenu])

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
 * Consumer hook for navigation chrome state (TopBar UI state).
 *
 * Usage:
 * ```tsx
 * const { openSettingsMenu, closeSettingsMenu, settingsMenuVisible } = useChrome();
 * ```
 *
 * Note: Bottom bar behavior is now owned by useChromeBottom() hook.
 */
export function useChrome(): ChromeContextType {
  const context = useContext(ChromeContext)

  if (!context) {
    throw new Error('useChrome must be used within ChromeProvider')
  }

  return context
}
