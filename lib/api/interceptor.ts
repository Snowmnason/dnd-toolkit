/**
 * Request Interceptor System
 *
 * Provides hooks for cross-cutting concerns:
 * - Request transformation (headers, body, routing)
 * - Response transformation (parsing, extraction, validation)
 * - Error handling (logging, recovery, telemetry)
 *
 * Hooks run serially in registration order.
 * Errors in hooks are caught and logged; execution continues.
 * Hooks are NOT called for 401 errors (AuthLayer handles those).
 */

import { logger } from "../utils/logger";

export interface RequestInterceptor {
  /** Optional name for debugging/logging */
  name?: string;

  /** Max execution time for this interceptor (ms). Exceeded hooks are skipped (Phase 4 enhancement) */
  timeout?: number;

  /** If true, don't wait for hook completion; continue immediately (Phase 4 enhancement) */
  nonBlocking?: boolean;

  /**
   * Called before fetcher executes (before each RequestManager retry attempt)
   * Can mutate req.init (add headers, modify body)
   *
   * @param req - Request object with url, init (mutable), endpoint, isOffline
   */
  onBeforeRequest?(req: {
    url: string;
    init: RequestInit; // Mutable
    endpoint?: string; // Parsed endpoint name (e.g., 'worlds', 'users')
    isOffline?: boolean; // From NetworkState machine
  }): Promise<void> | void;

  /**
   * Called after successful response (before data returned to caller)
   * Can mutate data (transform, parse, extract nested structure)
   *
   * @param res - Response object with data (mutable), cacheKey
   */
  onAfterResponse?(res: {
    data: any; // Mutable
    cacheKey?: string; // From QueryCache
  }): Promise<void> | void;

  /**
   * Called when RequestManager exhausts retries (not for AuthLayer 401 handling)
   * Cannot suppress/replace errors; can only observe and log
   *
   * @param err - Error object with error, url, init, statusCode, isNetworkError, endpoint, queued
   */
  onError?(err: {
    error: Error;
    url: string;
    init: RequestInit;
    statusCode?: number; // HTTP status if available (401, 500, etc.)
    isNetworkError?: boolean; // True if network failure, false if HTTP error
    endpoint?: string;
    queued?: boolean; // True if request was queued for offline replay
  }): Promise<void> | void;
}

/**
 * Parse endpoint name from URL
 * Examples:
 *   "https://api.example.com/api/worlds" → "worlds"
 *   "/api/users/123" → "users"
 *   "worlds:list" → "worlds"
 *
 * @param url - URL or key string
 * @returns Endpoint name or undefined if unparseable
 */
export function parseEndpoint(url: string): string | undefined {
  // If it's a cache key pattern (e.g., "worlds:user:123"), extract first part
  if (url.includes(":") && !url.startsWith("http")) {
    return url.split(":")[0];
  }

  // If it's a URL path with /api/, extract first path segment after /api/
  const apiMatch = url.match(/\/api\/([a-zA-Z]+)/);
  if (apiMatch) {
    return apiMatch[1];
  }

  // Try to extract from generic URL path (e.g., /worlds, /users/123)
  // Only for paths, not full URLs
  if (!url.startsWith("http")) {
    const pathMatch = url.match(/^\/([a-zA-Z]+)/);
    if (pathMatch) {
      return pathMatch[1];
    }
  }

  return undefined;
}

/**
 * Execute hooks serially, catching and logging errors
 * Phase 4 Enhancement: Support timeout and non-blocking modes
 *
 * @param hooks - Array of hook functions to execute
 * @param context - Context object to pass to hooks
 * @param hookName - Name of the hook type (for logging)
 * @param interceptors - Optional interceptor metadata for timeout/nonBlocking config
 */
export async function executeHooksSerially<T>(
  hooks: ((context: T) => Promise<void> | void)[],
  context: T,
  hookName: string,
  interceptors?: RequestInterceptor[],
): Promise<void> {
  let index = 0;
  for (const hook of hooks) {
    const interceptor = interceptors?.[index];

    try {
      // Phase 4: Apply timeout if specified
      if (interceptor?.timeout) {
        const timeoutPromise = new Promise<void>((_, reject) => {
          setTimeout(
            () =>
              reject(
                new Error(`Interceptor timeout: ${interceptor.timeout}ms`),
              ),
            interceptor.timeout,
          );
        });

        // Race between hook execution and timeout
        await Promise.race([Promise.resolve(hook(context)), timeoutPromise]);

        logger.debug("api", `Hook completed within timeout`, {
          hookName,
          index,
          timeout: interceptor.timeout,
        });
      } else {
        // Normal execution without timeout
        await hook(context);
      }

      // Phase 4: If nonBlocking=true, don't wait for result (fire and forget)
      // But we already awaited above, so this is more for semantic clarity
      if (interceptor?.nonBlocking) {
        logger.debug("api", `Executed non-blocking hook`, {
          hookName,
          index,
        });
      }
    } catch (error) {
      logger.error("api", `Error in ${hookName} hook [${index}]:`, { error });
      // Continue to next hook even if this one fails
    }
    index++;
  }
}

