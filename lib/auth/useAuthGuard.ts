import { useRouter, useSegments } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AUTH_CONFIG } from '../routing/route-config';
import { AuthStateManager } from '../auth-state';

type AuthState = 'loading' | 'authenticated' | 'unauthenticated';

export function useAuthGuard(bootstrapReady: boolean): AuthState {
  const router = useRouter();
  const segments = useSegments();
  const [authState, setAuthState] = useState<AuthState>('loading');
  const hasRedirectedRef = useRef(false);

  const firstSegment = typeof segments[0] === 'string' ? (segments[0] as string) : '';
  const isProtectedRoute = AUTH_CONFIG.protectedRoutes.includes(firstSegment as any);

  // Reset redirect flag when route changes
  useEffect(() => {
    hasRedirectedRef.current = false;
  }, [firstSegment]);

  // Core auth check gated by bootstrap readiness (passed from parent)
  useEffect(() => {
    if (!bootstrapReady) return;

    let mounted = true;
    const check = async () => {
      try {
        const authenticated = await AuthStateManager.isAuthenticated();

        if (mounted) {
          if (isProtectedRoute && !authenticated && !hasRedirectedRef.current) {
            hasRedirectedRef.current = true;
            router.replace(AUTH_CONFIG.redirectOnUnauthenticated);
            setAuthState('unauthenticated');
            return;
          }
          setAuthState(authenticated ? 'authenticated' : 'unauthenticated');
        }
      } catch {
        if (mounted) {
          if (isProtectedRoute && !hasRedirectedRef.current) {
            hasRedirectedRef.current = true;
            router.replace(AUTH_CONFIG.redirectOnUnauthenticated);
          }
          setAuthState('unauthenticated');
        }
      }
    };

    check();
    return () => {
      mounted = false;
    };
  }, [bootstrapReady, isProtectedRoute, router, segments]);

  // Subscribe to auth state changes to catch invalidation events
  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;

    const setup = async () => {
      try {
        const { supabase, isSupabaseConfigured } = await import('@/lib/database/supabase');
        if (!isSupabaseConfigured()) return;

        const {
          data: { subscription: sub },
        } = supabase.auth.onAuthStateChange(async () => {
          try {
            const authenticated = await AuthStateManager.isAuthenticated();
            const currentSegment = typeof segments[0] === 'string' ? segments[0] : '';
            const isCurrentlyProtected = AUTH_CONFIG.protectedRoutes.includes(currentSegment as any);
            
            if (isCurrentlyProtected && !authenticated && !hasRedirectedRef.current) {
              hasRedirectedRef.current = true;
              router.replace(AUTH_CONFIG.redirectOnUnauthenticated);
              setAuthState('unauthenticated');
              return;
            }
            setAuthState(authenticated ? 'authenticated' : 'unauthenticated');
          } catch {
            const currentSegment = typeof segments[0] === 'string' ? segments[0] : '';
            const isCurrentlyProtected = AUTH_CONFIG.protectedRoutes.includes(currentSegment as any);
            
            if (isCurrentlyProtected && !hasRedirectedRef.current) {
              hasRedirectedRef.current = true;
              router.replace(AUTH_CONFIG.redirectOnUnauthenticated);
            }
            setAuthState('unauthenticated');
          }
        });
        subscription = sub ?? null;
      } catch {
        // No-op if supabase cannot be loaded
      }
    };

    setup();
    return () => {
      subscription?.unsubscribe?.();
    };
  }, [router, segments]);

  return authState;
}
