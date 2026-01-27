import * as Sentry from "@sentry/react-native";
import {
  Analytics,
  sanitizeError as sanitizeErrorForAnalytics,
} from "../analytics";
import { QueryCache } from "../cache";
import { getAppConfig } from "../config";
import { logger } from "../utils/logger";
import { AuthLayer, type AuthContext } from "./auth-layer";
import { InterceptorManager, parseEndpoint } from "./interceptor";

/**
 * Request Manager: Centralized API request layer with:
 * - Request deduplication (avoid duplicate in-flight requests)
 * - Retry logic with exponential backoff
 * - Optional rate limiting (token bucket)
 * - Optional QueryCache integration for data persistence
 * - Fail-open flag (graceful degradation when offline/disabled)
 * - Sentry error reporting
 * - Extension point for future offline buffering
 */

// ==========================================
// Types and Interfaces
// ==========================================

export interface RequestOptions {
  /** Deduplicate identical concurrent requests (default: true) */
  dedupe?: boolean;

  /** Number of retry attempts on failure (default: 3) */
  retries?: number;

  /** Initial retry delay in ms, exponentially backed off (default: 1000) */
  retryDelay?: number;

  /** If true and request fails, return null instead of throwing (default: false) */
  failOpen?: boolean;

  /** Rate limit key - if provided, applies rate limiting (optional) */
  rateLimitKey?: string;

  /** Timeout in ms for the request (default: 30000) */
  timeout?: number;

  // ===== AuthLayer Integration =====

  /** Auth strategy name for this request (optional). If not specified, request proceeds without auth layer wrapping. */
  authStrategy?: string;

  // ===== QueryCache Integration Options =====

  /** Use QueryCache for data persistence (default: false) */
  useQueryCache?: boolean;

  /** Stale time for QueryCache (only used if useQueryCache is true) */
  staleTime?: number;

  /** Cache time for QueryCache (only used if useQueryCache is true) */
  cacheTime?: number;

  /** Tags for QueryCache invalidation (only used if useQueryCache is true) */
  tags?: string[];
}

interface PendingRequest {
  promise: Promise<any>;
  timestamp: number;
}

interface RateLimitBucket {
  tokens: number;
  lastRefill: number;
  lastAccess: number; // Track last access time for cleanup
}

// ==========================================
// Utility Functions
// ==========================================

/**
 * Normalize HeadersInit to Record<string, string>
 *
 * Supports all HeadersInit formats:
 * - Headers object: Convert with Object.fromEntries(headers.entries())
 * - Array of tuples: Convert with Object.fromEntries(headers)
 * - Plain object: Use as-is
 *
 * @param headersInit - Headers in any supported format
 * @returns Plain object with string keys and values
 */
function normalizeHeaders(
  headersInit: HeadersInit | undefined,
): Record<string, string> {
  if (!headersInit) {
    return {};
  }

  // Plain object: use as-is
  if (
    typeof headersInit === "object" &&
    !Array.isArray(headersInit) &&
    !(headersInit instanceof Headers)
  ) {
    return headersInit as Record<string, string>;
  }

  // Headers object: convert to plain object
  if (headersInit instanceof Headers) {
    return Object.fromEntries(headersInit.entries());
  }

  // Array of tuples: convert to plain object
  if (Array.isArray(headersInit)) {
    return Object.fromEntries(headersInit);
  }

  return {};
}

// ==========================================
// Configuration
// ==========================================

/**
 * Get default options from appsettings (for optional fields only)
 * Returns all optional RequestOptions fields with non-undefined defaults
 */
function getDefaultOptions(): Omit<
  Required<Omit<RequestOptions, "authStrategy">>,
  never
> {
  const config = getAppConfig();
  return {
    dedupe: true,
    retries: 3,
    retryDelay: config.api?.retryDelayMs ?? 1000,
    failOpen: false,
    timeout: config.api?.requestTimeoutMs ?? 30000,
    rateLimitKey: "",
    useQueryCache: false,
    staleTime: config.api?.staleTimeMs ?? 2 * 60 * 1000,
    cacheTime: config.api?.cacheTimeMs ?? 5 * 60 * 1000,
    tags: [],
  };
}

const DEFAULT_OPTIONS = getDefaultOptions();

