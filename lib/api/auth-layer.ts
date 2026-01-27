/**
 * AuthLayer: Centralized authentication middleware for RequestManager
 *
 * Responsibilities:
 * - Register and manage auth strategies (user, service account, external APIs)
 * - Inject Bearer tokens into request headers
 * - Handle 401 responses with per-strategy locking (prevents thundering herd)
 * - Clear session on auth failure and trigger logout cascade
 *
 * Usage:
 * ```typescript
 * const strategy: AuthStrategy = {
 *   async getToken(context) {
 *     const session = await SessionService.getCurrentSession();
 *     return session?.access_token ?? null;
 *   },
 *   async onTokenExpire(context) {
 *     await AuthStateManager.clearAuthState();
 *   }
 * };
 *
 * AuthLayer.registerAuthStrategy('user', strategy);
 * const headers = await AuthLayer.injectAuthHeader({ ... }, 'user', context);
 * ```
 */

import { logger } from "../utils/logger";

/**
 * Minimal context passed to strategy for decision-making
 */
export interface AuthContext {
  /** Request URL */
  url: string;

  /** HTTP method */
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD";

  /** Optional: API endpoint category for routing (e.g., 'users', 'worlds', 'admin') */
  endpoint?: string;

  /** Optional: retry attempt count (0 on first attempt) */
  retryCount?: number;

  // ===== Phase 2+ Extensions (add without breaking existing strategies) =====
  // userId?: string;           // Add to enable per-user strategy behavior
  // worldId?: string;          // Add for world-scoped auth decisions
  // scope?: string[];          // Add for permission-based auth filtering
  //
  // Example Phase 2+ strategy using extensible context:
  //   async getToken(context: AuthContext) {
  //     if (context.worldId && context.userId) {
  //       // World-scoped access: return token valid for this world only
  //       return await SessionService.getWorldAccessToken(
  //         context.userId,
  //         context.worldId
  //       );
  //     }
  //     // User-level access: return general user token
  //     const session = await SessionService.getCurrentSession();
  //     return session?.access_token ?? null;
  //   }
}

/**
 * Auth strategy defines how to get and refresh tokens
 */
export interface AuthStrategy {
  /**
   * Get token for this request context
   * @returns Token string, or null if not applicable for this endpoint
   */
  getToken(context: AuthContext): Promise<string | null>;

  /**
   * Called on 401 or token expiry - refresh or invalidate token
   * @returns Promise that resolves when refresh is complete
   */
  onTokenExpire?(context: AuthContext): Promise<void>;
}

/**
 * AuthLayer: Manages auth strategies and token injection
 */
class AuthLayerClass {
  /** Registered auth strategies by name */
  private strategies: Map<string, AuthStrategy> = new Map();

  /** Per-strategy refresh locks to prevent thundering herd */
  private refreshLocks: Map<string, Promise<void>> = new Map();

  /**
   * Register an auth strategy
   *
   * @param name - Strategy name (e.g., 'user', 'service', 'stripe')
   * @param strategy - Strategy implementation
   * @throws If strategy with same name already registered
   *
   * @example
   * ```typescript
   * AuthLayer.registerAuthStrategy('user', userTokenStrategy);
   * AuthLayer.registerAuthStrategy('service', serviceAccountStrategy);
   * ```
   */
  registerAuthStrategy(name: string, strategy: AuthStrategy): void {
    if (this.strategies.has(name)) {
      logger.warn("auth", `Strategy '${name}' already registered, overwriting`);
    }
    this.strategies.set(name, strategy);
    logger.debug("auth", `Registered auth strategy: ${name}`);
  }

  /**
   * Get registered strategy by name
   *
   * @param name - Strategy name
   * @returns Strategy, or undefined if not found
   */
  getAuthStrategy(name: string): AuthStrategy | undefined {
    return this.strategies.get(name);
  }

  /**
   * Clear all strategies (useful for testing/reset)
   */
  clearAuthStrategies(): void {
    this.strategies.clear();
    this.refreshLocks.clear();
    logger.debug("auth", "Cleared all auth strategies");
  }

