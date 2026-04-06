import { useAppKernel } from '@/hooks/kernel/use-app-kernel'
import { logger } from '@/lib'
import { STORAGE_KEYS } from '@/maps/storage-keys'
import { SecureStorage } from '@/system/Storage'
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react'

/**
 * 🔓 NavDrawerContext
 * 
 * Centralized drawer state management following same pattern as AppToastContext + AppSnackbarContext.
 * 
 * Desktop (web): Expandable sidebar — always visible, collapsed (icons) ↔ expanded (icons + text).
 *   isExpanded state is persisted to storage and auto-restored on app load.
 *   Main content flex-grows/shrinks around the sidebar.
 * 
 * Mobile (native): Modal overlay — 60% net width, dim backdrop, tap-to-close.
 *   Controlled via show()/hide()/toggle().
 * 
 * Supports:
 * - Single active drawer at a time (queue-based, mobile)
 * - Desktop sidebar expand/collapse with persistence
 * - Position: left or right
 */

// ─── Types ───────────────────────────────────────────────────────────

export type DrawerPosition = 'left' | 'right'

export interface NavDrawerState {
  visible: boolean
  position: DrawerPosition
}

export interface NavDrawerContextType {
  drawer: NavDrawerState
  /** Desktop sidebar expanded state (persisted to storage) */
  isExpanded: boolean
  /** Toggle desktop sidebar expanded/collapsed (persists to storage) */
  setExpanded: (expanded: boolean) => void
  /** Open the modal drawer. Position defaults to 'left'. */
  show: (options?: { position?: DrawerPosition }) => void
  hide: () => void
  /** Toggle the modal drawer open/closed. */
  toggle: (options?: { position?: DrawerPosition }) => void
}

// ─── Context ─────────────────────────────────────────────────────────

const NavDrawerContext = createContext<NavDrawerContextType | undefined>(undefined)

// ─── Provider ────────────────────────────────────────────────────────

/**
 * 🔓 NavDrawerProvider
 * 
 * Desktop: Manages sidebar expanded/collapsed state (persisted to storage).
 * Mobile: Queue-based modal drawer manager.
 * 
 * Integration: Used inside OverlayProvider (after ModalProvider, before NotificationProvider)
 */
export function NavDrawerProvider({ children }: { children: React.ReactNode }) {
  const kernel = useAppKernel()
  
  const [drawer, setDrawer] = useState<NavDrawerState>({
    visible: false,
    position: 'left',
  })

  const [isExpanded, setIsExpanded] = useState(false)

  // Load persisted sidebar expanded state after bootstrap completes → auto-open if user preferred expanded
  useEffect(() => {
    if (!kernel.phases.appReady) return
    
    const loadDrawerState = async () => {
      try {
        const stored = await SecureStorage.getItem(STORAGE_KEYS.NAV_DRAWER_EXPANDED)
        if (stored === 'true') {
          setIsExpanded(true)
        }
      } catch (error) {
        logger.category('storage').error('Failed to load nav drawer state', { error })
      }
    }
    loadDrawerState()
  }, [kernel.phases.appReady])

  // Desktop sidebar expand/collapse (persisted after bootstrap)
  const setExpanded = useCallback((expanded: boolean) => {
    setIsExpanded(expanded)
    // Only persist to storage after bootstrap completes
    if (kernel.phases.appReady) {
      SecureStorage.setItem(STORAGE_KEYS.NAV_DRAWER_EXPANDED, expanded ? 'true' : 'false').catch(() => {})
    }
  }, [kernel.phases.appReady])

  const show = useCallback((options?: { position?: DrawerPosition }) => {
    setDrawer({
      visible: true,
      position: options?.position || 'left',
    })
  }, [])

  const hide = useCallback(() => {
    setDrawer(prev => ({ ...prev, visible: false }))
  }, [])

  const toggle = useCallback((options?: { position?: DrawerPosition }) => {
    if (drawer.visible) {
      hide()
    } else {
      show(options)
    }
  }, [drawer.visible, show, hide])

  const contextValue: NavDrawerContextType = {
    drawer,
    isExpanded,
    setExpanded,
    show,
    hide,
    toggle,
  }

  return (
    <NavDrawerContext.Provider value={contextValue}>
      {children}
    </NavDrawerContext.Provider>
  )
}

// ─── Hook ────────────────────────────────────────────────────────────

/**
 * 🔓 useNavDrawer
 * 
 * Consumer hook for drawer state management.
 * 
 * Usage:
 * ```tsx
 * const { show, hide, isExpanded, setExpanded } = useNavDrawer();
 * 
 * // Open modal drawer from left
 * <Button onPress={() => show({ position: 'left' })} />
 * 
 * // Toggle sidebar (expandable mode)
 * <Button onPress={() => setExpanded(!isExpanded)} />
 * ```
 */
export function useNavDrawer(): NavDrawerContextType {
  const context = useContext(NavDrawerContext)

  if (!context) {
    throw new Error('useNavDrawer must be used within NavDrawerProvider')
  }

  return context
}
