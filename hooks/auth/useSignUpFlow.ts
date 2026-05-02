/**
 * useSignUpFlow
 *
 * Unified state machine hook for account creation flows:
 *
 *   'signup' mode:
 *     Submit email + password → Supabase creates account → navigate to email
 *     confirmation screen. If email already exists, opens 'email-exists' modal.
 *
 *   'complete-profile' mode:
 *     Submit username → create user profile in DB → check pending invites →
 *     navigate to world-selection (or auth-redirect if invite pending).
 *
 * Usage:
 *   // Sign-up screen
 *   const { state, form } = useSignUpFlow()
 *   // state.modal === 'email-exists' → show EmailExistsModal
 *   // form.handleSubmit → "Create Account" button
 *
 *   // Complete-profile screen (user object comes from session check in the screen)
 *   const { state, form } = useSignUpFlow('complete-profile', user)
 */

import { useNavigation } from "@/hooks/navigation"
import {
    signUpUser,
} from '@/lib/auth'
import { StorageManager } from '@/lib/storage'
import { logger } from '@/lib/utils'
import { STORAGE_KEYS } from '@/maps/storage-keys'
import {
    completeProfileSchema,
    getPasswordRequirementsForUI,
    signUpSchema,
    type CompleteProfileFormData,
    type SignUpFormData,
} from '@/validation'
import { zodResolver } from '@hookform/resolvers/zod'
import { useCallback, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'

// ============================================================================
// TYPES
// ============================================================================

export type SignUpFlowMode = 'signup' | 'complete-profile'

export type SignUpFlowPhase =
  | 'idle'       // Form is interactive
  | 'submitting' // Request in flight
  | 'success'    // Done, navigation triggered
  | 'error'      // Failed, error shown

export type SignUpModal = 'none' | 'email-exists'

export interface SignUpFlowState {
  phase: SignUpFlowPhase
  modal: SignUpModal
  loading: boolean
  error: string | null
}

// ============================================================================
// CONSTANTS
// ============================================================================

const INITIAL_STATE: SignUpFlowState = {
  phase: 'idle',
  modal: 'none',
  loading: false,
  error: null,
}

// ============================================================================
// HOOKS (overloads for typed form return)
// ============================================================================

export function useSignUpFlow(mode: 'complete-profile', user: any): {
  state: SignUpFlowState
  form: {
    control: ReturnType<typeof useForm<CompleteProfileFormData>>['control']
    isValid: boolean
    username: string
    handleSubmit: () => void
    getUsernameDisplayText: () => string
  }
  handlers: { dismissModal: () => void }
}

export function useSignUpFlow(mode?: 'signup'): {
  state: SignUpFlowState
  form: {
    control: ReturnType<typeof useForm<SignUpFormData>>['control']
    isValid: boolean
    email: string
    password: string
    confirmPassword: string
    showPassword: boolean
    setShowPassword: (v: boolean) => void
    passwordsMatch: boolean
    handleSubmit: () => void
    getPasswordRequirementsText: () => string
    getPasswordMatchText: () => string
  }
  handlers: { dismissModal: () => void }
}

export function useSignUpFlow(mode: SignUpFlowMode = 'signup', user?: any): {
  state: SignUpFlowState
  form: any
  handlers: { dismissModal: () => void }
} {
  const [state, setState] = useState<SignUpFlowState>(INITIAL_STATE)
  const [showPassword, setShowPassword] = useState(false)
  const navigate = useNavigation()
  // useNavigation() returns a new object literal each render; including it in
  // useCallback deps would recreate every callback on every render.
  const navigateRef = useRef(navigate)
  navigateRef.current = navigate

  const patch = useCallback((partial: Partial<SignUpFlowState>) => {
    setState(prev => ({ ...prev, ...partial }))
  }, [])

  // --------------------------------------------------------------------------
  // Form — schema depends on mode
  // --------------------------------------------------------------------------

  const signUpForm = useForm<SignUpFormData>({
    resolver: zodResolver(signUpSchema),
    mode: 'onChange',
    defaultValues: { email: '', password: '', confirmPassword: '' },
  })

  const completeProfileForm = useForm<CompleteProfileFormData>({
    resolver: zodResolver(completeProfileSchema),
    mode: 'onChange',
    defaultValues: { username: '' },
  })

  // activeForm is unused — each mode returns its own form properties directly below

  // --------------------------------------------------------------------------
  // Submit — 'signup' path
  // --------------------------------------------------------------------------

  const onSignUpSubmit = useCallback(async (data: SignUpFormData) => {
    patch({ phase: 'submitting', loading: true, error: null })

    try {
      const result = await signUpUser(data.email, data.password)

      if (result.success && result.redirectTo) {
        // Mark that profile needs to be completed
        await StorageManager.set(STORAGE_KEYS.PROFILE_COMPLETED, false)
        patch({ phase: 'success', loading: false })
        //THISMIGHTBEWRONG
        navigateRef.current.resetTo(result.redirectTo)
        return
      }

      if (result.showEmailExistsModal) {
        patch({ phase: 'idle', loading: false, modal: 'email-exists' })
        return
      }

      patch({ phase: 'error', loading: false, error: result.error ?? 'Account creation failed. Please try again.' })
    } catch (error) {
      logger.category('auth').error('Sign-up error:', error)
      patch({ phase: 'error', loading: false, error: 'An unexpected error occurred. Please try again.' })
    }
  }, [patch])

  // --------------------------------------------------------------------------
  // Submit — 'complete-profile' path
  // --------------------------------------------------------------------------

  const onCompleteProfileSubmit = useCallback(async (data: CompleteProfileFormData) => {
    if (!user) {
      patch({ phase: 'error', loading: false, error: 'Authentication error. Please try signing in again.' })
      return
    }

    patch({ phase: 'submitting', loading: true, error: null })

    try {
      const { usersDB } = await import('@/lib')

      const newProfile = await usersDB.create({
        auth_id: user.id,
        username: data.username.trim(),
      })

      logger.category('auth').info('Profile created:', { id: newProfile.id, username: newProfile.username })

      // Mark profile as complete and redirect to world selection
      // Pending invites will be handled by the world-selection screen
      await StorageManager.set(STORAGE_KEYS.PROFILE_COMPLETED, true)
      patch({ phase: 'success', loading: false })
      navigateRef.current.resetTo('world-selection')
    } catch (error: any) {
      logger.category('auth').error('Profile creation error:', error)

      if (error.message?.includes('duplicate') || error.code === '23505') {
        patch({ phase: 'error', loading: false, error: 'Username already taken. Please choose another.' })
      } else {
        patch({ phase: 'error', loading: false, error: 'Failed to create profile. Please try again.' })
      }
    }
  }, [user, patch])

  // --------------------------------------------------------------------------
  // Handlers
  // --------------------------------------------------------------------------

  const dismissModal = useCallback(() => {
    patch({ modal: 'none' })
  }, [patch])

  // --------------------------------------------------------------------------
  // Return — signup mode
  // --------------------------------------------------------------------------

  if (mode === 'signup') {
    const password = signUpForm.watch('password') ?? ''
    const confirmPassword = signUpForm.watch('confirmPassword') ?? ''
    const email = signUpForm.watch('email') ?? ''
    const passwordsMatch = password === confirmPassword

    return {
      state,
      form: {
        control: signUpForm.control,
        isValid: signUpForm.formState.isValid,
        email,
        password,
        confirmPassword,
        showPassword,
        setShowPassword,
        passwordsMatch,
        handleSubmit: signUpForm.handleSubmit(onSignUpSubmit),
        getPasswordRequirementsText: () => getPasswordRequirementsForUI(password),
        getPasswordMatchText: () => {
          if (!confirmPassword) return ''
          return passwordsMatch ? '✅ Passwords match!' : '❌ Passwords do not match'
        },
      },
      handlers: { dismissModal },
    }
  }

  // --------------------------------------------------------------------------
  // Return — complete-profile mode
  // --------------------------------------------------------------------------

  const username = completeProfileForm.watch('username') ?? ''

  return {
    state,
    form: {
      control: completeProfileForm.control,
      isValid: completeProfileForm.formState.isValid,
      username,
      handleSubmit: completeProfileForm.handleSubmit(onCompleteProfileSubmit),
      getUsernameDisplayText: () => {
        if (!username || username.length === 0) return ''
        return username.length >= 3 && username.length <= 20
          ? `Welcome "${username}"!`
          : 'Username: 3-20 characters, letters and numbers only'
      },
    },
    handlers: { dismissModal },
  }
}
