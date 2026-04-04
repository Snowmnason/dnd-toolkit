import { useAppKernel } from '@/hooks/kernel/use-app-kernel'
import { logger } from '@/lib'
import { STORAGE_KEYS } from '@/maps/storage-keys'
import { SecureStorage } from '@/system/Storage'
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useState } from 'react'

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
  content: React.ReactNode
  id?: string // Optional: for multi-drawer scenarios
}

export interface NavDrawerContextType {
  drawer: NavDrawerState
  /** Desktop sidebar expanded state (persisted to storage) */
  isExpanded: boolean
  /** Toggle desktop sidebar expanded/collapsed (persists to storage) */
  setExpanded: (expanded: boolean) => void
  show: (content: React.ReactNode, options?: { position?: DrawerPosition; id?: string }) => void
  hide: () => void
  toggle: (content?: React.ReactNode, options?: { position?: DrawerPosition; id?: string }) => void
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
    content: null,
  })

  const [isExpanded, setIsExpanded] = useState(false)
  const [, setQueue] = useState<{ content: ReactNode; options?: { position?: DrawerPosition; id?: string } }[]>([])

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

  // Mobile: show drawer as modal overlay
  const show = useCallback(
    (content: React.ReactNode, options?: { position?: DrawerPosition; id?: string }) => {
      if (drawer.visible) {
        // Already showing → queue this drawer
        setQueue((prev) => [...prev, { content, options }])
      } else {
        setDrawer({
          visible: true,
          position: options?.position || 'left',
          content,
          id: options?.id,
        })
      }
    },
    [drawer.visible]
  )

  // Mobile: hide drawer modal overlay
  const hide = useCallback(() => {
    setDrawer((prev) => ({ ...prev, visible: false }))

    // Auto-show next queued drawer
    setQueue((prev) => {
      if (prev.length === 0) return prev

      const next = prev[0]
      const remaining = prev.slice(1)

      // Schedule the next drawer to show (after current animation completes)
      setTimeout(() => {
        setDrawer({
          visible: true,
          position: next.options?.position || 'left',
          content: next.content,
          id: next.options?.id,
        })
      }, 150) // Match animation duration

      return remaining
    })
  }, [])

  const toggle = useCallback(
    (content?: React.ReactNode, options?: { position?: DrawerPosition; id?: string }) => {
      if (drawer.visible) {
        hide()
      } else if (content !== undefined) {
        show(content, options)
      }
    },
    [drawer.visible, show, hide]
  )

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
 * Consumer hook for displaying drawers.
 * 
 * Usage:
 * ```tsx
 * const { show, hide } = useNavDrawer();
 * 
 * // Show drawer from left
 * <Button onPress={() => show(<MyDrawerContent />, { position: 'left' })} />
 * 
 * // Hide drawer
 * <Button onPress={() => hide()} />
 * ```
 */
export function useNavDrawer(): NavDrawerContextType {
  const context = useContext(NavDrawerContext)

  if (!context) {
    throw new Error('useNavDrawer must be used within NavDrawerProvider')
  }

  return context
}
