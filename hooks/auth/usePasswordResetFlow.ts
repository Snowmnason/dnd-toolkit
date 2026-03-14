/**
 * usePasswordResetFlow
 *
 * Manages the password-reset confirmation flow for users arriving from
 * a "Reset Password" email link (Supabase sends tokens in URL params).
 *
 * Phases:
 *   'loading'    — On mount: extract URL tokens, restore session, get user email.
 *   'idle'       — Session established; form is interactive.
 *   'submitting' — Password update request in flight.
 *   'success'    — Password changed; auto-redirects to sign-in after a short delay.
 *   'error'      — Session restore or password update failed.
 *
 * TODO: Supabase may not reliably provide a redirect link back to this screen
 *   after the reset email is sent. Consider storing a STORAGE_KEYS.PENDING_PASSWORD_RESET
 *   flag when the user requests the reset, then clearing it here on arrival.
 *
 * Usage:
 *   const { state, form } = usePasswordResetFlow()
 *   // While state.phase === 'loading', show a spinner
 *   // state.email — display the user's email as context ("Resetting for you@...")
 *   // form.handleSubmit — "Update Password" button
 */

import {
    getUser,
    restoreSession,
    updatePassword,
} from '@/lib/auth'
import { logger } from '@/lib/utils'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'expo-router'
import { useCallback, useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Platform } from 'react-native'
import { resetPasswordSchema, type ResetPasswordFormData } from '../../validation/auth.schema'

// ============================================================================
// TYPES
// ============================================================================

export type PasswordResetPhase =
  | 'loading'    // Extracting tokens, restoring session
  | 'idle'       // Session ready, form interactive
  | 'submitting' // Update request in flight
  | 'success'    // Done, auto-redirect pending
  | 'error'      // Something failed

export interface PasswordResetState {
  phase: PasswordResetPhase
  loading: boolean
  error: string | null
  /** Confirmed email address shown to the user for context. */
  userEmail: string
  /** Success message to display (before auto-redirect). */
  successMessage: string | null
}

// ============================================================================
// CONSTANTS
// ============================================================================

const INITIAL_STATE: PasswordResetState = {
  phase: 'loading',
  loading: true,
  error: null,
  userEmail: '',
  successMessage: null,
}

/** Delay (ms) from success message to automatic sign-in redirect. */
const REDIRECT_DELAY_MS = 3000

// ============================================================================
// HOOK
// ============================================================================

export function usePasswordResetFlow(): {
  state: PasswordResetState
  form: {
    control: ReturnType<typeof useForm<ResetPasswordFormData>>['control']
    isValid: boolean
    password: string
    confirmPassword: string
    showPassword: boolean
    setShowPassword: (v: boolean) => void
    doPasswordsMatch: boolean
    handleSubmit: () => void
  }
  handlers: { goToSignIn: () => void }
} {
  const [state, setState] = useState<PasswordResetState>(INITIAL_STATE)
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()

  const { control, handleSubmit, formState: { isValid }, watch, reset } = useForm<ResetPasswordFormData>({
    resolver: zodResolver(resetPasswordSchema),
    mode: 'onChange',
    defaultValues: { password: '', confirmPassword: '' },
  })

  const password = watch('password') ?? ''
  const confirmPassword = watch('confirmPassword') ?? ''
  const doPasswordsMatch = password === confirmPassword && confirmPassword.length > 0

  const patch = useCallback((partial: Partial<PasswordResetState>) => {
    setState(prev => ({ ...prev, ...partial }))
  }, [])

  // --------------------------------------------------------------------------
  // On mount: restore session from URL tokens (web) or existing session
  // --------------------------------------------------------------------------

  useEffect(() => {
    const initialize = async () => {
      try {
        if (Platform.OS === 'web') {
          const urlParams = new URLSearchParams(window.location.search)
          const accessToken = urlParams.get('access_token')
          const refreshToken = urlParams.get('refresh_token')

          if (accessToken && refreshToken) {
            const restored = await restoreSession({ access_token: accessToken, refresh_token: refreshToken })

            if (!restored) {
              logger.category('auth').error('Failed to restore session from reset link')
              patch({
                phase: 'error',
                loading: false,
                error: 'Invalid or expired reset link. Please request a new password reset.',
              })
              return
            }
          }
        }

        // Session is now active — fetch user email for display
        const user = await getUser()
        patch({
          phase: 'idle',
          loading: false,
          userEmail: user?.email ?? '',
        })
      } catch (error) {
        logger.category('auth').error('Password reset initialization error:', error)
        patch({
          phase: 'error',
          loading: false,
          error: 'Failed to verify reset token. Please try again.',
        })
      }
    }

    initialize()
    // Run once on mount only
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // --------------------------------------------------------------------------
  // Submit
  // --------------------------------------------------------------------------

  const onSubmit = useCallback(async (values: ResetPasswordFormData) => {
    patch({ phase: 'submitting', loading: true, error: null, successMessage: null })

    const result = await updatePassword(values.password)

    if (!result.success) {
      patch({ phase: 'error', loading: false, error: result.error ?? 'Failed to update password. Please try again.' })
      return
    }

    reset({ password: '', confirmPassword: '' })
    patch({
      phase: 'success',
      loading: false,
      successMessage: result.message ?? 'Password updated successfully.',
    })

    setTimeout(() => {
      router.replace('/login/sign-in')
    }, REDIRECT_DELAY_MS)
  }, [patch, reset, router])

  // --------------------------------------------------------------------------
  // Return
  // --------------------------------------------------------------------------

  return {
    state,
    form: {
      control,
      isValid,
      password,
      confirmPassword,
      showPassword,
      setShowPassword,
      doPasswordsMatch,
      handleSubmit: handleSubmit(onSubmit),
    },
    handlers: {
      goToSignIn: () => router.replace('/login/sign-in'),
    },
  }
}