// Rate limiting: token bucket algorithm
// Default: 10 requests per second per key
const RATE_LIMIT_CONFIG = {
  tokensPerSecond: 10,
  maxTokens: 20, // Allow bursts up to 2 seconds worth
};

// ==========================================
// Request Manager Class
// ==========================================

class RequestManagerClass {
  /** Track pending requests to deduplicate */
  private pendingRequests: Map<string, PendingRequest> = new Map();

  /** Rate limit buckets by key */
  private rateLimitBuckets: Map<string, RateLimitBucket> = new Map();

  /** Periodic cleanup timer to prevent memory leaks */
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  /** Cleanup interval: configurable from appsettings (default: 1 hour) */
  private readonly CLEANUP_INTERVAL =
    getAppConfig().api?.cleanupIntervalMs ?? 60 * 60 * 1000;

  /** Stale entry threshold: configurable from appsettings (default: 1 hour of inactivity) */
  private readonly STALE_THRESHOLD =
    getAppConfig().api?.staleThresholdMs ?? 60 * 60 * 1000;

  /** Hook for offline detection - can short-circuit to fail-open */
  onOfflineDetect?: () => boolean | Promise<boolean>;

  constructor() {
    // Start periodic cleanup of stale rate limit buckets
    this.startCleanupTimer();
  }

  /**
   * Start periodic cleanup of stale rate limit buckets
   */
  private startCleanupTimer(): void {
    // Only start if not already running
    if (this.cleanupTimer) return;

    this.cleanupTimer = setInterval(() => {
      this.cleanupStaleEntries();
    }, this.CLEANUP_INTERVAL);

    // Make timer non-blocking (won't prevent process exit) on Node.js
    if (typeof this.cleanupTimer === "object" && "unref" in this.cleanupTimer) {
      (this.cleanupTimer as any).unref();
    }
  }

