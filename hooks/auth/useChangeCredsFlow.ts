/**
 * useChangeCredsFlow
 *
 * Manages credential updates for logged-in users in settings:
 *   - Change password (requires current password + new password)
 *   - Change username (just the new username)
 *
 * Both flows are modal-based:
 *   initiatePasswordChange() → verify identity → open 'change-password' modal
 *   initiateUsernameChange() → verify identity → open 'change-username' modal
 *   confirm*() → submit via manager → success / error inside modal
 *   cancelModal() → close modal, reset to idle
 *
 * Usage:
 *   const { state, passwordForm, usernameForm, handlers } = useChangeCredsFlow()
 *   // state.modal → which modal to show ('none' | 'change-password' | 'change-username')
 *   // state.phase → 'idle' | 'verifying' | 'awaiting-modal' | 'processing' | 'success' | 'error'
 *   // passwordForm.handleSubmit → trigger from modal submit button
 *   // usernameForm.handleSubmit → trigger from modal submit button
 */

import { useModal } from '@/contexts'
import {
  updatePasswordLoggedIn,
  updateUsernameUser,
  verifyIdentityForCredentialUpdate,
} from '@/lib/auth'
import { logger } from '@/lib/utils'
import {
  changePasswordSchema,
  updateUsernameSchema,
  type ChangePasswordFormData,
  type UpdateUsernameFormData,
} from '@/validation/auth.schema'
import { zodResolver } from '@hookform/resolvers/zod'
import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'

// ============================================================================
// TYPES
// ============================================================================

export type ChangeCredsPhase =
  | 'idle'            // Default — no active flow
  | 'verifying'       // Running identity verification before opening modal
  | 'awaiting-modal'  // Modal is open, waiting for user input
  | 'processing'      // Submitting the credential update
  | 'success'         // Update succeeded (shown briefly before auto-dismiss)
  | 'error'           // Verification or update failed

export interface ChangeCredsState {
  phase: ChangeCredsPhase
  /** True while any async operation is running. Use to disable buttons. */
  loading: boolean
  /** Error message shown inside the modal, or null. */
  error: string | null
  /** Success message shown inside the modal after a successful update. */
  successMessage: string | null
}

export interface ChangeCredsHandlers {
  /** Verify identity then open the change-password modal. */
  initiatePasswordChange: () => Promise<void>
  /** Verify identity then open the change-username modal. */
  initiateUsernameChange: () => Promise<void>
  /** Close the active modal and reset to idle. */
  cancelModal: () => void
}

// ============================================================================
// CONSTANTS
// ============================================================================

const INITIAL_STATE: ChangeCredsState = {
  phase: 'idle',
  loading: false,
  error: null,
  successMessage: null,
}

// ============================================================================
// HOOK
// ============================================================================

