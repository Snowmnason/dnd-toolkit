/**
 * Modal Context
 *
 * Centralized modal state management for consistent modal display across the app.
 * Works with AppModal and any custom modals built from it.
 *
 * Each modal gets its own hook (e.g., useUpdateCredsModal, useSettingsModal).
 * Hooks manage their lifecycle, context manages which is visible, ModalLayer renders.
 *
 * Usage:
 * const { openModal, closeModal } = useModal()
 *
 * openModal('edit-world', {
 *   worldName: 'Campaign 5',
 *   onConfirmWorldName: () => {}
 * })
 *
 * closeModal()
 */

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

/**
 * Modal state — tracks which modal is open and its props
 */
export interface ModalState {
  type: string | null // Modal identifier (e.g., 'edit-world', 'confirm-leave')
  props: Record<string, any> // Flexible props for any modal
  visible: boolean // Whether modal is currently visible
}

/**
 * Modal context value exposed to consumers
 */
interface ModalContextValue {
  modal: ModalState
  openModal: (type: string, props?: Record<string, any>) => void
  closeModal: () => void
  isModalOpen: (type?: string) => boolean
}

const ModalContext = createContext<ModalContextValue | undefined>(undefined)

/**
 * 🗂️ Modal Registry
 * Maps modal type strings to their React components.
 * Modals auto-register by calling registerModal() at component definition,
 * but only if their module is actually imported at runtime.
 *
 * CRITICAL: All modal modules are imported via 'register-all-modals.ts'
 * which is imported in app/_layout.tsx (NOT here — to avoid circular deps).
 */
const modalRegistry = new Map<string, React.ComponentType<any>>()

/**
 * Register a modal component so it can be rendered by ModalLayer.
 *
 * USAGE (at the bottom of your modal file):
 * export function MyModal({ visible, ...props }) { ... }
 * registerModal('my-modal', MyModal)
 *
 * IMPORTANT: Your modal file must be imported in register-all-modals.ts
 * for this registerModal() call to execute at runtime.
 */
export function registerModal(type: string, Component: React.ComponentType<any>): void {
  if (modalRegistry.has(type)) {
    console.warn(`Modal '${type}' is already registered. Overwriting.`)
  }
  modalRegistry.set(type, Component)
}

/**
 * 🪟 ModalProvider
 * Root-level provider for managing modal state and rendering.
 * Automatically renders active modals — no need to add a separate ModalLayer to RootLayout.
 *
 * NOTE: Modal registration happens via 'register-all-modals.ts' imported in
 * app/_layout.tsx. This avoids circular dependency (modal files import from
 * @/contexts which re-exports this file).
 *
 * ✅ Gate-Free: ModalProvider does not depend on kernel phases.
 * It only manages modal visibility state and registry with React hooks.
 * No storage, services, or API access needed.
 *
 * Wrap this at the top of your app (in RootLayout).
 */
export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [modal, setModal] = useState<ModalState>({
    type: null,
    props: {},
    visible: false,
  })
  
  // Track timeout to prevent stale timeouts from clearing new modals
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const openModal = useCallback((type: string, props?: Record<string, any>) => {
    // Cancel any pending close timeout from a previous modal
    if (closeTimeoutRef.current) {
      clearTimeout(closeTimeoutRef.current)
      closeTimeoutRef.current = null
    }
    
    setModal({
      type,
      props: props || {},
      visible: true,
    })
  }, [])

  const closeModal = useCallback(() => {
    setModal(prev => ({
      ...prev,
      visible: false,
      // Keep type/props for transition animation, but mark as not visible
    }))
    // Clear after animation completes (optional — depends on your AppModal animation duration)
    // Store timeout in ref so we can cancel it if a new modal opens
    closeTimeoutRef.current = setTimeout(() => {
      setModal({
        type: null,
        props: {},
        visible: false,
      })
      closeTimeoutRef.current = null
    }, 300)
  }, [])

  const isModalOpen = useCallback((type?: string) => {
    if (!type) return modal.visible
    return modal.visible && modal.type === type
  }, [modal.visible, modal.type])

  // Cleanup: cancel pending timeout when provider unmounts
  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        clearTimeout(closeTimeoutRef.current)
      }
    }
  }, [])

  return (
    <ModalContext.Provider value={{ modal, openModal, closeModal, isModalOpen }}>
      {children}
      <ModalLayer />
    </ModalContext.Provider>
  )
}

/**
 * 🪝 useModal
 * Hook to open/close modals from anywhere in the app.
 *
 * Example usage:
 * const { openModal, closeModal, modal } = useModal()
 * openModal('edit-world', { worldName: 'My World' })
 * closeModal()
 * console.log(modal.type) // 'edit-world'
 */
export function useModal() {
  const context = useContext(ModalContext)
  if (!context) {
    throw new Error('useModal must be used within ModalProvider')
  }
  return context
}

/**
 * 🪝 useIsModalOpen
 * Convenience hook to check if a specific modal is open.
 *
 * Example: const isEditWorldOpen = useIsModalOpen('edit-world')
 */
export function useIsModalOpen(modalType: string): boolean {
  const { isModalOpen } = useModal()
  return isModalOpen(modalType)
}

/**
 * 🪟 ModalLayer
 * Internal renderer for active modals.
 * Automatically used inside ModalProvider.
 * Looks up modal components in the registry by type.
 *
 * Renders while modal.type is set (keeps component mounted for exit animations).
 * Passes visible={modal.visible} after props spread to ensure context controls visibility
 * and prevents modal.props.visible from overriding it.
 */
function ModalLayer() {
  const { modal } = useModal()

  // Render while modal.type is set, regardless of visible state
  // This allows exit animations to play while visible={false}
  if (!modal.type) return null

  const ModalComponent = modalRegistry.get(modal.type)
  if (!ModalComponent) {
    console.warn(`Modal type '${modal.type}' is not registered.`)
    return null
  }

  // Pass visible after spread to ensure context controls visibility
  // and prevents modal.props.visible from overriding it
  return <ModalComponent {...modal.props} visible={modal.visible} />
}

