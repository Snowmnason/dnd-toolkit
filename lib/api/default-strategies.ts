/**
 * Default Auth Strategies for AuthLayer
 *
 * Concrete implementations of AuthStrategy for common auth patterns
 */

import { AuthStrategy, type AuthContext } from "./auth-layer";
import { logger } from "../utils/logger";
import {
  getSupabaseClientLazy,
  isSupabaseConfiguredLazy,
} from "../database/supabase-lazy";

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
          logger.debug("auth", "Using cached token", {
            endpoint: context.endpoint,
          });
          return cachedToken.token;
        }

        // Check if Supabase is configured before attempting to get session
        const configured = await isSupabaseConfiguredLazy();
        if (!configured) {
          logger.debug("auth", "Supabase not configured, no token available");
          cachedToken = null;
          return null;
        }

        const supabase = await getSupabaseClientLazy();
        const { data, error } = await supabase.auth.getSession();

        if (error || !data.session) {
          logger.debug("auth", "No valid session found");
          cachedToken = null;
          return null;
        }

        const token = data.session.access_token;

        // JWT tokens are typically 1 hour (3600s). Refresh at 80% TTL (2880s = 48 min)
        // This way cache expires before actual token expiry, triggering fresh fetch before 401
        const tokenTTL = 3600 * 1000; // Default 1 hour in ms
        const refreshThreshold = tokenTTL * 0.8; // Refresh at 80% TTL

        cachedToken = {
          token,
          expiresAt: Date.now() + refreshThreshold,
        };

        logger.debug("auth", "Fetched fresh token from Supabase", {
          endpoint: context.endpoint,
          cacheExpiresIn: refreshThreshold,
        });

        return token;
      } catch (error) {
        logger.error("auth", "Failed to get user token:", {
          error,
          endpoint: context.endpoint,
        });
        cachedToken = null;
        return null;
      }
    },

    async onTokenExpire(context: AuthContext): Promise<void> {
      try {
        logger.warn("auth", "User token expired, logging out", {
          endpoint: context.endpoint,
        });

        // Clear token cache
        cachedToken = null;

        // Check if Supabase is configured
        const configured = await isSupabaseConfiguredLazy();
        if (configured) {
          const supabase = await getSupabaseClientLazy();
          await supabase.auth.signOut();
        }

        // Clear app auth state (hasAccount: false)
        const { AuthStateManager } = await import("../auth/auth-state");
        await AuthStateManager.clearAuthState();

        logger.info("auth", "User logged out due to token expiry");
      } catch (error) {
        logger.error("auth", "Failed to handle token expiry:", { error });
        // Clear cache defensively even if logout fails
        cachedToken = null;
        // Re-throw so auth layer can handle the error
        throw error;
      }
    },
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
      logger.debug("auth", "Token expire called on public strategy (unexpected)", {
        endpoint: context.endpoint,
      });
    },
  };
}

