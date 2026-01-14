import { useRouter, useSegments, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AUTH_CONFIG } from '../routing/route-config';
import { logger } from '../utils/logger';
import { AuthStateManager } from './auth-state';

export type AuthLevel = 'account-only' | 'world-required';
export type AuthState = 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthGuardOptions {
  forceVerification?: boolean; // Always check Supabase, ignore cache age
  // FUTURE: Add these when implementing role-based permissions (Phase 4d):
  // requiredRole?: 'owner' | 'dm' | 'player' | 'any';
  // requiredPermission?: 'read' | 'write';
}

// FUTURE: Add these when implementing role-based permissions (Phase 4d):
// export type AuthLevel = 'account-only' | 'world-required' | 'world-owner' | 'world-dm';

// Cache dynamic imports to prevent re-importing modules on every auth check
let supabaseCache: any = null;
let isSupabaseConfiguredCache: any = null;

export function useAuthGuard(
  bootstrapReady: boolean,
  level: AuthLevel = 'account-only',
  options?: AuthGuardOptions
): AuthState {
  const router = useRouter();
  const segments = useSegments();
  const params = useLocalSearchParams();
  const [authState, setAuthState] = useState<AuthState>('loading');
  const [subscriptionReady, setSubscriptionReady] = useState(false);
  const hasRedirectedRef = useRef(false);
  const subscriptionReadyRef = useRef(false); // Track if we've already set subscriptionReady
  
  // Create unique ID for this hook instance
  const [instanceId] = useState(() => Math.random().toString(36).slice(2, 9));

  const firstSegment = typeof segments[0] === 'string' ? (segments[0] as string) : '';
  const isProtectedRoute = AUTH_CONFIG.protectedRoutes.includes(firstSegment as any);

  // Reset redirect flag when route changes
  useEffect(() => {
    hasRedirectedRef.current = false;
  }, [firstSegment]);

  // Subscribe to auth state changes ONLY ONCE on mount
  // Only instanceId is in dependencies (stable due to useState)
  useEffect(() => {
    let subscription: { unsubscribe: () => void } | null = null;
    let mounted = true;

    logger.info('security', `[GUARD:${instanceId}] 🟢 Setting up auth state subscription`);

    const setup = async () => {
      try {
        // Use cached imports to avoid re-loading modules
        if (!supabaseCache) {
          const imported = await import('@/lib/database/supabase');
          supabaseCache = imported.supabase;
          isSupabaseConfiguredCache = imported.isSupabaseConfigured;
        }
        
        if (!isSupabaseConfiguredCache()) {
          logger.warn('security', `[GUARD:${instanceId}] ⚠️ Supabase not configured, skipping subscription`);
          setSubscriptionReady(true);
          return;
        }

        const {
          data: { subscription: sub },
        } = supabaseCache.auth.onAuthStateChange(async (event: string, session: any) => {
          if (!mounted) {
            logger.debug('security', `[GUARD:${instanceId}] 🔇 Subscription event received after unmount, ignoring`);
            return;
          }
          
          logger.debug('security', `[GUARD:${instanceId}] 🔔 onAuthStateChange: event=${event}, hasSession=${!!session}`);
          
          // CRITICAL: Mark subscription as ready once we get first event
          if (!subscriptionReadyRef.current) {
            subscriptionReadyRef.current = true;
            logger.info('security', `[GUARD:${instanceId}] ✅ Subscription ready with first event: ${event}`);
            setSubscriptionReady(true);
          }
          
          // CRITICAL: If we get a session event, sync it to local auth state immediately
          // This ensures isAuthenticated() will return true on next check
          if (session && (event === 'INITIAL_SESSION' || event === 'SIGNED_IN')) {
            logger.info('security', `[GUARD:${instanceId}] 🔄 Syncing Supabase session to local auth state`);
            await AuthStateManager.setHasAccount(true);
          }
          
          try {
            const authenticated = await AuthStateManager.isAuthenticated();
            logger.debug('security', `[GUARD:${instanceId}] ✓ Updated auth state to: ${authenticated ? 'authenticated' : 'unauthenticated'}`);
            setAuthState(authenticated ? 'authenticated' : 'unauthenticated');
          } catch (error) {
            logger.error('security', `[GUARD:${instanceId}] Error in auth state change handler:`, error);
            setAuthState('unauthenticated');
          }
        });
        subscription = sub ?? null;
        logger.info('security', `[GUARD:${instanceId}] 🔗 Subscription listener registered`);
      } catch (error) {
        logger.error('security', `[GUARD:${instanceId}] Error setting up auth subscription:`, error);
        setSubscriptionReady(true); // Allow fallback
      }
    };

    setup();
    return () => {
      mounted = false;
      if (subscription) {
        logger.info('security', `[GUARD:${instanceId}] 🔴 Cleaning up subscription`);
        subscription.unsubscribe();
      }
    };
  }, [instanceId]); // Only run once on mount

  // Core auth check ONLY runs on protected routes AFTER subscription is ready
  useEffect(() => {
    if (!bootstrapReady) return;
    
    // For protected routes, wait for subscription to establish before checking auth
    // This ensures session is synced to local storage
    if (isProtectedRoute && !subscriptionReady) {
      logger.debug('security', `[GUARD:${instanceId}] ⏳ Waiting for subscription to be ready before auth check on protected route`);
      return;
    }

logger.debug('security', `[GUARD:${instanceId}] 🚀 Starting core auth check, isProtectedRoute=${isProtectedRoute}, level=${level}, params.worldId=${params.worldId}`);

    let mounted = true;
    const check = async () => {
      try {
        const authenticated = await AuthStateManager.isAuthenticated();
        logger.debug('security', `[GUARD:${instanceId}] ✓ isAuthenticated returned: ${authenticated}`);

        if (mounted) {
          if (isProtectedRoute && !authenticated && !hasRedirectedRef.current) {
            hasRedirectedRef.current = true;
            logger.warn('security', `[GUARD:${instanceId}] ❌ Protected route but not authenticated, redirecting to login`);
            router.replace(AUTH_CONFIG.redirectOnUnauthenticated);
            setAuthState('unauthenticated');
            return;
          }

          // Step 2: If world-required level, verify world access
          if (level === 'world-required') {
            const worldId = typeof params.worldId === 'string' ? params.worldId : undefined;
            
            if (!worldId) {
              logger.warn('security', `[GUARD:${instanceId}] ❌ World-required level but no worldId in params, redirecting to select`);
              router.replace('/select/world-selection');
              setAuthState('unauthenticated');
              return;
            }
            
            logger.info('security', `[GUARD:${instanceId}] 🌍 World-required: verifying access to world ${worldId}`);
            
            // NEW: Check if this is a sensitive page that needs forced verification
            if (options?.forceVerification) {
              logger.info('security', `[GUARD:${instanceId}] 🔒 Sensitive page - forcing Supabase verification for world ${worldId}`);
              
              // Force Supabase check regardless of cache age
              const verification = await AuthStateManager.verifyWorldAccessWithDatabase(
                worldId,
                (reason: string) => {
                  logger.warn('security', `[GUARD:${instanceId}] Access denied on sensitive page:`, reason);
                  // Could show error modal/toast here
                  router.replace('/select/world-selection');
                },
                { forceFresh: true } // Pass option to skip cache age check
              );
              
              logger.info('security', `[GUARD:${instanceId}] 🔒 Force verification result: hasAccess=${verification.hasAccess}`);
              
              if (!verification.hasAccess) {
                if (mounted && !hasRedirectedRef.current) {
                  hasRedirectedRef.current = true;
                  router.replace('/select/world-selection');
                }
                setAuthState('unauthenticated');
                return;
              }
            } else {
              // Normal cache-first check (existing logic)
              logger.info('security', `[GUARD:${instanceId}] 🌍 Cache-first verification for world ${worldId}`);
              
              const verification = await AuthStateManager.verifyWorldAccessWithDatabase(
                worldId,
                (reason: string) => {
                  logger.warn('security', `[GUARD:${instanceId}] Access revoked:`, reason);
                  // Could show error modal/toast here
                  router.replace('/select/world-selection');
                }
              );
              
              logger.info('security', `[GUARD:${instanceId}] 🌍 Verification result: hasAccess=${verification.hasAccess}, fromCache=${verification.fromCache}`);
              
              if (!verification.hasAccess) {
                if (mounted && !hasRedirectedRef.current) {
                  hasRedirectedRef.current = true;
                  router.replace('/select/world-selection');
                }
                setAuthState('unauthenticated');
                return;
              }
            }
          }

          // FUTURE: Add role-based checks here when implementing DM/Player permissions (Phase 4d)
          // if (level === 'world-owner' || level === 'world-dm') {
          //   const userRole = await getUserRole(); // from AppParamsVolatileContext
          //   const worldPermissions = await getWorldPermissions(worldId);
          //   
          //   if (level === 'world-owner' && userRole !== 'owner') {
          //     logger.warn('security', `[GUARD:${instanceId}] Owner access required but user role=${userRole}`);
          //     router.replace('/select/world-selection');
          //     setAuthState('unauthenticated');
          //     return;
          //   }
          //   
          //   if (level === 'world-dm' && !['owner', 'dm'].includes(userRole)) {
          //     logger.warn('security', `[GUARD:${instanceId}] DM access required but user role=${userRole}`);
          //     router.replace('/select/world-selection');
          //     setAuthState('unauthenticated');
          //     return;
          //   }
          // }

          // FUTURE: Add permission checks here when implementing read/write controls (Phase 4d)
          // if (options?.requiredPermission === 'write') {
          //   const permissions = await getWorldPermissions(worldId); // { read: boolean, write: boolean }
          //   if (!permissions.write) {
          //     logger.warn('security', `[GUARD:${instanceId}] Write permission required but user has read-only`);
          //     router.replace('/select/world-selection');
          //     setAuthState('unauthenticated');
          //     return;
          //   }
          // }

          setAuthState(authenticated ? 'authenticated' : 'unauthenticated');
        }
      } catch (error) {
        logger.error('security', `[GUARD:${instanceId}] Error in auth check:`, error);
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
  }, [bootstrapReady, isProtectedRoute, subscriptionReady, router, instanceId, level, params.worldId, options?.forceVerification]);

  return authState;
}
