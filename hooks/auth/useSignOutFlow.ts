/**
 * useSignOutFlow
 *
 * Unified state machine hook for two account-exit flows: sign-out and delete-account.
 * Both flows share the same modal/phase pattern but differ in Phase 1 and what Phase 2 does.
 *
 * Sign-Out flow:
 *   initiate() → Phase 1: sync upload queue (button disabled)
 *             → modal: 'confirm-signout' (or 'confirm-signout-force' if sync failed)
 *             → confirm() → Phase 2: clear storage + provider sign-out → navigate
 *   or:       → forceAction() → skip sync, run Phase 2 directly → navigate
 *
 * Delete-Account flow:
 *   initiate() → modal: 'confirm-delete' (password required)
 *             → confirm(password) → delete account + Phase 2 cleanup → navigate
 *
 * Usage:
 *   const { state, handlers } = useSignOutFlow('sign-out')
 *   // state.phase controls button disabled state
 *   // state.modal controls which modal is visible
 *   // state.error shows any failure message inside the modal
 *   // state.syncQueueSize informs the user how many items were pending
 */

import { useAppToast, useModal } from '@/contexts'
import {
  confirmSignOut,
  deleteAccountUser,
  endSignOut,
  initiateSignOut,
} from '@/lib/auth'
import { useAppParamsStable } from '@/providers'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
/** Which flow this hook instance manages. */
export type SignOutFlowMode = 'sign-out' | 'delete-account'

/**
 * Phases of the state machine.
 * The screen uses `phase` to know when to disable buttons and show loaders.
 */
export type SignOutFlowPhase =
  | 'idle'            // Default — user hasn't started anything
  | 'syncing'         // Phase 1: uploading offline queue (sign-out only)
  | 'awaiting-confirm' // Waiting for user response in modal
  | 'processing'      // Phase 2: executing the action
  | 'success'         // Done, navigation triggered
  | 'error'           // Unrecoverable error (e.g. force sign-out failed)

/**
 * Which modal the screen should display.
 * 'none' means no modal is visible.
 */
export type SignOutModal =
  | 'none'
  | 'confirm-signout'         // Normal sign-out confirmation (no password)
  | 'confirm-signout-force'   // Sync failed — show "Force Sign Out" option
  | 'confirm-delete'          // Delete account (password required)

export interface SignOutFlowState {
  phase: SignOutFlowPhase
  /** True while any async operation is running. Use to disable buttons. */
  loading: boolean
  /** Error message to display inside the modal, or null. */
  error: string | null
  /** Items that were pending sync when sign-out was initiated. Shown in confirm modal. */
  syncQueueSize: number
  /** Navigation target returned by the system after success. */
  redirectTarget?: string
}

export interface SignOutFlowHandlers {
  /** Start the flow. Runs Phase 1 if sign-out, or opens modal directly if delete-account. */
  initiate: () => Promise<void>
  /**
   * User confirms action in modal. Runs Phase 2.
   * For delete-account mode, password is required.
   */
  confirm: (password?: string) => Promise<void>
  /**
   * Force sign-out when sync failed (sign-out mode only).
   * Skips the sync and runs Phase 2 directly.
   */
  forceAction: () => Promise<void>
  /** User cancels. Dismisses modal and resets to idle. */
  cancel: () => void
}

// ============================================================================
// CONSTANTS
// ============================================================================

const INITIAL_STATE: SignOutFlowState = {
  phase: 'idle',
  loading: false,
  error: null,
  syncQueueSize: 0,
}

// ============================================================================
// HOOK
// ============================================================================

