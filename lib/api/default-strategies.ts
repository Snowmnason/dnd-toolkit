/**
 * Default Auth Strategies for AuthLayer
 *
 * Concrete implementations of AuthStrategy for common auth patterns.
 *
 * NOTE: This file is intentionally kept coupled to Supabase for token refresh operations.
 * Token lifecycle (refreshSession, getSession) is infrastructure-level and varies wildly
 * between auth providers (Supabase uses 1-hour JWT with refresh tokens, Firebase has
 * different patterns, OAuth providers may not support refresh at all).
 * 
 * User-facing auth operations (signup, signin, logout) are abstracted via AuthProvider.
 * Low-level token management stays provider-specific to avoid over-abstraction.
 */

import { ERROR_CODES } from "@/maps/ERROR_CODES";
import { getAuthProviderSync } from "@/lib/services";
import {
  getSupabaseClientLazy,
  isSupabaseConfiguredLazy,
} from "@/lib/services/supabase/supabase-lazy";
import { logger } from "@/lib/utils";
import { AuthStrategy, type AuthContext } from "./auth-layer";

/**
 * User Auth Strategy: Manages Supabase user session tokens
 *
 * Integrates with:
 * - Supabase: gets current session + access token via getSupabaseClientLazy()
 * - AuthStateManager: clears app state on logout (401)
 * - Token caching: Caches token in memory to avoid redundant Supabase calls
 *
 * @example
 * ```typescript
 * AuthLayer.registerAuthStrategy('user', createUserAuthStrategy());
 *
 * // Now all requests can use the user token:
 * await RequestManager.fetch('/api/worlds', fetcher, {
 *   authStrategy: 'user'
 * });
 * ```
 */
export function createUserAuthStrategy(): AuthStrategy {
  // Token cache: { token, expiresAt }
  // Prevents hitting Supabase on every request if token is still valid
  let cachedToken: { token: string; expiresAt: number } | null = null;

  return {
    async getToken(context: AuthContext): Promise<string | null> {
      try {
        // OPTIMIZATION: Check cached token first
        // Only call Supabase if cache is expired or doesn't exist
        if (cachedToken && Date.now() < cachedToken.expiresAt) {
          logger.category("auth").debug("Using cached token", {
            endpoint: context.endpoint,
          });
          return cachedToken.token;
        }

        // Check if auth provider is configured before attempting to get session
        const provider = getAuthProviderSync();
        if (!provider) {
          logger.category("auth").debug("Auth provider not configured, no token available");
          cachedToken = null;
          return null;
        }

        const session = await provider.getSession();

        if (!session?.accessToken) {
          logger.category("auth").debug("No valid session found");
          cachedToken = null;
          return null;
        }

        const token = session.accessToken;

        // JWT tokens are typically 1 hour (3600s). Refresh at 80% TTL (2880s = 48 min)
        // This way cache expires before actual token expiry, triggering fresh fetch before 401
        const tokenTTL = 3600 * 1000; // Default 1 hour in ms
        const refreshThreshold = tokenTTL * 0.8; // Refresh at 80% TTL

        cachedToken = {
          token,
          expiresAt: Date.now() + refreshThreshold,
        };

        logger.category("auth").debug("Fetched fresh token from Supabase", {
          endpoint: context.endpoint,
          cacheExpiresIn: refreshThreshold,
        });

        return token;
      } catch (error) {
        logger.category("auth").error("Failed to get user token", {
          code: ERROR_CODES.AUTH.UNKNOWN,
          error,
          endpoint: context.endpoint,
        });
        cachedToken = null;
        return null;
      }
    },

    async onTokenExpire(context: AuthContext): Promise<void> {
      try {
        logger.category("auth").debug("Token expired, attempting refresh", {
          endpoint: context.endpoint,
          retryCount: context.retryCount,
        });

        // Clear token cache to force fresh fetch after refresh
        cachedToken = null;

        // Check if Supabase is configured
        const configured = await isSupabaseConfiguredLazy();
        if (!configured) {
          logger.category("auth").warn("Supabase not configured, cannot refresh token", {
            code: ERROR_CODES.AUTH.UNKNOWN,
            endpoint: context.endpoint,
          });
          throw new Error("Supabase not configured for token refresh");
        }

        const supabase = await getSupabaseClientLazy();
        const { data, error } = await supabase.auth.refreshSession();

        if (error || !data.session) {
          // Refresh failed - session is truly invalid
          logger.category("auth").warn("Token refresh failed, session invalid", {
            code: ERROR_CODES.AUTH.SESSION_EXPIRED,
            error: error?.message || "No session after refresh",
            endpoint: context.endpoint,
          });

          // Log out user since refresh is no longer possible
          try {
            const provider = getAuthProviderSync();
            if (provider) {
              await provider.signOut();
            }
          } catch (signOutError) {
            logger.category("auth").error("Failed to sign out after refresh failure", {
              signOutError,
            });
          }

          // Clear app auth state (hasAccount: false)
          const { AuthStateManager } = await import("../auth/auth-state");
          await AuthStateManager.clearAuthState();

          logger.category("auth").info("User logged out due to failed token refresh");

          throw new Error("Token refresh failed and session is invalid");
        }

        // Refresh succeeded - new token is now in Supabase session
        // Next getToken() call will fetch it and cache it
        logger.category("auth").info("Token refresh succeeded", {
          endpoint: context.endpoint,
        });
      } catch (error) {
        logger.category("auth").error("Failed to handle token expiry", {
          code: ERROR_CODES.AUTH.SESSION_EXPIRED,
          error,
        });
        // Re-throw so auth layer can handle the error and request-manager knows retry failed
        throw error;
      }
    },

    // CRITICAL: User session failures MUST trigger logout
    shouldClearAuthStateOn401: true,
  };
}