  /**
   * Stop the cleanup timer (useful for testing or cleanup)
   */
  private stopCleanupTimer(): void {
    if (this.cleanupTimer !== null) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Remove stale rate limit bucket entries that haven't been accessed
   * This prevents unbounded memory growth in long-running applications
   */
  private cleanupStaleEntries(): void {
    const now = Date.now();
    let removedBuckets = 0;
    let removedRequests = 0;

    // Clean up stale rate limit buckets
    const bucketEntries = Array.from(this.rateLimitBuckets.entries());
    for (const [key, bucket] of bucketEntries) {
      if (now - bucket.lastAccess > this.STALE_THRESHOLD) {
        this.rateLimitBuckets.delete(key);
        removedBuckets++;
      }
    }

    // Clean up stale pending requests (requests that have been pending > 1 hour)
    // This handles cases where requests hang or take an extremely long time
    const requestEntries = Array.from(this.pendingRequests.entries());
    for (const [key, request] of requestEntries) {
      if (now - request.timestamp > this.STALE_THRESHOLD) {
        this.pendingRequests.delete(key);
        removedRequests++;
        logger.category("api").warn("Stale request cleaned up", {
          key,
          staleSinceMinutes: Math.round((now - request.timestamp) / 1000 / 60),
        });
      }
    }

    if (removedBuckets > 0 || removedRequests > 0) {
      logger.category("api").debug("Cleanup cycle completed", {
        buckets: removedBuckets,
        requests: removedRequests,
        totalPendingNow: this.pendingRequests.size,
        totalBucketsNow: this.rateLimitBuckets.size,
      });
    }
  }

  /**
   * Execute a request with optional dedupe, retry, rate limiting, and QueryCache
   *
   * @param key - Unique key for deduplication (should be deterministic)
   * @param fetcher - Async function that performs the actual request
   * @param options - Request options (dedupe, retries, failOpen, useQueryCache, authStrategy, etc.) (optional, defaults to {})
   * @returns The result of the fetcher function
   *
   * @example
   * ```typescript
   * // Without auth strategy (no auth layer wrapping)
   * const data = await RequestManager.fetch(
   *   `data:key`,
   *   () => fetchData()
   * );
   *
   * // With auth strategy
   * const worlds = await RequestManager.fetch(
   *   `worlds:user:${userId}`,
   *   () => worldsDB.getMyWorlds(userId),
   *   {
   *     authStrategy: 'user',
   *     dedupe: true,
   *     rateLimitKey: `user:${userId}`,
   *     useQueryCache: true,
   *     staleTime: 2 * 60 * 60 * 1000, // 2 hours
   *     tags: ['worlds', `user:${userId}`]
   *   }
   * );
   * ```
   */
  async fetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    options?: RequestOptions,
  ): Promise<T | null> {
    const options_ = { ...DEFAULT_OPTIONS, ...options } as Required<
      Omit<RequestOptions, "authStrategy">
    > & { authStrategy?: string };
    const startedAt = Date.now();
    const trackingEnabled = Analytics.enabled();

    // ========== QueryCache CHECK (Optional) ==========
    // If useQueryCache is enabled, check cache first before dedupe/retry logic
    if (options_.useQueryCache) {
      try {
        const cached = await QueryCache.get<T>(key);
        if (cached !== undefined && cached !== null) {
          const isStale = await QueryCache.isStale(key);
          if (!isStale) {
            // Cache hit and not stale - return immediately
            logger.debug("api", "QueryCache hit (not stale):", { key });
            Analytics.track("api_request", {
              key,
              ok: true,
              source: "cache_hit",
              duration_ms: 0,
            });
            return cached;
          }
          // Cache stale - fall through to fetch, but return cached data while fetching
          logger.debug(
            "api",
            "QueryCache stale (will revalidate in background):",
            { key },
          );
        }
      } catch (error) {
        logger.warn("api", "QueryCache read error:", { key, error });
        // Continue with normal fetch if cache read fails
      }
    }

    const attachTracking = (p: Promise<T>, started: number): Promise<T> => {
      if (!trackingEnabled) return p;
      return p.then(
        (value) => {
          const duration_ms = Date.now() - started;
          Analytics.track("api_request", { key, ok: true, duration_ms });
          const slowRequestThreshold =
            Analytics.getThreshold?.("slowRequestMs") ?? 3000;
          if (duration_ms > slowRequestThreshold) {
            logger.warn("api", `Slow request: ${key} took ${duration_ms}ms`);
          }
          return value;
        },
        (err) => {
          const duration_ms = Date.now() - started;
          Analytics.track("api_request", {
            key,
            ok: false,
            duration_ms,
            ...sanitizeErrorForAnalytics(err),
          });
          const slowRequestThreshold =
            Analytics.getThreshold?.("slowRequestMs") ?? 3000;
          if (duration_ms > slowRequestThreshold) {
            logger.warn(
              "api",
              `Slow failed request: ${key} took ${duration_ms}ms`,
            );
          }
          throw err;
        },
      );
    };

    try {
      // ========== DEDUPE CHECK ==========
      if (options_.dedupe && this.pendingRequests.has(key)) {
        logger.debug("api", "Returning deduplicated request:", key);
        const pending = this.pendingRequests.get(key)!;
        const deduplicatedPromise = pending.promise as Promise<T>;
        // Note: Duration tracking uses the original request's timestamp (pending.timestamp)
        // not the current request's startedAt, ensuring accurate duration for deduplicated requests
        return deduplicatedPromise.catch((error) => {
          logger.error("api", "Deduplicated request failed:", { key, error });
          this.reportErrorToSentry(error, { key, options: options_ });

          if (options_.failOpen) {
            logger.warn(
              "api",
              "Fail-open enabled for deduplicated request, returning null:",
              key,
            );
            return null;
          }

          throw error;
        });
      }

      // ========== RATE LIMIT CHECK ==========
      if (options_.rateLimitKey) {
        const canProceed = this.checkRateLimit(options_.rateLimitKey);
        if (!canProceed) {
          logger.warn("api", "Rate limited:", options_.rateLimitKey);
          if (options_.failOpen) {
            return null;
          }
          throw new Error(`Rate limit exceeded: ${options_.rateLimitKey}`);
        }
      }

      // ========== EXECUTE WITH RETRY & AUTH ==========
      // Middleware chain (bottom-up execution order):
      // 1. Retry middleware: Retries on failure with exponential backoff
      // 2. Auth layer middleware: Handles 401 responses + token refresh
      // 3. Auth header injection middleware: Prepares Bearer token
      // 4. Actual fetcher: User-provided function (Supabase client, raw fetch, etc.)
      //
      // Usage pattern for fetchers:
      // - Supabase client: Handles auth automatically, just pass the client call
      // - Raw HTTP fetch: Accept `headers` param and merge into fetch options
      //   Example: fetcher(headers) => fetch(url, { headers: {...defaultHeaders, ...headers} })

      // Wrap with auth header injection (if strategy specified)
      // Higher-order function: accepts attemptNumber so AuthContext gets accurate retry count
      const wrappedFetcher =
        (attemptNumber: number = 0) =>
        async () => {
          // ========== INTERCEPTOR: onBeforeRequest ==========
          // Create a fresh requestInit for each retry attempt
          // This ensures each attempt starts with clean state and avoids header accumulation
          // across retries. Interceptors will be called fresh on each attempt.
          const requestInit: RequestInit = {};
          const endpoint = parseEndpoint(key);

          await InterceptorManager.executeBeforeRequestHooks({
            url: key,
            init: requestInit,
            endpoint,
          });

          // Normalize headers to Record<string, string> (supports Headers object, array, or plain object)
          let headers = normalizeHeaders(requestInit.headers);

          if (options_.authStrategy) {
            const context: AuthContext = {
              url: key,
              method: "GET", // Note: Could be enhanced to accept method in options
              endpoint,
              retryCount: attemptNumber,
            };

            // Get headers from auth layer
            const authHeaders = await AuthLayer.injectAuthHeader(
              headers,
              options_.authStrategy,
              context,
            );

            // Update requestInit with new headers
            requestInit.headers = authHeaders;

            logger.debug("api", "Auth middleware: prepared headers", {
              key,
              strategy: options_.authStrategy,
              hasAuth: !!authHeaders["Authorization"],
              attemptNumber,
            });

            // If fetcher accepts headers param, it will use them (e.g., raw fetch wrapper)
            // Otherwise, it's a no-op (e.g., Supabase client handles its own auth)
            return await (fetcher as any)(authHeaders);
          }

          // No auth strategy - just call fetcher directly
          return await (fetcher as any)();
        };

      // Wrap with 401 handling & token refresh
      // Higher-order function: accepts attemptNumber and passes it to auth layer + header injection
      const authLayerWrappedFetcher =
        (attemptNumber: number = 0) =>
        () =>
          this.executeWithAuthLayer(
            wrappedFetcher(attemptNumber),
            key,
            options_.authStrategy!,
            attemptNumber,
          );

      const promise = this.executeWithRetry(
        authLayerWrappedFetcher,
        options_.retries,
        options_.retryDelay,
        options_.timeout,
        undefined, // totalRetries (defaults to retriesLeft)
        {
          key,
          endpoint: parseEndpoint(key),
          authStrategy: options_.authStrategy,
        },
      );

      const trackedPromise = attachTracking(promise, startedAt);

      // ========== QueryCache PERSISTENCE (Optional) ==========
      // If useQueryCache is enabled, persist successful results to cache
      let cachePersistedPromise = trackedPromise;
      if (options_.useQueryCache) {
        cachePersistedPromise = trackedPromise.then(
          async (result: T) => {
            try {
              // Capture version at request start for race condition prevention
              const versionAtStart = QueryCache.getCurrentVersion();

              await QueryCache.set(
                key,
                result,
                {
                  staleTime: options_.staleTime,
                  cacheTime: options_.cacheTime,
                  tags: options_.tags,
                },
                versionAtStart,
              );
              logger.debug("api", "Persisted to QueryCache:", { key });
            } catch (error) {
              logger.warn("api", "QueryCache persistence failed:", {
                key,
                error,
              });
              // Don't throw - cache persistence failure shouldn't break the request
            }
            return result;
          },
          // On error, just rethrow - don't try to cache errors
          (error) => {
            throw error;
          },
        );
      }

      // ========== TRACK PENDING REQUEST ==========
      if (options_.dedupe) {
        this.pendingRequests.set(key, {
          promise: cachePersistedPromise,
          timestamp: startedAt,
        });

        // Clean up pending request after it settles (success or failure).
        // Uses a single .then() call with both onFulfilled and onRejected handlers
        // to avoid creating intermediate promise chains that could accumulate if
        // the same key is reused frequently with deduplication enabled.
        // The second .catch() handles rare cases where the cleanup operation itself
        // might fail (e.g., if the Map is corrupted). These errors are logged for
        // debugging but don't affect the main request result.
        cachePersistedPromise
          .then(
            () => this.pendingRequests.delete(key),
            () => this.pendingRequests.delete(key),
          )
          .catch((cleanupError) => {
            // Log cleanup failures for debugging without blocking the main operation.
            // Cleanup errors are unexpected and indicate potential memory leaks.
            logger.warn(
              "request-manager",
              "Cleanup handler error (unexpected):",
              cleanupError,
            );
          });
      }

      return cachePersistedPromise;
    } catch (error) {
      logger.error("request-manager", "Request failed:", { key, error });

      // ========== SENTRY REPORTING ==========
      this.reportErrorToSentry(error, { key, options: options_ });

      // Tracking for thrown path (in case promise creation failed early)
      const duration_ms = Date.now() - startedAt;
      Analytics.track("api_request", {
        key,
        ok: false,
        duration_ms,
        ...sanitizeErrorForAnalytics(error),
      });

      // ========== FAIL OPEN BEHAVIOR ==========
      if (options_.failOpen) {
        logger.warn(
          "request-manager",
          "Fail-open enabled, returning null:",
          key,
        );
        return null;
      }

      throw error;
    }
  }

