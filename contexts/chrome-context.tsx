import React, { createContext, useContext } from 'react'

// ─── Types ───────────────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface ChromeContextType {
  // Reserved for future TopBar chrome state (e.g. TopBar title overrides, visibility flags)
}

// ─── Context ─────────────────────────────────────────────────────────

const ChromeContext = createContext<ChromeContextType | undefined>(undefined)

// ─── Provider ────────────────────────────────────────────────────────

/**
 * 🔲 ChromeProvider
 *
 * Centralized state for persistent navigation chrome UI state (TopBar only).
 *
 * Settings menu is now managed via the modal system (openModal('settings')).
 *
 * ✅ Gate-Free: Does not depend on kernel phases.
 * UI chrome components consume this via useChrome() hook.
 *
 * Note: Bottom bar behavior is now managed separately by useChromeBottom() hook.
 */
export function ChromeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ChromeContext.Provider value={{}}>
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
 * Note: Bottom bar behavior is now owned by useChromeBottom() hook.
 * Note: Settings menu is now opened via openModal('settings') from modal-context.
 */
export function useChrome(): ChromeContextType {
  const context = useContext(ChromeContext)

  if (!context) {
    throw new Error('useChrome must be used within ChromeProvider')
  }

  return context
}
