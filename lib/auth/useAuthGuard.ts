import { useRouter, useSegments } from 'expo-router';
import { useEffect, useState } from 'react';
import { AUTH_CONFIG } from '../routing/route-config';
import { AuthStateManager } from '../auth-state';
import { useAppBootstrap } from '@/hooks/use-app-bootstrap';

type AuthState = 'loading' | 'authenticated' | 'unauthenticated';

export function useAuthGuard(): AuthState {
  const router = useRouter();
  const segments = useSegments();
  const bootstrap = useAppBootstrap();
  const [authState, setAuthState] = useState<AuthState>('loading');

  const firstSegment = typeof segments[0] === 'string' ? (segments[0] as string) : '';
  const isProtectedRoute = AUTH_CONFIG.protectedRoutes.includes(firstSegment as any);
  const isPublicRoute = AUTH_CONFIG.publicRoutes.includes(firstSegment as any);

  // Core auth check gated by bootstrap readiness
  useEffect(() => {
    if (!bootstrap.isReady) return;

    let mounted = true;
    const check = async () => {
      try {
        const authenticated = await AuthStateManager.isAuthenticated();

        if (mounted) {
          if (isProtectedRoute && !authenticated) {
            router.replace(AUTH_CONFIG.redirectOnUnauthenticated);
            setAuthState('unauthenticated');
            return;
          }
          setAuthState(authenticated ? 'authenticated' : 'unauthenticated');
        }
      } catch {
        if (mounted) {
          if (isProtectedRoute) {
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
  }, [bootstrap.isReady, firstSegment, isProtectedRoute, router]);

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
            if (isProtectedRoute && !authenticated) {
              router.replace(AUTH_CONFIG.redirectOnUnauthenticated);
              setAuthState('unauthenticated');
              return;
            }
            setAuthState(authenticated ? 'authenticated' : 'unauthenticated');
          } catch {
            if (isProtectedRoute) {
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
    // Depend only on route segment to avoid re-subscribing excessively
  }, [firstSegment, isProtectedRoute, router]);

  // Never block public routes; return unauthenticated state for awareness
  if (isPublicRoute && authState === 'loading' && bootstrap.isReady) {
    return 'unauthenticated';
  }

  return authState;
}
