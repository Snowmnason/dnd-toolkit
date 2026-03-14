/**
 * useAuthFlow
 *
 * Unified state machine hook for all sign-in paths:
 *   - Email + password sign-in (sign-in screen and confirm-signin/re-auth screen)
 *   - Google OAuth (web redirect + mobile deep-link)
 *   - Apple OAuth (iOS native + web)
 *
 * All auth operations are routed through auth-manager or the auth lib layer.
 * Navigation is handled internally — success navigates to the redirect returned
 * by the auth system, or (for social flows) to the appropriate post-auth route.
 *
 * Usage:
 *   // Email + password sign-in screen
 *   const { state, form, google, apple } = useAuthFlow()
 *   // state.phase — controls button disabled / loading indicator
 *   // state.error  — display under the form
 *   // form.control — wire into react-hook-form <Controller />
 *   // form.handleSubmit — call from the "Sign In" button
 *
 *   // Google sign-in button component (own isolated instance)
 *   const { google, state } = useAuthFlow()
 *   google.web(authRequestResponse)   // web ID-token flow
 *   google.mobile()                    // mobile OAuth deep-link
 *
 *   // Apple sign-in button component (own isolated instance)
 *   const { apple, state } = useAuthFlow()
 *   apple.ios()                        // iOS native
 *   apple.web(appleAuthRequestResponse)
 */

import {
    signInUser,
    signInWithIdToken,
    signInWithOAuth,
} from '@/lib/auth'
import { logger } from '@/lib/utils'
import { zodResolver } from '@hookform/resolvers/zod'
import { useRouter } from 'expo-router'
import * as WebBrowser from 'expo-web-browser'
import { useCallback, useState } from 'react'
import { useForm } from 'react-hook-form'
import { signInSchema, type SignInFormData } from '../../validation/auth.schema'

// ============================================================================
// TYPES
// ============================================================================

export type AuthFlowPhase =
  | 'idle'           // Default — form is interactive
  | 'authenticating' // Auth request in flight — disable form + buttons
  | 'success'        // Done, navigation triggered
  | 'error'          // Auth failed, error shown to user

export interface AuthFlowState {
  phase: AuthFlowPhase
  /** True while any async operation is running. Use to disable buttons. */
  loading: boolean
  /** Error message to display below the form, or null. */
  error: string | null
}

export interface AuthFlowForm {
  /** react-hook-form control — pass to <Controller> */
  control: ReturnType<typeof useForm<SignInFormData>>['control']
  /** true when the form is valid per Zod schema */
  isValid: boolean
  /** current email field value */
  email: string
  /** toggle password visibility */
  showPassword: boolean
  setShowPassword: (v: boolean) => void
  /** call from the "Sign In" button — triggers validation + submit */
  handleSubmit: () => void
}

export interface AuthFlowGoogleHandlers {
  /** Google web ID-token auth: pass the authRequestResponse from expo-auth-session */
  web: (authRequestResponse: any) => Promise<void>
  /** Google mobile deep-link auth: opens browser, handles redirect */
  mobile: () => Promise<void>
  /** Google web error callback */
  webError: () => void
}

export interface AuthFlowAppleHandlers {
  /** Apple iOS native auth */
  ios: () => Promise<void>
  /** Apple web ID-token auth: pass appleAuthRequestResponse */
  web: (appleAuthRequestResponse: any) => Promise<void>
  /** Apple web error callback */
  webError: (error: any) => void
}

// ============================================================================
// CONSTANTS
// ============================================================================

const INITIAL_STATE: AuthFlowState = {
  phase: 'idle',
  loading: false,
  error: null,
}

// ============================================================================
// POST-AUTH NAVIGATION (social flows where manager doesn't return redirect)
// ============================================================================

async function navigateAfterSocialAuth(router: ReturnType<typeof useRouter>) {
  const { usersDB } = await import('@/lib')
  try {
    const userProfile = await usersDB.getCurrentUser()
    if (userProfile?.username) {
      router.replace('/select/world-selection')
    } else {
      router.replace('/login/sign-up')
    }
  } catch {
    router.replace('/login/sign-up')
  }
}

