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

import React, { createContext, useCallback, useContext, useState } from 'react'

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
 * Modals auto-register by calling registerModal() at component definition.
 */
const modalRegistry = new Map<string, React.ComponentType<any>>()

/**
 * Register a modal component so it can be rendered by ModalLayer.
 * Call this at the bottom of your modal component file.
 *
 * Example:
 * export function UpdateCredsModal({ visible, ...props }) { ... }
 * registerModal('update-creds', UpdateCredsModal)
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
 * Wrap this at the top of your app (in RootLayout).
 */
export function ModalProvider({ children }: { children: React.ReactNode }) {
  const [modal, setModal] = useState<ModalState>({
    type: null,
    props: {},
    visible: false,
  })

  const openModal = useCallback((type: string, props?: Record<string, any>) => {
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
    setTimeout(() => {
      setModal({
        type: null,
        props: {},
        visible: false,
      })
    }, 300)
  }, [])

  const isModalOpen = useCallback((type?: string) => {
    if (!type) return modal.visible
    return modal.visible && modal.type === type
  }, [modal.visible, modal.type])

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
 */
function ModalLayer() {
  const { modal } = useModal()

  if (!modal.type || !modal.visible) return null

  const ModalComponent = modalRegistry.get(modal.type)
  if (!ModalComponent) {
    console.warn(`Modal type '${modal.type}' is not registered.`)
    return null
  }

  return <ModalComponent visible={true} {...modal.props} />
}