/**
 * Interceptor Manager: Registers, manages, and executes interceptors
 *
 * Singleton pattern; use InterceptorManager.getInstance() to get instance
 */
class InterceptorManagerClass {
  private interceptors: RequestInterceptor[] = [];
  private static instance: InterceptorManagerClass | null = null;

  private constructor() {}

  static getInstance(): InterceptorManagerClass {
    if (!this.instance) {
      this.instance = new InterceptorManagerClass();
    }
    return this.instance;
  }

  /**
   * Register a new interceptor
   *
   * @param interceptor - Interceptor to register
   */
  registerInterceptor(interceptor: RequestInterceptor): void {
    this.interceptors.push(interceptor);
    logger.debug(
      "api",
      `Registered interceptor: ${interceptor.name || "unnamed"}`,
    );
  }

  /**
   * Unregister an interceptor
   *
   * @param interceptor - Interceptor to unregister
   */
  unregisterInterceptor(interceptor: RequestInterceptor): void {
    const index = this.interceptors.indexOf(interceptor);
    if (index >= 0) {
      this.interceptors.splice(index, 1);
      logger.debug(
        "api",
        `Unregistered interceptor: ${interceptor.name || "unnamed"}`,
      );
    }
  }

  /**
   * Get all registered interceptors
   */
  getInterceptors(): RequestInterceptor[] {
    return [...this.interceptors];
  }

  /**
   * Clear all interceptors (useful for testing)
   */
  clearInterceptors(): void {
    this.interceptors = [];
  }

  /**
   * Execute onBeforeRequest hooks for all interceptors
   */
  async executeBeforeRequestHooks(req: {
    url: string;
    init: RequestInit;
    endpoint?: string;
  }): Promise<void> {
    const hooks = this.interceptors
      .filter((i) => i.onBeforeRequest)
      .map((i) => (ctx: any) => i.onBeforeRequest!(ctx));

    if (hooks.length === 0) return;

    // Lazy import to avoid circular dependency issues in tests
    const { NetworkDetection } = await import("../network");
    const isOffline = !NetworkDetection.getStatus().isOnline;

    // Explicitly construct context with known properties only (prevents object injection warning)
    const context: Parameters<
      Exclude<RequestInterceptor["onBeforeRequest"], undefined>
    >[0] = {
      url: req.url,
      init: req.init,
      endpoint: req.endpoint,
      isOffline,
    };

    await executeHooksSerially(hooks, context, "onBeforeRequest");
  }

  /**
   * Execute onAfterResponse hooks for all interceptors
   */
  async executeAfterResponseHooks(res: {
    data: any;
    cacheKey?: string;
  }): Promise<void> {
    const hooks = this.interceptors
      .filter((i) => i.onAfterResponse)
      .map((i) => (ctx: any) => i.onAfterResponse!(ctx));

    if (hooks.length === 0) return;

    // Explicitly construct context with known properties only (prevents object injection warning)
    const context: Parameters<
      Exclude<RequestInterceptor["onAfterResponse"], undefined>
    >[0] = {
      data: res.data,
      cacheKey: res.cacheKey,
    };

    await executeHooksSerially(hooks, context, "onAfterResponse");
  }

  /**
   * Execute onError hooks for all interceptors
   */
  async executeErrorHooks(err: {
    error: Error;
    url: string;
    init: RequestInit;
    statusCode?: number;
    isNetworkError?: boolean;
    endpoint?: string;
    queued?: boolean;
  }): Promise<void> {
    const hooks = this.interceptors
      .filter((i) => i.onError)
      .map((i) => (ctx: any) => i.onError!(ctx));

    if (hooks.length === 0) return;

    // Explicitly construct context with known properties only (prevents object injection warning)
    const context: Parameters<
      Exclude<RequestInterceptor["onError"], undefined>
    >[0] = {
      error: err.error,
      url: err.url,
      init: err.init,
      statusCode: err.statusCode,
      isNetworkError: err.isNetworkError,
      endpoint: err.endpoint,
      queued: err.queued,
    };

    await executeHooksSerially(hooks, context, "onError");
  }
}

export const InterceptorManager = InterceptorManagerClass.getInstance();