// ============================================================================
// HOOK
// ============================================================================

export function useAuthFlow(): {
  state: AuthFlowState
  form: AuthFlowForm
  google: AuthFlowGoogleHandlers
  apple: AuthFlowAppleHandlers
} {
  const [state, setState] = useState<AuthFlowState>(INITIAL_STATE)
  const [showPassword, setShowPassword] = useState(false)
  const router = useRouter()

  const { control, handleSubmit, formState: { isValid }, watch } = useForm<SignInFormData>({
    resolver: zodResolver(signInSchema),
    mode: 'onChange',
    defaultValues: { email: '', password: '' },
  })

  const email = watch('email') ?? ''

  const patch = useCallback((partial: Partial<AuthFlowState>) => {
    setState(prev => ({ ...prev, ...partial }))
  }, [])

  // --------------------------------------------------------------------------
  // Email + password sign-in
  // --------------------------------------------------------------------------

  const onFormSubmit = useCallback(async (data: SignInFormData) => {
    patch({ phase: 'authenticating', loading: true, error: null })

    const result = await signInUser(data.email, data.password)

    if (!result.success) {
      patch({ phase: 'error', loading: false, error: result.error ?? 'Sign in failed. Please try again.' })
      return
    }

    patch({ phase: 'success', loading: false, error: null })
    if (result.redirectTo) {
      router.replace(result.redirectTo as any)
    }
  }, [patch, router])

  // --------------------------------------------------------------------------
  // Social: Google
  // --------------------------------------------------------------------------

  const handleGoogleWeb = useCallback(async (authRequestResponse: any) => {
    if (!authRequestResponse?.clientId && !authRequestResponse?.credential) return

    patch({ phase: 'authenticating', loading: true, error: null })

    try {
      const result = await signInWithIdToken('google', authRequestResponse.credential)

      if (!result.success) {
        logger.category('auth').error('Google web sign-in failed:', result.error?.message)
        patch({ phase: 'error', loading: false, error: result.error?.message ?? 'Google sign-in failed.' })
        return
      }

      patch({ phase: 'success', loading: false, error: null })
      await navigateAfterSocialAuth(router)
    } catch (error) {
      logger.category('auth').error('Google web auth error:', error)
      patch({ phase: 'error', loading: false, error: 'An unexpected error occurred during Google sign-in.' })
    }
  }, [patch, router])

  const handleGoogleMobile = useCallback(async () => {
    patch({ phase: 'authenticating', loading: true, error: null })

    try {
      const extractParamsFromUrl = (url: string) => {
        const parsedUrl = new URL(url)
        const hash = parsedUrl.hash.substring(1)
        const params = new URLSearchParams(hash)
        return {
          access_token: params.get('access_token'),
          refresh_token: params.get('refresh_token'),
        }
      }

      const oauthResult = await signInWithOAuth('google', {
        redirectTo: 'dnd-toolkit://google-auth',
        queryParams: { prompt: 'consent' },
        skipBrowserRedirect: true,
      })

      if (!oauthResult.url) {
        logger.category('auth').error('No OAuth URL returned for Google mobile')
        patch({ phase: 'error', loading: false, error: 'Failed to initialize Google sign-in.' })
        return
      }

      const browserResult = await WebBrowser.openAuthSessionAsync(
        oauthResult.url,
        'dnd-toolkit://google-auth',
        { showInRecents: true },
      )

      if (browserResult?.type === 'success') {
        const params = extractParamsFromUrl(browserResult.url)

        if (!params.access_token || !params.refresh_token) {
          patch({ phase: 'error', loading: false, error: 'Failed to retrieve authentication tokens.' })
          return
        }

        const { performReAuth } = await import('@/lib/auth')
        const reAuthResult = await performReAuth(
          { access_token: params.access_token, refresh_token: params.refresh_token },
          'oauth',
        )

        if (!reAuthResult.success) {
          patch({ phase: 'error', loading: false, error: 'Session restoration failed. Please try again.' })
          return
        }

        patch({ phase: 'success', loading: false, error: null })
        if (reAuthResult.redirect) {
          router.replace(reAuthResult.redirect as any)
        } else {
          await navigateAfterSocialAuth(router)
        }
      } else if (browserResult?.type === 'cancel') {
        // User cancelled — silently return to idle
        patch(INITIAL_STATE)
      } else {
        patch({ phase: 'error', loading: false, error: 'Google sign-in was unsuccessful.' })
      }
    } catch (error) {
      logger.category('auth').error('Google mobile auth error:', error)
      patch({ phase: 'error', loading: false, error: 'An unexpected error occurred during Google sign-in.' })
    }
  }, [patch, router])

  const handleGoogleWebError = useCallback(() => {
    logger.category('auth').error('Google web auth error callback triggered')
    patch({ phase: 'error', loading: false, error: 'Google sign-in failed. Please try again.' })
  }, [patch])

  // --------------------------------------------------------------------------
  // Social: Apple
  // --------------------------------------------------------------------------

  const handleAppleIos = useCallback(async () => {
    patch({ phase: 'authenticating', loading: true, error: null })

    try {
      const AppleAuthentication = await import('expo-apple-authentication')
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      })

      if (!credential.identityToken) {
        patch({ phase: 'error', loading: false, error: 'Failed to get identity token from Apple.' })
        return
      }

      const result = await signInWithIdToken('apple', credential.identityToken)

      if (!result.success) {
        logger.category('auth').error('Apple iOS sign-in failed:', result.error?.message)
        patch({ phase: 'error', loading: false, error: result.error?.message ?? 'Apple sign-in failed.' })
        return
      }

      patch({ phase: 'success', loading: false, error: null })
      await navigateAfterSocialAuth(router)
    } catch (error: any) {
      if (error.code === 'ERR_REQUEST_CANCELED') {
        // User cancelled — silently return to idle
        patch(INITIAL_STATE)
        return
      }
      logger.category('auth').error('Apple iOS auth error:', error)
      patch({ phase: 'error', loading: false, error: 'Apple sign-in failed. Please try again.' })
    }
  }, [patch, router])

  const handleAppleWeb = useCallback(async (appleAuthRequestResponse: any) => {
    const idToken = appleAuthRequestResponse?.authorization?.id_token
    const code = appleAuthRequestResponse?.authorization?.code
    if (!idToken || !code) return

    patch({ phase: 'authenticating', loading: true, error: null })

    try {
      const result = await signInWithIdToken('apple', idToken, { access_token: code })

      if (!result.success) {
        logger.category('auth').error('Apple web sign-in failed:', result.error?.message)
        patch({ phase: 'error', loading: false, error: result.error?.message ?? 'Apple sign-in failed.' })
        return
      }

      patch({ phase: 'success', loading: false, error: null })
      await navigateAfterSocialAuth(router)
    } catch (error) {
      logger.category('auth').error('Apple web auth error:', error)
      patch({ phase: 'error', loading: false, error: 'An unexpected error occurred during Apple sign-in.' })
    }
  }, [patch, router])

  const handleAppleWebError = useCallback((error: any) => {
    logger.category('auth').error('Apple web auth error callback triggered:', error)
    patch({ phase: 'error', loading: false, error: 'Apple sign-in failed. Please try again.' })
  }, [patch])

  // --------------------------------------------------------------------------
  // Return
  // --------------------------------------------------------------------------

  return {
    state,
    form: {
      control,
      isValid,
      email,
      showPassword,
      setShowPassword,
      handleSubmit: handleSubmit(onFormSubmit),
    },
    google: {
      web: handleGoogleWeb,
      mobile: handleGoogleMobile,
      webError: handleGoogleWebError,
    },
    apple: {
      ios: handleAppleIos,
      web: handleAppleWeb,
      webError: handleAppleWebError,
    },
  }
}
