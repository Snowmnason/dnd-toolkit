/**
 * useCurrentSession
 *
 * Returns the current auth session (one-shot async fetch on mount).
 * Use when a screen needs to guard itself or read session info without
 * subscribing to ongoing auth state changes.
 *
 * For ongoing subscription, use useAuthStateListener instead.
 *
 * ⚠️ Waits for kernel bootstrap before fetching to ensure auth provider is initialized
 */

import { useAppKernel } from "@/hooks/kernel";
import { getCurrentSession, isEmailConfirmed, type Session } from "@/lib/auth";
import { useEffect, useRef, useState } from "react";

export interface CurrentSessionState {
  session: Session | null;
  loading: boolean;
  isConfirmed: boolean;
}

export function useCurrentSession(): CurrentSessionState {
  const kernel = useAppKernel();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const fetchedRef = useRef(false);

  useEffect(() => {
    // Wait for kernel to be ready before attempting to get session
    if (!kernel.phases.appReady) return;

    if (fetchedRef.current) return;
    fetchedRef.current = true;

    getCurrentSession()
      .then((s) => setSession(s))
      .catch(() => setSession(null))
      .finally(() => setLoading(false));
  }, [kernel.phases.appReady]);

  return { session, loading, isConfirmed: isEmailConfirmed(session) };
}

