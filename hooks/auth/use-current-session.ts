/**
 * useCurrentSession
 *
 * Returns the current auth session (one-shot async fetch on mount).
 * Use when a screen needs to guard itself or read session info without
 * subscribing to ongoing auth state changes.
 *
 * For ongoing subscription, use useAuthStateListener instead.
 */

import {
    AuthStateManager,
    getCurrentSession,
    isEmailConfirmed,
    restoreSession,
    type Session,
} from "@/lib/auth";
import { useEffect, useRef, useState } from "react";

export interface CurrentSessionState {
  session: Session | null;
  loading: boolean;
  isConfirmed: boolean;
}

export function useCurrentSession(): CurrentSessionState {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (fetchedRef.current) return;
    fetchedRef.current = true;

    getCurrentSession()
      .then((s) => setSession(s))
      .catch(() => setSession(null))
      .finally(() => setLoading(false));
  }, []);

  return { session, loading, isConfirmed: isEmailConfirmed(session) };
}

/**
 * Imperative helper — returns current session without React state.
 * Useful for non-hook contexts inside callbacks.
 */
export { AuthStateManager, getCurrentSession, isEmailConfirmed, restoreSession };