/**
 * Public Auth Strategy: No authentication required
 *
 * Use for:
 * - Signup/signin operations (pre-auth, no user token yet)
 * - Password reset flows
 * - Public API endpoints
 *
 * No-op for token injection and token expiry since these endpoints don't require auth.
 *
 * @example
 * ```typescript
 * AuthLayer.registerAuthStrategy('public', createPublicAuthStrategy());
 *
 * // Signup doesn't need user token:
 * await RequestManager.fetch('/auth/signup', fetcher, {
 *   authStrategy: 'public'
 * });
 * ```
 */
export function createPublicAuthStrategy(): AuthStrategy {
  return {
    async getToken(context: AuthContext): Promise<string | null> {
      // No token needed for public endpoints
      return null;
    },

    async onTokenExpire(context: AuthContext): Promise<void> {
      // Public endpoints don't have tokens, so this should never be called
      logger.category("auth").debug(
        "Token expire called on public strategy (unexpected)",
        {
          endpoint: context.endpoint,
        },
      );
    },

    // Public strategy has no auth, so never clear auth state on 401
    shouldClearAuthStateOn401: false,
  };
}

/**
 * Invite Auth Strategy: Optional authentication for invite validation
 *
 * Use for:
 * - Invite token validation (works with or without user session)
 * - Optional-auth endpoints where user token enhances but isn't required
 *
 * Behavior:
 * - If user has valid session: injects token (like "user" strategy)
 * - If user has no session: proceeds without token (like "public" strategy)
 * - On 401: does NOT clear auth state (invite is optional auth, 401 just means invalid invite)
 *
 * This prevents RLS policy changes or misconfigurations from clearing app auth state
 * during login/signup flow.
 *
 * @example
 * ```typescript
 * AuthLayer.registerAuthStrategy('invite', createInviteAuthStrategy());
 *
 * // Validate invite on login page (with or without user session)
 * await RequestManager.fetch('/api/validate-invite', fetcher, {
 *   authStrategy: 'invite'
 * });
 * ```
 */
export function createInviteAuthStrategy(): AuthStrategy {
  // Token cache (same as user strategy)
  let cachedToken: { token: string; expiresAt: number } | null = null;

  return {
    async getToken(context: AuthContext): Promise<string | null> {
      try {
        // OPTIMIZATION: Check cached token first
        if (cachedToken && Date.now() < cachedToken.expiresAt) {
          logger.category("auth").debug("Using cached token for invite", {
            endpoint: context.endpoint,
          });
          return cachedToken.token;
        }

        // Check if auth provider is configured
        const provider = getAuthProviderSync();
        if (!provider) {
          logger.category("auth").debug(
            "Auth provider not configured for invite, proceeding without token",
          );
          cachedToken = null;
          return null;
        }

        const session = await provider.getSession();

        if (!session?.accessToken) {
          logger.category("auth").debug(
            "No valid session for invite, proceeding without token",
          );
          cachedToken = null;
          return null;
        }

        const token = session.accessToken;
        const tokenTTL = 3600 * 1000; // 1 hour
        cachedToken = {
          token,
          expiresAt: Date.now() + tokenTTL * 0.8, // Refresh at 80% TTL
        };

        logger.category("auth").debug("Got token for invite strategy", {
          endpoint: context.endpoint,
        });

        return token;
      } catch (error) {
        logger.category("auth").error("Failed to get invite token", {
          code: ERROR_CODES.AUTH.UNKNOWN,
          error,
          endpoint: context.endpoint,
        });
        cachedToken = null;
        return null;
      }
    },

    async onTokenExpire(context: AuthContext): Promise<void> {
      // CRITICAL: Invite is optional auth. 401 doesn't mean session is invalid.
      // It might just mean:
      // - Invite token is invalid/expired
      // - RLS policy changed
      // - User doesn't have permission for this specific invite
      //
      // We MUST NOT clear auth state here because:
      // 1. User session is still valid (just not for this invite)
      // 2. Clearing auth state would log user out during signup/login flow
      // 3. Invite validation is NOT a security-critical auth operation
      //
      // Simply log and let RequestManager handle the 401 as a normal error.
      logger.category("auth").warn(
        "Invite validation got 401, not clearing auth state",
        {
          endpoint: context.endpoint,
        },
      );

      // Clear cached token since it's now invalid
      cachedToken = null;

      // Do NOT call clearAuthState() - that's the whole point of this strategy!
    },

    // Invite is optional auth, never clear auth state on 401
    shouldClearAuthStateOn401: false,
  };
}