export function useSignOutFlow(mode: SignOutFlowMode): {
  state: SignOutFlowState
  handlers: SignOutFlowHandlers
} {
  const [state, setState] = useState<SignOutFlowState>(INITIAL_STATE)
  const router = useRouter()
  const { show: showToast, hide: hideToast } = useAppToast()
  const { openModal, closeModal } = useModal()
  const { clearAllParams } = useAppParamsStable()
  const [currentModalType, setCurrentModalType] = useState<'confirm-signout' | 'confirm-signout-force' | 'confirm-delete' | null>(null)

  /** Merge a partial update into state. */
  const patch = useCallback((partial: Partial<SignOutFlowState>) => {
    setState(prev => ({ ...prev, ...partial }))
  }, [])

  // Show "Syncing..." toast when entering sync phase, dismiss when leaving
  useEffect(() => {
    if (state.phase === 'syncing') {
      showToast('Sync', 'Syncing...', 'warning', 60000) // Show for 60 seconds (or until hidden)
    } else if (state.phase !== 'idle') {
      // Dismiss toast when moving to next phase
      hideToast()
    }
  }, [state.phase, showToast, hideToast])

  // --------------------------------------------------------------------------
  // initiate — Phase 1
  // --------------------------------------------------------------------------

  const initiate = useCallback(async () => {
    // Prevent double-trigger
    if (state.phase !== 'idle') return

    if (mode === 'sign-out') {
      // Phase 1: Upload offline queue before showing the confirmation modal.
      // The user sees the button disabled while this runs.
      patch({ phase: 'syncing', loading: true, error: null })

      const syncResult = await initiateSignOut('user-initiated')

      if (!syncResult.success) {
        // Sync failed — set modal type to show force option
        patch({
          phase: 'awaiting-confirm',
          loading: false,
          syncQueueSize: syncResult.syncQueueSize,
          error: syncResult.errors[0]?.message ?? 'Data sync failed.',
        })
        setCurrentModalType('confirm-signout-force')
      } else {
        // Sync succeeded — set normal confirmation modal
        patch({
          phase: 'awaiting-confirm',
          loading: false,
          syncQueueSize: syncResult.syncQueueSize,
          error: null,
        })
        setCurrentModalType('confirm-signout')
      }
    } else {
      // Delete account — no pre-sync needed, go straight to password modal
      patch({
        phase: 'awaiting-confirm',
        loading: false,
        error: null,
      })
      setCurrentModalType('confirm-delete')
    }
  }, [state.phase, mode, patch])

  // --------------------------------------------------------------------------
  // confirm — Phase 2 (user clicked the modal's primary action button)
  // --------------------------------------------------------------------------

  const confirm = useCallback(async (password?: string) => {
    if (state.phase !== 'awaiting-confirm') return

    patch({ phase: 'processing', loading: true, error: null })

    if (mode === 'delete-account') {
      if (!password) {
        patch({ phase: 'awaiting-confirm', loading: false, error: 'Password is required.' })
        return
      }

      const deleteResult = await deleteAccountUser(password)

      if (!deleteResult.success) {
        // Keep modal open so user can retry or cancel.
        patch({
          phase: 'awaiting-confirm',
          loading: false,
          error: deleteResult.errors[0]?.message ?? 'Account deletion failed. Please try again.',
        })
        return
      }

      closeModal()
      setCurrentModalType(null)
      
      // CRITICAL: Clear app params IMMEDIATELY after delete completes, before navigation.
      // This ensures next login has completely fresh state.
      clearAllParams()
      
      const target = deleteResult.redirect ?? '/login/sign-in'
      patch({ phase: 'success', loading: false, redirectTarget: target })
      router.replace(target as Parameters<typeof router.replace>[0])

      // Allow new auth subscriptions to register (login screen)
      endSignOut()
    } else {
      const signOutResult = await confirmSignOut('user-initiated')

      if (!signOutResult.success) {
        // Keep modal open so user can retry or cancel.
        patch({
          phase: 'awaiting-confirm',
          loading: false,
          error: signOutResult.errors[0]?.message ?? 'Sign-out failed. Please try again.',
        })
        return
      }

      closeModal()
      setCurrentModalType(null)
      
      // CRITICAL: Clear app params IMMEDIATELY after sign-out completes, before navigation.
      // This prevents race condition where old userId/worldId data persists during login attempt.
      // This ensures next sign-in has completely fresh state.
      clearAllParams()
      
      const target = signOutResult.redirect ?? '/login/sign-in'
      patch({ phase: 'success', loading: false, redirectTarget: target })
      router.replace(target as Parameters<typeof router.replace>[0])

      // Allow new auth subscriptions to register (login screen)
      endSignOut()
    }
  }, [state.phase, mode, patch, closeModal, router, clearAllParams])

  // --------------------------------------------------------------------------
  // forceAction — Force sign-out when sync failed (sign-out mode only)
  // --------------------------------------------------------------------------

  const forceAction = useCallback(async () => {
    // Note: removed check for modal type, relying on phase check instead
    if (state.phase !== 'awaiting-confirm') return

    // Dismiss modal immediately, show processing state.
    closeModal()
    setCurrentModalType(null)
    patch({ phase: 'processing', loading: true, error: null })

    const signOutResult = await confirmSignOut('user-initiated')

    if (!signOutResult.success) {
      // Unrecoverable at this point — phase 'error' surfaces a fallback message.
      patch({
        phase: 'error',
        loading: false,
        error: signOutResult.errors[0]?.message ?? 'Sign-out failed. Please restart the app.',
      })
      return
    }

    // CRITICAL: Clear app params IMMEDIATELY after sign-out completes, before navigation.
    // This prevents race condition where old userId/worldId data persists during login attempt.
    // This ensures next sign-in has completely fresh state.
    clearAllParams()

    const target = signOutResult.redirect ?? '/login/sign-in'
    patch({ phase: 'success', loading: false, redirectTarget: target })
    router.replace(target as Parameters<typeof router.replace>[0])

    // Allow new auth subscriptions to register (login screen)
    endSignOut()
  }, [state.phase, patch, closeModal, router, clearAllParams])

  // --------------------------------------------------------------------------
  // cancel — User dismisses modal without confirming
  // --------------------------------------------------------------------------

  const cancel = useCallback(() => {
    closeModal()
    setCurrentModalType(null)
    setState(INITIAL_STATE)
  }, [closeModal])

  // --------------------------------------------------------------------------
  // Effect: Update modal props whenever state changes (after handlers defined)
  // --------------------------------------------------------------------------

  useEffect(() => {
    if (!currentModalType) return

    if (currentModalType === 'confirm-signout-force') {
      openModal('confirm-signout', {
        syncQueueSize: state.syncQueueSize,
        loading: state.loading,
        errorText: state.error ?? '',
        showForceOption: true,
        forceActionLabel: 'Force Sign Out',
        onForceAction: forceAction,
        onCancel: cancel,
        onConfirm: () => confirm(),
      })
    } else if (currentModalType === 'confirm-signout') {
      openModal('confirm-signout', {
        syncQueueSize: state.syncQueueSize,
        loading: state.loading,
        errorText: state.error ?? '',
        showForceOption: false,
        onCancel: cancel,
        onConfirm: () => confirm(),
      })
    } else if (currentModalType === 'confirm-delete') {
      openModal('confirm-delete', {
        loading: state.loading,
        errorText: state.error ?? '',
        onCancel: cancel,
        onConfirm: (password: string) => confirm(password),
      })
    }
  }, [state.syncQueueSize, state.loading, state.error, currentModalType, openModal, forceAction, cancel, confirm])

  return {
    state,
    handlers: { initiate, confirm, forceAction, cancel },
  }
}