  /**
   * Execute a function with exponential backoff retry logic
   *
   * @param fn - Async function to execute
   * @param retriesLeft - Number of retries remaining
   * @param delay - Delay before retry in ms
   * @param timeout - Timeout for the function in ms
   * @returns Result of the function
   */
  /**
   * Execute request with auth layer handling
   * - Injects auth headers if strategy specified
   * - On 401 response: triggers token refresh and retries once
   *
   * @param fetcher - Original request function
   * @param key - Request key for logging
   * @param strategyName - Auth strategy name
   * @param retryCount - Current retry attempt (0 on first)
   * @returns Result from fetcher
   */
  private async executeWithAuthLayer<T>(
    fetcher: () => Promise<T>,
    key: string,
    strategyName: string,
    retryCount: number,
  ): Promise<T> {
    try {
      return await fetcher();
    } catch (error) {
      // Check if this is a 401 Unauthorized response
      // HTTP 401 Unauthorized means authentication failed or token expired
      // (distinct from 403 Forbidden which means auth succeeded but permission denied)
      const status = (error as any)?.status || (error as any)?.code;

      if (status === 401 && retryCount < 1) {
        // Only retry once on 401
        logger.info("api", "Got 401, attempting token refresh", {
          key,
          strategy: strategyName,
        });

        try {
          // OPTIMIZATION: Skip token refresh if offline (no point, will fail anyway)
          // Let offline mode queue the request for retry when connection restored
          const { NetworkDetection } = await import("@/lib/network");
          if (!NetworkDetection.getStatus().isOnline) {
            logger.debug(
              "api",
              "Offline detected—skipping token refresh, letting offline queue handle retry",
              {
                key,
                strategy: strategyName,
              },
            );
            throw error; // Re-throw 401; offline will queue for retry
          }

          // Extract URL and method from error context if available
          // For now, use generic context since fetcher is a black box
          const context: AuthContext = {
            url: key, // Use key as proxy for URL (typically includes URL info)
            method: "GET", // Default; real implementation would pass this through
            endpoint: key.split(":")[0], // Extract endpoint from key pattern
            retryCount: retryCount + 1,
          };

          // Handle 401 with per-strategy locking
          // Phase 2+ Enhancement: Consider rate-limiting per-strategy refreshes if token TTL is short
          // (currently: per-strategy lock prevents thundering herd, but high-frequency refreshes still create 100+ calls for 100 concurrent users)
          await AuthLayer.handle401Response(strategyName, context);

          // Retry the request once after token refresh
          logger.debug("api", "Retrying request after token refresh", {
            key,
            strategy: strategyName,
          });
          return await fetcher();
        } catch (refreshError) {
          // Token refresh failed - check if we should clear auth state
          // Only user-session strategies should trigger logout on auth failure
          // This prevents unrelated 401s (e.g., public/invite/external strategies)
          // from logging out the user
          logger.error("api", "Token refresh failed", {
            key,
            strategy: strategyName,
            error: refreshError,
          });

          // Check if this strategy says we should clear auth on 401
          const strategyObj = AuthLayer.getAuthStrategy(strategyName);
          const shouldClear = strategyObj?.shouldClearAuthStateOn401 ?? false;

          if (shouldClear) {
            try {
              // CRITICAL: Clear auth state as single source of truth for logout
              // This ensures:
              // 1. hasAccount flag is set to false (auth state cleared)
              // 2. SecureStorage is wiped (session data, refresh token cleared)
              // 3. Route guards detect cleared state and redirect to /login
              // 4. Prevents infinite 401 loops (token can't be refreshed)
              logger.warn(
                "api",
                "Clearing auth state due to 401 on auth strategy",
                {
                  key,
                  strategy: strategyName,
                },
              );
              const { AuthStateManager } =
                await import("@/lib/auth/auth-state");
              await AuthStateManager.clearAuthState();
            } catch (clearError) {
              logger.error(
                "api",
                "Failed to clear auth state on refresh failure",
                {
                  error: clearError,
                },
              );
            }
          } else {
            logger.debug(
              "api",
              "Not clearing auth state (strategy does not require it)",
              {
                key,
                strategy: strategyName,
              },
            );
          }

          // Re-throw original 401 error (don't retry)
          throw error;
        }
      }

      // Not a 401 or already retried once - just throw
      throw error;
    }
  }