export function useChangeCredsFlow(currentUsername = ''): {
  state: ChangeCredsState
  passwordForm: {
    control: ReturnType<typeof useForm<ChangePasswordFormData>>['control']
    isValid: boolean
    handleSubmit: () => void
  }
  usernameForm: {
    control: ReturnType<typeof useForm<UpdateUsernameFormData>>['control']
    isValid: boolean
    handleSubmit: () => void
  }
  handlers: ChangeCredsHandlers
} {
  const [state, setState] = useState<ChangeCredsState>(INITIAL_STATE)
  const { openModal, closeModal } = useModal()
  const [currentCredsType, setCurrentCredsType] = useState<'password' | 'username' | null>(null)

  const patch = useCallback((partial: Partial<ChangeCredsState>) => {
    setState(prev => ({ ...prev, ...partial }))
  }, [])

  // --------------------------------------------------------------------------
  // Forms
  // --------------------------------------------------------------------------

  const passwordForm = useForm<ChangePasswordFormData>({
    resolver: zodResolver(changePasswordSchema),
    mode: 'onChange',
    defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' },
  })

  const usernameForm = useForm<UpdateUsernameFormData>({
    resolver: zodResolver(updateUsernameSchema),
    mode: 'onChange',
    defaultValues: { username: '', originalUsername: currentUsername },
  })

  // --------------------------------------------------------------------------
  // Phase 1: Verify identity (gate for both modals)
  // --------------------------------------------------------------------------

  const verifyFirst = useCallback(async (): Promise<boolean> => {
    if (state.phase !== 'idle') return false

    patch({ phase: 'verifying', loading: true, error: null, successMessage: null })

    const result = await verifyIdentityForCredentialUpdate()

    if (!result.success) {
      patch({
        phase: 'error',
        loading: false,
        error: result.errors[0]?.message ?? 'Verification failed. Please try again.',
      })
      return false
    }

    return true
  }, [state.phase, patch])

  // --------------------------------------------------------------------------
  // Initiate handlers
  // --------------------------------------------------------------------------

  const initiatePasswordChange = useCallback(async () => {
    const verified = await verifyFirst()
    if (!verified) return

    passwordForm.reset({ currentPassword: '', newPassword: '', confirmPassword: '' })
    setCurrentCredsType('password')
    patch({ phase: 'awaiting-modal', loading: false })
  }, [verifyFirst, passwordForm, patch])

  const initiateUsernameChange = useCallback(async () => {
    const verified = await verifyFirst()
    if (!verified) return

    usernameForm.reset({ username: '', originalUsername: currentUsername })
    setCurrentCredsType('username')
    patch({ phase: 'awaiting-modal', loading: false })
  }, [verifyFirst, usernameForm, currentUsername, patch])

  const cancelModal = useCallback(() => {
    closeModal()
    setCurrentCredsType(null)
    setState(INITIAL_STATE)
  }, [closeModal])

  // --------------------------------------------------------------------------
  // Submit: change password
  // --------------------------------------------------------------------------

  const onPasswordSubmit = useCallback(async (data: ChangePasswordFormData) => {
    if (state.phase !== 'awaiting-modal') return

    patch({ phase: 'processing', loading: true, error: null })

    try {
      const result = await updatePasswordLoggedIn(data.currentPassword, data.newPassword)

      if (!result.success) {
        patch({
          phase: 'awaiting-modal',
          loading: false,
          error: result.errors[0]?.message ?? 'Password update failed. Please try again.',
        })
        return
      }

      patch({
        phase: 'success',
        loading: false,
        successMessage: 'Password updated successfully.',
      })
    } catch (error) {
      logger.category('auth').error('Change password error:', error)
      patch({
        phase: 'awaiting-modal',
        loading: false,
        error: 'An unexpected error occurred. Please try again.',
      })
    }
  }, [state.phase, patch])

  // --------------------------------------------------------------------------
  // Submit: change username
  // --------------------------------------------------------------------------

  const onUsernameSubmit = useCallback(async (data: UpdateUsernameFormData) => {
    if (state.phase !== 'awaiting-modal') return

    patch({ phase: 'processing', loading: true, error: null })

    try {
      const result = await updateUsernameUser(data.username)

      if (!result.success) {
        patch({
          phase: 'awaiting-modal',
          loading: false,
          error: result.errors[0]?.message ?? 'Username update failed. Please try again.',
        })
        return
      }

      patch({
        phase: 'success',
        loading: false,
        successMessage: `Username changed to "${data.username}".`,
      })
    } catch (error) {
      logger.category('auth').error('Change username error:', error)
      patch({
        phase: 'awaiting-modal',
        loading: false,
        error: 'An unexpected error occurred. Please try again.',
      })
    }
  }, [state.phase, patch])

  // --------------------------------------------------------------------------
  // Effect: Update modal props whenever form or state changes
  // --------------------------------------------------------------------------

  useEffect(() => {
    if (state.phase !== 'awaiting-modal' || !currentCredsType) return

    if (currentCredsType === 'password') {
      openModal('update-password', {
        passwordControl: passwordForm.control,
        passwordIsValid: passwordForm.formState.isValid,
        passwordHandleSubmit: passwordForm.handleSubmit(onPasswordSubmit),
        onCancel: cancelModal,
        loading: state.loading,
        error: state.error,
      })
    } else if (currentCredsType === 'username') {
      openModal('update-username', {
        usernameControl: usernameForm.control,
        usernameIsValid: usernameForm.formState.isValid,
        usernameHandleSubmit: usernameForm.handleSubmit(onUsernameSubmit),
        onCancel: cancelModal,
        loading: state.loading,
        error: state.error,
      })
    }
  }, [state.phase, state.loading, state.error, currentCredsType, currentUsername, openModal, onPasswordSubmit, onUsernameSubmit, passwordForm, usernameForm, cancelModal])

  // --------------------------------------------------------------------------
  // Return
  // --------------------------------------------------------------------------

  return {
    state,
    passwordForm: {
      control: passwordForm.control,
      isValid: passwordForm.formState.isValid,
      handleSubmit: passwordForm.handleSubmit(onPasswordSubmit),
    },
    usernameForm: {
      control: usernameForm.control,
      isValid: usernameForm.formState.isValid,
      handleSubmit: usernameForm.handleSubmit(onUsernameSubmit),
    },
    handlers: {
      initiatePasswordChange,
      initiateUsernameChange,
      cancelModal,
    },
  }
}
