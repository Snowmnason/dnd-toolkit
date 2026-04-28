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
import { getCurrentSession, type Session } from "@/lib/auth";
import { useEffect, useRef, useState } from "react";

export interface UseCurrentSessionResult {
  sessionSnapshot: Session | null;
  isReady: boolean;         // true when kernel ready AND session query resolved
  isAuthenticated: boolean; // derived: sessionSnapshot !== null
}

export function useCurrentSession(): UseCurrentSessionResult {
  const kernel = useAppKernel();
  const [sessionSnapshot, setSessionSnapshot] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    // Wait for kernel to be ready before attempting to get session
    if (!kernel.phases.appReady) return;

    if (fetchedRef.current) return;
    fetchedRef.current = true;

    getCurrentSession()
      .then((s) => setSessionSnapshot(s))
      .catch(() => setSessionSnapshot(null))
      .finally(() => setSessionLoaded(true));
  }, [kernel.phases.appReady]);

  const isReady = kernel.phases.appReady && sessionLoaded;
  return {
    sessionSnapshot,
    isReady,
    isAuthenticated: sessionSnapshot !== null,
  };
}