  /**
   * Execute a request with retry logic and exponential backoff
   *
   * @param fn - Function that accepts attemptNumber and returns an async fetcher
   * @param retriesLeft - Number of retries remaining
   * @param delay - Current delay in ms
   * @param timeout - Timeout per attempt in ms
   * @param totalRetries - Total retries configured (used to calculate attempt number)
   * @param requestContext - Context for error handling (key, endpoint, authStrategy)
   * @returns Result of the function
   */
  private async executeWithRetry<T>(
    fn: (attemptNumber: number) => () => Promise<T>,
    retriesLeft: number,
    delay: number,
    timeout: number,
    totalRetries: number = retriesLeft,
    requestContext?: {
      key: string;
      endpoint?: string;
      authStrategy?: string;
    },
  ): Promise<T> {
    // Calculate current attempt number (0-indexed)
    const attemptNumber = totalRetries - retriesLeft;

    try {
      const result = await this.executeWithTimeout(fn(attemptNumber), timeout);

      // ========== INTERCEPTOR: onAfterResponse ==========
      // Call after successful fetch, before data returned to caller
      if (requestContext) {
        await InterceptorManager.executeAfterResponseHooks({
          data: result,
          cacheKey: requestContext.key,
        });
      }

      return result;
    } catch (error) {
      if (retriesLeft <= 0) {
        // ========== INTERCEPTOR: onError ==========
        // Only call error interceptors when RequestManager exhausts retries
        // (not for AuthLayer 401 handling—that's handled by AuthLayer.onTokenExpire)
        const statusCode = (error as any)?.status || (error as any)?.code;
        const isNetworkError =
          !(error as any)?.status &&
          (error as Error).message.includes("network");

        // Only call error interceptors if not a 401 (401 is handled by AuthLayer)
        if (statusCode !== 401 && requestContext) {
          await InterceptorManager.executeErrorHooks({
            error: error as Error,
            url: requestContext.key,
            init: {}, // Fresh requestInit not available here; onError is observational only
            statusCode,
            isNetworkError,
            endpoint: requestContext.endpoint,
          });
        }

        throw error;
      }

      logger.debug("request-manager", "Retrying after error:", {
        error: (error as Error).message,
        retriesLeft,
        attemptNumber,
        delayMs: delay,
      });

      if (retriesLeft === 1) {
        logger.category("api").warn("Final retry attempt", {
          error: (error as Error).message,
          attemptNumber,
          nextDelay: delay * 2,
        });
      } else {
        logger.category("api").debug("Retrying request", {
          error: (error as Error).message,
          retriesLeft,
          attemptNumber,
          delayMs: delay,
        });
      }

      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Exponential backoff: delay *= 2
      return this.executeWithRetry(
        fn,
        retriesLeft - 1,
        delay * 2,
        timeout,
        totalRetries,
        requestContext,
      );
    }
  }

