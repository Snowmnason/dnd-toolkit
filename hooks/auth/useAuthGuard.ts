import { AuthStateManager } from '@/lib/auth';
import { logger } from '@/lib/utils';
import { useLocalSearchParams, useRouter, useSegments } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AUTH_CONFIG } from '../../lib/routing/route-config';
import { useAppKernel } from '../kernel/use-app-kernel';

export type AuthLevel = 'account-only' | 'world-required';
export type AuthGuardState = 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthGuardOptions {
  forceVerification?: boolean; // Always check Supabase, ignore cache age
}

/**
 * Auth guard hook using injected provider abstraction
 * Protects routes based on authentication level
 */
export function useAuthGuard(
  bootstrapReadyOrUndefined?: boolean,
  level: AuthLevel = 'account-only',
  options?: AuthGuardOptions
): AuthGuardState {
  const router = useRouter();
  const segments = useSegments();
  const params = useLocalSearchParams();
  const [authState, setAuthState] = useState<AuthGuardState>('loading');
  const [subscriptionReady, setSubscriptionReady] = useState(false);
  const hasRedirectedRef = useRef(false);
  const subscriptionReadyRef = useRef(false);
  
  // If bootstrapReadyOrUndefined is undefined, use kernel; otherwise use the provided value
  const kernel = useAppKernel();
  const appReady = bootstrapReadyOrUndefined !== undefined ? bootstrapReadyOrUndefined : kernel.phases.appReady;
  
  // Create unique ID for this hook instance
  const [instanceId] = useState(() => Math.random().toString(36).slice(2, 9));

  const firstSegment = typeof segments[0] === 'string' ? (segments[0] as string) : '';
  const isProtectedRoute = AUTH_CONFIG.protectedRoutes.includes(firstSegment as any);

  // Reset redirect flag when route changes
  useEffect(() => {
    hasRedirectedRef.current = false;
  }, [firstSegment]);

  /**
   * Subscribe to auth state changes from the provider
   * Only runs once on mount
   */
  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    let mounted = true;

    logger.category('security').info(`[GUARD:${instanceId}] 🟢 Setting up auth state subscription via provider`);

    const setup = async () => {
      try {
        const provider = AuthStateManager.getProvider();
        
        // Subscribe to provider's auth state changes
        unsubscribe = provider.onAuthStateChange(async (session) => {
          if (!mounted) {
            logger.category('security').debug(`[GUARD:${instanceId}] 🔇 Subscription event received after unmount, ignoring`);
            return;
          }
          
          logger.category('security').debug(`[GUARD:${instanceId}] 🔔 onAuthStateChange: hasSession=${!!session}`);
          
          // Mark subscription as ready once we get first event
          if (!subscriptionReadyRef.current) {
            subscriptionReadyRef.current = true;
            logger.category('security').info(`[GUARD:${instanceId}] ✅ Subscription ready`);
            setSubscriptionReady(true);
          }
          
          // Sync session to local auth state
          if (session) {
            logger.category('security').info(`[GUARD:${instanceId}] 🔄 Syncing session to local auth state`);
            await AuthStateManager.setHasAccount(true);
          }
          
          try {
            const authenticated = await AuthStateManager.isAuthenticated();
            logger.category('security').debug(`[GUARD:${instanceId}] ✓ Updated auth state to: ${authenticated ? 'authenticated' : 'unauthenticated'}`);
            setAuthState(authenticated ? 'authenticated' : 'unauthenticated');
          } catch (error) {
            logger.category('security').error(`[GUARD:${instanceId}] Error in auth state change handler:`, error);
            setAuthState('unauthenticated');
          }
        });
        
        logger.category('security').info(`[GUARD:${instanceId}] 🔗 Subscription listener registered`);
      } catch (error) {
        logger.category('security').error(`[GUARD:${instanceId}] Error setting up auth subscription:`, error);
        setSubscriptionReady(true); // Allow fallback
      }
    };

    setup();
    return () => {
      mounted = false;
      if (unsubscribe) {
        logger.category('security').info(`[GUARD:${instanceId}] 🔴 Cleaning up subscription`);
        unsubscribe();
      }
    };
  }, [instanceId]); // Only run once on mount

  /**
   * Core auth check - runs after subscription is ready and app is ready
   */
  useEffect(() => {
    if (!appReady) return;
    
    // For protected routes, wait for subscription to establish before checking auth
    if (isProtectedRoute && !subscriptionReady) {
      logger.category('security').debug(`[GUARD:${instanceId}] ⏳ Waiting for subscription to be ready before auth check on protected route`);
      return;
    }

    logger.category('security').debug(`[GUARD:${instanceId}] 🚀 Starting core auth check, isProtectedRoute=${isProtectedRoute}, level=${level}, params.worldId=${params.worldId}`);

    let mounted = true;
    const check = async () => {
      try {
        const authenticated = await AuthStateManager.isAuthenticated();
        logger.category('security').debug(`[GUARD:${instanceId}] ✓ isAuthenticated returned: ${authenticated}`);

        if (mounted) {
          if (isProtectedRoute && !authenticated && !hasRedirectedRef.current) {
            hasRedirectedRef.current = true;
            logger.category('security').warn(`[GUARD:${instanceId}] ❌ Protected route but not authenticated, redirecting to login`);
            router.replace(AUTH_CONFIG.redirectOnUnauthenticated);
            setAuthState('unauthenticated');
            return;
          }

          // Step 2: If world-required level, verify world access
          if (level === 'world-required') {
            const worldId = typeof params.worldId === 'string' ? params.worldId : undefined;
            
              if (!worldId) {
              logger.category('security').warn(`[GUARD:${instanceId}] ❌ World-required level but no worldId in params, redirecting to select`);
              router.replace('/select/world-selection');
              setAuthState('unauthenticated');
              return;
            }
            
            logger.category('security').info(`[GUARD:${instanceId}] 🌍 World-required: verifying access to world ${worldId}`);
            
            // Check if this is a sensitive page that needs forced verification
            if (options?.forceVerification) {
              logger.category('security').info(`[GUARD:${instanceId}] 🔒 Sensitive page - forcing verification for world ${worldId}`);
              
              const verification = await AuthStateManager.verifyWorldAccessWithDatabase(
                worldId,
                (reason: string) => {
                  logger.category('security').warn(`[GUARD:${instanceId}] Access denied on sensitive page:`, reason);
                  router.replace('/select/world-selection');
                },
                { forceFresh: true }
              );
              
              logger.category('security').info(`[GUARD:${instanceId}] 🔒 Force verification result: hasAccess=${verification.hasAccess}`);
              
              if (!verification.hasAccess) {
                if (mounted && !hasRedirectedRef.current) {
                  hasRedirectedRef.current = true;
                  router.replace('/select/world-selection');
                }
                setAuthState('unauthenticated');
                return;
              }
            } else {
              // Normal cache-first check
              logger.category('security').info(`[GUARD:${instanceId}] 🌍 Cache-first verification for world ${worldId}`);
              
              const verification = await AuthStateManager.verifyWorldAccessWithDatabase(
                worldId,
                (reason: string) => {
                  logger.category('security').warn(`[GUARD:${instanceId}] Access revoked:`, reason);
                  router.replace('/select/world-selection');
                }
              );
              
              logger.category('security').info(`[GUARD:${instanceId}] 🌍 Verification result: hasAccess=${verification.hasAccess}, fromCache=${verification.fromCache}`);
              
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

          //TODO: In the future, we can add more granular permission checks here based on the "level" and route params (e.g. worldId) to enforce DM vs Player access, read vs write permissions, etc.
          // FUTURE: Add role-based checks here when implementing DM/Player permissions (Phase 4d)
          // if (level === 'world-owner' || level === 'world-dm') {
          //   const userRole = await getUserRole(); // from AppParamsVolatileContext
          //   const worldPermissions = await getWorldPermissions(worldId);
          //   
          //   if (level === 'world-owner' && userRole !== 'owner') {
          //     logger.category('security').warn(`[GUARD:${instanceId}] Owner access required but user role=${userRole}`);
          //     router.replace('/select/world-selection');
          //     setAuthState('unauthenticated');
          //     return;
          //   }
          //   
          //   if (level === 'world-dm' && !['owner', 'dm'].includes(userRole)) {
          //     logger.category('security').warn(`[GUARD:${instanceId}] DM access required but user role=${userRole}`);
          //     router.replace('/select/world-selection');
          //     setAuthState('unauthenticated');
          //     return;
          //   }
          // }

          // FUTURE: Add permission checks here when implementing read/write controls (Phase 4d)
          // if (options?.requiredPermission === 'write') {
          //   const permissions = await getWorldPermissions(worldId); // { read: boolean, write: boolean }
          //   if (!permissions.write) {
          //     logger.category('security').warn(`[GUARD:${instanceId}] Write permission required but user has read-only`);
          //     router.replace('/select/world-selection');
          //     setAuthState('unauthenticated');
          //     return;
          //   }
          // }

          setAuthState(authenticated ? 'authenticated' : 'unauthenticated');
        }
      } catch (error) {
        logger.category('security').error(`[GUARD:${instanceId}] Error in auth check:`, error);
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
  }, [appReady, isProtectedRoute, subscriptionReady, router, instanceId, level, params.worldId, options?.forceVerification]);

  return authState;
}