  /**
   * Inject auth header into request headers
   *
   * @param headers - Request headers object
   * @param strategyName - Name of registered strategy
   * @param context - Request context for strategy decision-making
   * @returns New headers object with auth header injected (or original if no token)
   *
   * @example
   * ```typescript
   * const headers = await AuthLayer.injectAuthHeader(
   *   { 'Content-Type': 'application/json' },
   *   'user',
   *   { url, method, endpoint }
   * );
   * ```
   */
  async injectAuthHeader(
    headers: Record<string, string>,
    strategyName: string,
    context: AuthContext,
  ): Promise<Record<string, string>> {
    const strategy = this.getAuthStrategy(strategyName);
    if (!strategy) {
      logger.warn("auth", `Strategy '${strategyName}' not found`, {
        endpoint: context.endpoint,
      });
      return headers;
    }

    try {
      const token = await strategy.getToken(context);
      if (!token) {
        logger.debug("auth", `No token from strategy '${strategyName}'`, {
          endpoint: context.endpoint,
        });
        return headers;
      }

      return {
        ...headers,
        Authorization: `Bearer ${token}`,
      };
    } catch (error) {
      logger.error("auth", `Failed to get token from '${strategyName}':`, {
        error,
        endpoint: context.endpoint,
      });
      return headers;
    }
  }

  /**
   * Handle 401 response with per-strategy locking
   *
   * Flow:
   * 1. Check if already refreshing (lock exists)
   * 2. If yes, wait for existing refresh to complete
   * 3. If no, acquire lock, call onTokenExpire, release lock
   * 4. Return promise that resolves when refresh is complete
   *
   * This prevents multiple concurrent 401s from calling onTokenExpire multiple times
   * (thundering herd problem). Each strategy has independent lock.
   *
   * @param strategyName - Name of registered strategy
   * @param context - Request context
   * @returns Promise that resolves when token refresh is complete
   *
   * @example
   * ```typescript
   * if (response.status === 401) {
   *   await AuthLayer.handle401Response('user', context);
   *   // Request can now be retried with new token
   * }
   * ```
   */
  handle401Response(strategyName: string, context: AuthContext): Promise<void> {
    const strategy = this.getAuthStrategy(strategyName);
    if (!strategy) {
      logger.warn("auth", `Strategy '${strategyName}' not found for 401`, {
        endpoint: context.endpoint,
      });
      return Promise.resolve();
    }

    // Check if refresh already in progress for this strategy
    let refreshPromise = this.refreshLocks.get(strategyName);

    if (refreshPromise) {
      logger.debug("auth", `Waiting for ${strategyName} token refresh`, {
        endpoint: context.endpoint,
      });
      return refreshPromise;
    }

    // Start new refresh
    refreshPromise = (async () => {
      try {
        logger.debug("auth", `Starting ${strategyName} token refresh`, {
          endpoint: context.endpoint,
        });

        if (strategy.onTokenExpire) {
          await strategy.onTokenExpire(context);
        }

        logger.info("auth", `Completed ${strategyName} token refresh`, {
          endpoint: context.endpoint,
        });
      } catch (error) {
        logger.error("auth", `Failed ${strategyName} token refresh:`, {
          error,
          endpoint: context.endpoint,
        });
        throw error;
      } finally {
        // Release lock
        this.refreshLocks.delete(strategyName);
      }
    })();

    this.refreshLocks.set(strategyName, refreshPromise);
    return refreshPromise;
  }

  /**
   * Check if a strategy is currently refreshing its token
   *
   * @param strategyName - Name of registered strategy
   * @returns true if refresh is in progress
   */
  isRefreshing(strategyName: string): boolean {
    return this.refreshLocks.has(strategyName);
  }

  /**
   * Get all registered strategy names
   *
   * @returns Array of strategy names
   */
  getRegisteredStrategies(): string[] {
    return Array.from(this.strategies.keys());
  }
}

/**
 * Singleton instance of AuthLayer
 */
export const AuthLayer = new AuthLayerClass();