  /**
   * Execute a function with a timeout
   *
   * @param fn - Async function to execute
   * @param timeout - Timeout in ms
   * @returns Result of the function or throws TimeoutError
   */
  private executeWithTimeout<T>(
    fn: () => Promise<T>,
    timeout: number,
  ): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error(`Request timeout after ${timeout}ms`)),
        timeout,
      );
    });

    return Promise.race([fn(), timeoutPromise])
      .then((result) => {
        // Clear timeout on success
        if (timeoutId !== null) clearTimeout(timeoutId);
        return result;
      })
      .catch((error) => {
        // Clear timeout on error
        if (timeoutId !== null) clearTimeout(timeoutId);
        throw error;
      });
  }

  /**
   * Rate limit check using token bucket algorithm
   *
   * @param key - Rate limit key
   * @returns true if request is allowed, false if rate limited
   */
  private checkRateLimit(key: string): boolean {
    const now = Date.now();
    let bucket = this.rateLimitBuckets.get(key);

    if (!bucket) {
      // First request for this key
      bucket = {
        tokens: RATE_LIMIT_CONFIG.maxTokens,
        lastRefill: now,
        lastAccess: now, // Initialize lastAccess
      };
      this.rateLimitBuckets.set(key, bucket);
    }

    // Update last access time for cleanup purposes
    bucket.lastAccess = now;

    // Refill tokens based on time elapsed (use integer math to avoid floating point drift).
    // Instead of: (timePassed / 1000) * tokensPerSecond, compute as multiplication first
    // then division to maintain integer precision and avoid accumulated rounding errors.
    const timePassed = now - bucket.lastRefill;
    const tokensToAdd = Math.round(
      (timePassed * RATE_LIMIT_CONFIG.tokensPerSecond) / 1000,
    );
    bucket.tokens = Math.min(
      RATE_LIMIT_CONFIG.maxTokens,
      bucket.tokens + tokensToAdd,
    );
    bucket.lastRefill = now;

    // Check if we have tokens
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true;
    }

    return false;
  }

  /**
   * Report request errors to Sentry
   *
   * @param error - The error that occurred
   * @param context - Context about the request
   */
  private reportErrorToSentry(
    error: unknown,
    context: {
      key: string;
      options: Omit<Required<Omit<RequestOptions, "authStrategy">>, never> & {
        authStrategy?: string;
      };
    },
  ): void {
    try {
      Sentry.captureException(error, {
        tags: {
          component: "request-manager",
          requestKey: context.key,
        },
        contexts: {
          request: {
            key: context.key,
            dedupe: context.options.dedupe,
            retries: context.options.retries,
            failOpen: context.options.failOpen,
            timeout: context.options.timeout,
            rateLimited: !!context.options.rateLimitKey,
          },
        },
        level: "error",
      });
    } catch (sentryError) {
      logger.warn(
        "request-manager",
        "Failed to report to Sentry:",
        sentryError,
      );
    }
  }

  /**
   * Get current stats about pending requests and rate limits
   * Useful for debugging and monitoring
   *
   * @returns Stats object with pending requests and rate limit info
   */
  getStats() {
    return {
      pendingRequests: this.pendingRequests.size,
      pendingKeys: Array.from(this.pendingRequests.keys()),
      rateLimitedKeys: Array.from(this.rateLimitBuckets.keys()).filter(
        (key) => {
          const bucket = this.rateLimitBuckets.get(key)!;
          return bucket.tokens < 1;
        },
      ),
    };
  }

  /**
   * Clear all pending requests
   * WARNING: Only use during logout/cleanup
   */
  clearPending(): void {
    logger.debug("request-manager", "Clearing pending requests");
    this.pendingRequests.clear();
  }

  /**
   * Reset rate limits for a specific key or all keys
   *
   * @param key - Optional key to reset, if not provided resets all
   */
  resetRateLimit(key?: string): void {
    if (key) {
      this.rateLimitBuckets.delete(key);
      logger.debug("request-manager", "Reset rate limit for:", key);
    } else {
      this.rateLimitBuckets.clear();
      logger.debug("request-manager", "Reset all rate limits");
    }
  }

  /**
   * Shutdown RequestManager and clean up all resources
   * Should be called during app termination or hard reset
   */
  shutdown(): void {
    logger.debug("request-manager", "Shutting down RequestManager");
    this.stopCleanupTimer();
    this.clearPending();
    this.resetRateLimit();
  }
}

// Create singleton instance
export const RequestManager = new RequestManagerClass();

export default RequestManager;
