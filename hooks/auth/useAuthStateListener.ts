import {
  getCurrentSession,
  listenToAuthStateChanges,
  mapAuthErrorToCode,
  resendConfirmationEmail,
} from "@/lib/auth";

import type { Session } from "@/lib/auth";

import { type AuthErrorCode } from "@/maps/ERROR_CODES";
import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Subscribe to auth state changes with convenience actions and error tracking.
 *
 * Manages subscription lifecycle automatically (subscribe on mount, unsubscribe on unmount).
 * Uses a ref for the callback so changing the callback function never re-subscribes.
 *
 * Includes debouncing to prevent UI flicker during rapid auth events (e.g., token refresh).
 * Exposes convenience actions (signOut, resendConfirmation) wired to auth-operations layer.
 * Normalizes errors to AuthErrorCode for UI branching.
 *
 * @param callback - Called on every session change (login, logout, token refresh)
 * @returns Object with:
 *   - session: null = logged out, Session = logged in, undefined = not yet resolved
 *   - isLoading: true until the first auth state update is received
 *   - errorCode: Last error normalized to AuthErrorCode, or null on success
 *   - getCurrentSession(): Promise<Session | null> - Read current session immediately
 *   - resendConfirmation(email): Promise - Resend confirmation email
 *   - fetchSessionOnce(): Promise<Session | null> - One-shot session read
 *
 * Note: Sign-out has moved to useSignOutFlow, which manages the full phase-based
 * flow including sync, modal confirmation, and navigation.
 *
 * @example
 * // Observe session and handle sign-out:
 * const { session, isLoading, signOut } = useAuthStateListener();
 * 
 * return (
 *   <button
 *     disabled={isLoading}
 *     onPress={async () => {
 *       const result = await signOut();
 *       if (result.success) navigate.replace('/login/sign-in');
 *     }}
 *   >
 *     Sign Out
 *   </button>
 * );
 *
 * @example
 * // Redirect after email confirmation:
 * useAuthStateListener(async (session) => {
 *   if (session?.email === userEmail) navigate.replace('/login/sign-in');
 * });
 */
export function useAuthStateListener(
  callback?: (session: Session | null) => void,
) {
  const [session, setSession] = useState<Session | null | undefined>(undefined);
  const [errorCode, setErrorCode] = useState<AuthErrorCode | null>(null);

  // Store callback in a ref so the subscription never restarts when callback changes
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  // Debounce timer for rapid auth events (prevents UI flicker)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Convenience action: Get current session immediately
  const getCurrentSessionNow = useCallback(async () => {
    return await getCurrentSession();
  }, []);

  // Convenience action: Resend confirmation email (with error mapping)
  const resendConfirmation = useCallback(async (email: string) => {
    const result = await resendConfirmationEmail(email);
    if (!result.success && result.error) {
      setErrorCode(mapAuthErrorToCode(new Error(result.error)));
    } else {
      setErrorCode(null);
    }
    return result;
  }, []);

  // One-shot read helper: Fetch session without subscription
  const fetchSessionOnce = useCallback(async () => {
    return await getCurrentSession();
  }, []);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    unsubscribe = listenToAuthStateChanges((s) => {
      // Debounce state updates to prevent UI flicker on rapid auth events (token refresh, etc.)
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      debounceTimerRef.current = setTimeout(() => {
        setSession(s);
        callbackRef.current?.(s);
        setErrorCode(null); // Clear error on successful state update
      }, 100); // 100ms debounce window
    });

    return () => {
      unsubscribe?.();
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []); // Empty deps: subscribe once on mount, use ref for callback updates

  return {
    session,
    isLoading: session === undefined, // undefined = first update not yet received
    errorCode,
    // Convenience actions wired to auth-operations layer
    getCurrentSession: getCurrentSessionNow,
    resendConfirmation,
    fetchSessionOnce,
  };
}
