import { getAppConfig } from "@/config";
import { AuthLayer, type AuthContext } from "@/lib/auth/auth-layer";
import { enrichError, extractErrorCode } from "@/lib/error";
import {
  buildAdaptiveQueryParams,
  getAdaptivePayloadOptions,
  type PayloadQuality,
} from "@/lib/network";
import { logger } from "@/lib/utils";
import { ERROR_CODES } from "@/maps/ERROR_CODES";
import {
  CircuitBreakerManager,
  CircuitBreakerOpenError,
  DEFAULT_THRESHOLDS,
  type CircuitThresholds,
} from "@/system/API/resilience/circuit-breaker";
import { OfflineQueueManager } from "@/system/API/resilience/offline-queue";
import { NetworkDetection } from "@/system/Network";

// ─── Extracted Modules ─────────────────────────────────────────────
import {
  attachRequestTracking,
  mapErrorCodeCategoryToLogCategory,
  reportErrorToTracker,
  trackRequest,
} from "./request-analytics";
import { RequestCache } from "./request-cache";
import { RequestDeduplication } from "./request-deduplication";
import {
  normalizeHeaders,
  notifyRequestQueued,
  parseEndpoint,
  runBeforeRequestHooks,
  type RequestInterceptor,
} from "./request-interceptors";
import {
  buildQueueEntry,
  FetcherRegistry,
  reconstructFetcherFromEntry,
  shouldQueueRequest,
} from "./request-offline-queue";
import { RequestRateLimiter } from "./request-rate-limiting";
import {
  AbortAndRetry,
  clearRetryQualityState,
  executeWithRetry,
  setRetryQualityState,
} from "./request-retry";

/**
 * Request Manager — Orchestrator
 *
 * Thin coordinator for the API request pipeline. Delegates to focused
 * single-responsibility modules:
 *
 * ┌──────────────────────────────────────────────────────────────┐
 * │                    RequestManager.fetch()                    │
 * │                                                             │
 * │  ┌────────┐  ┌───────┐  ┌──────────┐  ┌────────────────┐  │
 * │  │ Dedupe │→│ Cache │→│ Rate Lim │→│ Circuit Breaker │  │
 * │  └────────┘  └───────┘  └──────────┘  └────────────────┘  │
 * │       ↓                                                     │
 * │  ┌─────────────┐  ┌──────────┐  ┌──────────────────────┐  │
 * │  │ Interceptors│→│ Auth     │→│ Retry + Exp. Backoff │  │
 * │  └─────────────┘  └──────────┘  └──────────────────────┘  │
 * │       ↓                                                     │
 * │  ┌──────────┐  ┌───────────────┐  ┌─────────────────┐     │
 * │  │Analytics │→│ Offline Queue │→│ Abort & Retry   │     │
 * │  └──────────┘  └───────────────┘  └─────────────────┘     │
 * └──────────────────────────────────────────────────────────────┘
 *
 * Modules (each extracted to its own file):
 * - request-deduplication.ts  — In-flight request dedup
 * - request-cache.ts          — QueryCache read/write integration
 * - request-rate-limiting.ts  — Token bucket rate limiting
 * - request-retry.ts          — Retry + exponential backoff + abort-and-retry
 * - request-interceptors.ts   — Before/after/error hook coordination
 * - request-offline-queue.ts  — Offline queue bridge (when/what/how to queue)
 * - request-analytics.ts      — Analytics tracking + error reporting
 *
 * Auth layer (executeWithAuthLayer) remains here — tightly coupled
 * to the fetch orchestration flow and 401 token-refresh semantics.
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

  /** Query parameters to append to request URL. Converted to querystring automatically. (optional) */
  params?: Record<string, string | number | boolean>;

  /** HTTP method for the request (default: 'GET'). Affects abort-and-retry tracking and offline queue entry construction. */
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

  /** Enable automatic adaptive payload parameter injection based on network quality (default: true for HTTP URLs) */
  useAdaptiveParams?: boolean;

  /**
   * Request context for logging, tracing, and interceptor access.
   * Passed to all interceptor hooks, preserved in offline queue entries for replay.
   */
  context?: Record<string, any>;

  /**
   * Idempotency key: sent to backend to prevent duplicate operations.
   * Injected as the 'Idempotency-Key' HTTP header on each request (including retries).
   * Preserved in offline queue entries for at-most-once semantics across replays.
   */
  idempotencyKey?: string;

  /** Auth strategy name for this request (optional). If not specified, request proceeds without auth layer wrapping. */
  authStrategy?: string;

  /** Use QueryCache for data persistence (default: false) */
  useQueryCache?: boolean;

  /** Stale time for QueryCache (only used if useQueryCache is true) */
  staleTime?: number;

  /** Cache time for QueryCache (only used if useQueryCache is true) */
  cacheTime?: number;

  /** Tags for QueryCache invalidation (only used if useQueryCache is true) */
  tags?: string[];

  /** Circuit breaker key (defaults to cache key prefix if not specified; set to null to disable) */
  circuitBreakerKey?: string | null;

  /** Circuit breaker thresholds for this request (overrides global defaults if provided) */
  circuitThresholds?: CircuitThresholds;

  /** Client-specific interceptors to execute for this request */
  interceptors?: RequestInterceptor[];
}

/**
 * Fetcher function types
 *
 * Fetchers are user-provided async functions that perform the actual request.
 * Supports multiple signatures for flexibility:
 * - `() => Promise<T>` – basic (no signal/headers)
 * - `(signal?: AbortSignal) => Promise<T>` – accepts cancellation signal
 * - `(headers?: Record<string,string>, signal?: AbortSignal) => Promise<T>` – accepts both
 */
type FetcherSignature<T> =
  | (() => Promise<T>)
  | ((signal?: AbortSignal) => Promise<T>)
  | ((headers?: Record<string, string>, signal?: AbortSignal) => Promise<T>);

// ==========================================
// Configuration
// ==========================================

/**
 * Get default options from appsettings (for optional fields only)
 */
function getDefaultOptions() {
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
    tags: [] as string[],
    context: undefined as Record<string, any> | undefined,
    idempotencyKey: undefined as string | undefined,
    circuitBreakerKey: undefined as string | null | undefined,
    circuitThresholds: undefined as CircuitThresholds | undefined,
    params: undefined as Record<string, string | number | boolean> | undefined,
    useAdaptiveParams: undefined as boolean | undefined,
  };
}

const DEFAULT_OPTIONS = getDefaultOptions();

// ==========================================
// URL Utilities
// ==========================================

/**
 * Convert params object to querystring.
 * Example: { imageQuality: 'hd', limit: 10 } → 'imageQuality=hd&limit=10'
 */
function paramsToQueryString(
  params: Record<string, string | number | boolean>,
): string {
  return Object.entries(params)
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
    )
    .join("&");
}

/**
 * Append params to a URL/key, handling existing query strings.
 */
function appendParamsToKey(
  key: string,
  params: Record<string, string | number | boolean>,
): string {
  if (Object.keys(params).length === 0) return key;
  const queryString = paramsToQueryString(params);
  const separator = key.includes("?") ? "&" : "?";
  return `${key}${separator}${queryString}`;
}

/**
 * Determine if we should auto-inject adaptive params for this key.
 * Only inject for HTTP-like URLs, not for internal cache keys like 'worlds:list'.
 */
function shouldAutoInjectAdaptiveParams(
  key: string,
  useAdaptiveParams?: boolean,
): boolean {
  if (useAdaptiveParams === false) return false;
  if (useAdaptiveParams === true) return true;
  return key.startsWith("http") || key.startsWith("/");
}

// ==========================================
// Request Manager — Orchestrator
// ==========================================

class RequestManagerClass {
  /** Stale entry threshold: configurable from appsettings (default: 1 hour) */
  private readonly STALE_THRESHOLD =
    getAppConfig().api?.staleThresholdMs ?? 60 * 60 * 1000;

  /** Periodic cleanup timer to prevent memory leaks */
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  /** Cleanup interval: configurable from appsettings (default: 1 hour) */
  private readonly CLEANUP_INTERVAL =
    getAppConfig().api?.cleanupIntervalMs ?? 60 * 60 * 1000;

  /** Hook for offline detection - can short-circuit to fail-open */
  onOfflineDetect?: () => boolean | Promise<boolean>;

  constructor() {
    this.startCleanupTimer();
    AbortAndRetry.subscribe();
  }

  // ==========================================
  // fetch() — Main Orchestration Pipeline
  // ==========================================

  /**
   * Execute a request through the full pipeline: dedupe → cache → rate limit →
   * circuit breaker → interceptors → auth → retry → analytics → offline queue.
   *
   * @param key - Unique key for deduplication (should be deterministic)
   * @param fetcher - Async function that performs the actual request
   * @param options - Request options
   * @returns The result of the fetcher function, or null if failOpen/queued
   */
  async fetch<T>(
    key: string,
    fetcher: FetcherSignature<T>,
    options?: RequestOptions,
  ): Promise<T | null> {
    const options_ = { ...DEFAULT_OPTIONS, ...options } as unknown as Required<
      Omit<RequestOptions, "authStrategy">
    > & { authStrategy?: string };

    const requestContext = options
      ? { context: options.context, idempotencyKey: options.idempotencyKey }
      : {};

    // ── Adaptive Params Injection ──
    let keyWithParams = key;
    let initialAdaptiveQuality: PayloadQuality | undefined;

    if (shouldAutoInjectAdaptiveParams(key, options_.useAdaptiveParams)) {
      const status = NetworkDetection.getStatus();
      if (status) {
        const payloadOptions = getAdaptivePayloadOptions(status);
        const adaptiveParams = buildAdaptiveQueryParams(payloadOptions);
        if (Object.keys(adaptiveParams).length > 0) {
          keyWithParams = appendParamsToKey(keyWithParams, adaptiveParams);
          initialAdaptiveQuality = payloadOptions.imageQuality;
        }
      }
    }

    // ── Params Conversion ──
    if (options_.params) {
      keyWithParams = appendParamsToKey(keyWithParams, options_.params);
    }

    const enrichedKey = keyWithParams;

    // ── Retry Quality State ──
    if (initialAdaptiveQuality && !RequestDeduplication.has(key)) {
      setRetryQualityState(key, {
        attemptNumber: 0,
        initialQuality: initialAdaptiveQuality,
      });
    }

    const startedAt = Date.now();

    // ── Fetcher Registry (for offline replay) ──
    FetcherRegistry.register(enrichedKey, fetcher);

    // ── QueryCache Check ──
    if (options_.useQueryCache) {
      const cacheResult = await RequestCache.read<T>(enrichedKey);
      if (cacheResult.hit && !cacheResult.stale) {
        trackRequest(enrichedKey, true, 0, undefined, {
          source: "cache_hit",
        });
        return cacheResult.data!;
      }
    }

    // Hoist cbKey outside try block so it's available in catch for offline queueing
    let cbKey: string | undefined;

    try {
      // ── Dedupe Check ──
      if (options_.dedupe && RequestDeduplication.has(enrichedKey)) {
        logger.category("api").debug("Returning deduplicated request:", enrichedKey);
        const existing = RequestDeduplication.get(enrichedKey);
        if (existing) {
          return existing.promise.catch((error: unknown) => {
            const errorCode = extractErrorCode(error);
            if (errorCode) {
              const enriched = enrichError(
                error instanceof Error ? error : new Error(String(error)),
                errorCode,
              );
              logger
                .category(mapErrorCodeCategoryToLogCategory(enriched.category))
                .error(
                  `Deduplicated request failed: ${enriched.message}`,
                  enriched.toLogMetadata(),
                );
            } else {
              logger.category("api").error("Deduplicated request failed", {
                key: enrichedKey,
                error,
              });
            }
            reportErrorToTracker(error, {
              key: enrichedKey,
              options: options_,
            });

            if (options_.failOpen) {
              logger
                .category("api")
                .warn("Fail-open for deduplicated request, returning null:", enrichedKey);
              return null;
            }
            throw error;
          }) as Promise<T | null>;
        }
      }

      // ── Rate Limit Check ──
      if (options_.rateLimitKey) {
        if (!RequestRateLimiter.check(options_.rateLimitKey)) {
          logger.category("api").warn("Rate limited", {
            rateLimitKey: options_.rateLimitKey,
          });
          if (options_.failOpen) return null;
          throw new Error(`Rate limit exceeded: ${options_.rateLimitKey}`);
        }
      }

      // ── Circuit Breaker Check ──
      cbKey =
        options_.circuitBreakerKey === null
          ? undefined
          : (options_.circuitBreakerKey ?? parseEndpoint(enrichedKey));

      if (cbKey) {
        const cbState = CircuitBreakerManager.getState(cbKey);

        if (cbState === "Open") {
          const stats = CircuitBreakerManager.getStats(cbKey);
          logger.category("api").warn("Circuit breaker open, fast-failing", {
            endpoint: cbKey,
            recoveryAt: stats.nextRecoveryAt,
          });
          const error = new CircuitBreakerOpenError(
            cbKey,
            "Open",
            stats.nextRecoveryAt ?? 0,
          );

          if (options_.failOpen) return null;

          // Attempt to queue for offline replay
          try {
            const entry = buildQueueEntry(
              enrichedKey,
              options_,
              enrichedKey,
              options?.method ?? "GET",
              requestContext,
            );
            await OfflineQueueManager.enqueue(entry);
            logger.category("api").info(
              "Circuit-breaker open: request queued for offline replay",
              { key: enrichedKey },
            );
            await notifyRequestQueued(
              error,
              enrichedKey,
              cbKey,
              options_.interceptors,
            );
            return null;
          } catch (queueErr) {
            logger.category("api").warn(
              "Failed to queue request while circuit breaker open",
              { key: enrichedKey, error: queueErr },
            );
            throw error;
          }
        }

        // Half-Open: try to acquire probe slot
        if (
          cbState === "Half-Open" &&
          !CircuitBreakerManager.tryAcquireProbe(cbKey)
        ) {
          logger.category("api").debug(
            "Circuit breaker Half-Open probe already in flight, fast-failing:",
            { endpoint: cbKey },
          );
          const stats = CircuitBreakerManager.getStats(cbKey);
          const error = new CircuitBreakerOpenError(
            cbKey,
            "Open",
            stats.nextRecoveryAt ?? 0,
          );
          if (options_.failOpen) return null;
          throw error;
        }
      }

      // ── Create Abort Controller (for adaptive abort-and-retry) ──
      const abortController = new AbortController();
      const method = options?.method ?? 'GET';
      const isSafeMethod = method === 'GET'; // Only safe (idempotent, no side-effects) methods use abort-and-retry

      if (isSafeMethod) {
        AbortAndRetry.track(enrichedKey, abortController);
      }

      // ── Build Fetcher Middleware Chain ──
      // wrappedFetcher: Interceptors → Auth headers → Idempotency → Fetcher
      const wrappedFetcher =
        (attemptNumber: number = 0) =>
        async () => {
          // Run before-request interceptors (fresh per attempt)
          const { requestInit, endpoint } = await runBeforeRequestHooks(
            enrichedKey,
            abortController.signal,
            options_.interceptors,
          );

          let headers = normalizeHeaders(requestInit.headers);

          // Inject idempotency key
          if (requestContext.idempotencyKey) {
            headers["Idempotency-Key"] = requestContext.idempotencyKey;
          }

          if (options_.authStrategy) {
            const context: AuthContext = {
              url: enrichedKey,
              method,
              endpoint,
              retryCount: attemptNumber,
            };

            const authHeaders = await AuthLayer.injectAuthHeader(
              headers,
              options_.authStrategy,
              context,
            );
            requestInit.headers = authHeaders;

            logger.category("api").debug("Auth middleware: prepared headers", {
              key: enrichedKey,
              strategy: options_.authStrategy,
              hasAuth: !!authHeaders["Authorization"],
              attemptNumber,
            });

            return await (fetcher as any)(
              authHeaders,
              abortController.signal,
            );
          }

          return await (fetcher as any)(abortController.signal);
        };

      // Wrap with 401 handling & token refresh
      const authLayerWrappedFetcher =
        (attemptNumber: number = 0) =>
        () =>
          this.executeWithAuthLayer(
            wrappedFetcher(attemptNumber),
            key,
            options_.authStrategy!,
            attemptNumber,
          );

      // ── Execute with Retry ──
      const promise = executeWithRetry(
        authLayerWrappedFetcher,
        options_.retries,
        options_.retryDelay,
        options_.timeout,
        undefined,
        {
          key: enrichedKey,
          endpoint: parseEndpoint(enrichedKey),
          authStrategy: options_.authStrategy,
          interceptors: options_.interceptors,
          context: options_.context,
        },
      );

      // ── Analytics Tracking ──
      const trackedPromise = attachRequestTracking(
        promise,
        enrichedKey,
        startedAt,
      );

      // ── QueryCache Persistence ──
      let cachePersistedPromise = trackedPromise;
      if (options_.useQueryCache) {
        cachePersistedPromise = RequestCache.wrapWithPersistence(
          enrichedKey,
          trackedPromise,
          {
            staleTime: options_.staleTime,
            cacheTime: options_.cacheTime,
            tags: options_.tags,
          },
        );
      }

      // ── Circuit Breaker Recording ──
      let circuitBreakerRecordedPromise = cachePersistedPromise;
      if (cbKey) {
        const thresholds = options_.circuitThresholds;
        const capturedCbKey = cbKey;
        circuitBreakerRecordedPromise = cachePersistedPromise.then(
          (result) => {
            CircuitBreakerManager.recordSuccess(capturedCbKey);
            return result;
          },
          (error) => {
            const isNetworkError =
              error instanceof TypeError ||
              error?.message?.includes("network") ||
              error?.message?.includes("fetch") ||
              error?.name === "AbortError";

            const isAuthError =
              error?.status === ERROR_CODES.HTTP.UNAUTHORIZED ||
              error?.status === ERROR_CODES.HTTP.FORBIDDEN;

            if (!isAuthError) {
              const resolvedThresholds: Required<CircuitThresholds> = {
                failures: thresholds?.failures ?? DEFAULT_THRESHOLDS.failures,
                ratePercent: thresholds?.ratePercent ?? DEFAULT_THRESHOLDS.ratePercent,
                rateWindowMs: thresholds?.rateWindowMs ?? DEFAULT_THRESHOLDS.rateWindowMs,
                baseTimeoutMs: thresholds?.baseTimeoutMs ?? DEFAULT_THRESHOLDS.baseTimeoutMs,
                maxTimeoutMs: thresholds?.maxTimeoutMs ?? DEFAULT_THRESHOLDS.maxTimeoutMs,
                treatNetworkErrors: thresholds?.treatNetworkErrors ?? DEFAULT_THRESHOLDS.treatNetworkErrors,
              };
              CircuitBreakerManager.recordFailure(
                capturedCbKey,
                isNetworkError,
                resolvedThresholds,
              );
            }

            throw error;
          },
        );
      }

      // ── Track Pending Request (Dedupe) ──
      if (options_.dedupe) {
        RequestDeduplication.track(
          enrichedKey,
          circuitBreakerRecordedPromise,
          startedAt,
        );
      }

      // ── Cleanup: In-Flight Tracker ──
      if (isSafeMethod) {
        circuitBreakerRecordedPromise
          .then(
            () => AbortAndRetry.untrack(enrichedKey),
            () => AbortAndRetry.untrack(enrichedKey),
          )
          .catch((cleanupError: unknown) => {
            logger
              .category("api")
              .warn("In-flight tracker cleanup error (unexpected):", cleanupError);
          });
      }

      // ── Cleanup: Retry Quality State ──
      circuitBreakerRecordedPromise
        .then(
          () => {
            if (initialAdaptiveQuality) clearRetryQualityState(key);
          },
          () => {
            // Keep retry state on failure for quality downgrade persistence
          },
        )
        .catch(() => {});

      return await circuitBreakerRecordedPromise;
    } catch (error) {
      const errorCode = extractErrorCode(error);

      // ── Error Reporting ──
      reportErrorToTracker(error, {
        key: enrichedKey,
        options: options_,
        errorCode,
      });

      // NOTE: attachRequestTracking already tracks failures via its .then(null, reject) handler.
      // Only track here for early-exit errors (rate limit, circuit breaker) that bypass the
      // tracked promise chain. The trackRequest call was removed to prevent double-counting.

      // ── Offline Queue ──
      const shouldQueue = await shouldQueueRequest(error, cbKey);
      if (shouldQueue && !options_.failOpen) {
        try {
          const entry = buildQueueEntry(
            enrichedKey,
            options_,
            enrichedKey,
            options?.method ?? "GET",
            requestContext,
          );
          await OfflineQueueManager.enqueue(entry);
          logger.category("api").info("Request queued for offline replay", {
            key: enrichedKey,
          });
          await notifyRequestQueued(
            error as Error,
            enrichedKey,
            cbKey ?? parseEndpoint(enrichedKey),
            options_.interceptors,
          );
          return null;
        } catch (queueError) {
          logger.category("api").warn(
            "Failed to queue request for offline replay",
            { key: enrichedKey, error: queueError },
          );
        }
      }

      // ── Fail Open ──
      if (options_.failOpen) {
        logger.category("api").warn("Fail-open enabled, returning null:", enrichedKey);
        return null;
      }

      throw error;
    }
  }

  // ==========================================
  // Auth Layer (stays here — tightly coupled to fetch flow)
  // ==========================================

  /**
   * Execute request with auth layer handling.
   * - Injects auth headers if strategy specified
   * - On 401 response: triggers token refresh and retries once
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
      const status = (error as any)?.status || (error as any)?.code;

      if (status === ERROR_CODES.HTTP.UNAUTHORIZED && retryCount < 1) {
        logger.category("auth").info("Got 401, attempting token refresh", {
          httpStatus: ERROR_CODES.HTTP.UNAUTHORIZED,
          key,
          strategy: strategyName,
        });

        try {
          // Skip token refresh if offline (NetworkDetection is statically imported at top)
          if (!NetworkDetection.getStatus().isOnline) {
            logger.category("api").debug(
              "Offline detected—skipping token refresh, letting offline queue handle retry",
              { key, strategy: strategyName },
            );
            throw error;
          }

          const context: AuthContext = {
            url: key,
            method: "GET",
            endpoint: key.split(":")[0],
            retryCount: retryCount + 1,
          };

          await AuthLayer.handle401Response(strategyName, context);

          logger.category("api").debug("Retrying request after token refresh", {
            key,
            strategy: strategyName,
          });
          return await fetcher();
        } catch (refreshError) {
          const refreshErrorCode =
            extractErrorCode(refreshError) ||
            ERROR_CODES.AUTH.SESSION_EXPIRED;
          logger.category("auth").error("Token refresh failed", {
            code: refreshErrorCode,
            key,
            strategy: strategyName,
            error: refreshError,
          });

          const strategyObj = AuthLayer.getAuthStrategy(strategyName);
          const shouldClear =
            strategyObj?.shouldClearAuthStateOn401 ?? false;

          if (shouldClear) {
            try {
              logger.category("api").warn(
                "Clearing auth state due to 401 on auth strategy",
                { key, strategy: strategyName },
              );
              const { AuthStateManager } = await import(
                "@/lib/auth/auth-state"
              );
              await AuthStateManager.clearAuthState();
            } catch (clearError) {
              logger.category("api").error(
                "Failed to clear auth state on refresh failure",
                { error: clearError },
              );
            }
          } else {
            logger.category("api").debug(
              "Not clearing auth state (strategy does not require it)",
              { key, strategy: strategyName },
            );
          }

          throw error;
        }
      }

      throw error;
    }
  }

  // ==========================================
  // Public API — Stats, Cleanup, Shutdown
  // ==========================================

  /** Get current stats about pending requests and rate limits. */
  getStats() {
    return {
      pendingRequests: RequestDeduplication.size,
      pendingKeys: RequestDeduplication.keys,
      rateLimitedKeys: RequestRateLimiter.rateLimitedKeys,
    };
  }

  /** Clear all pending requests. WARNING: Only use during logout/cleanup. */
  clearPending(): void {
    logger.category("api").debug("Clearing pending requests");
    RequestDeduplication.clear();
  }

  /** Reset rate limits for a specific key or all keys. */
  resetRateLimit(key?: string): void {
    RequestRateLimiter.reset(key);
  }

  /**
   * Flush offline queue: replay queued requests in FIFO order.
   * @param key - Optional: flush specific key only
   */
  async flushOfflineQueue(key?: string): Promise<void> {
    const allEntries = OfflineQueueManager.getEntries();
    const entries = key
      ? allEntries.filter((e) => e.key === key)
      : allEntries;

    if (entries.length === 0) {
      logger.category("api").debug("No offline queue entries to flush", { key });
      return;
    }

    logger.category("api").info("Flushing offline queue", {
      count: entries.length,
      oldestEntryTime: OfflineQueueManager.getStats().oldestEntryTime,
    });

    for (const entry of entries) {
      try {
        const isEligible = await OfflineQueueManager.recordAttempt(
          entry.key,
        );
        if (!isEligible) {
          logger.category("api").debug(
            "Offline queue entry skipped (max retries exceeded)",
            { key: entry.key },
          );
          continue;
        }

        const replayFetcher = reconstructFetcherFromEntry(entry);
        await this.fetch(entry.key, replayFetcher, entry.options);

        await OfflineQueueManager.dequeue(entry.key);
        logger.category("api").info(
          "Offline queue entry replayed successfully",
          { key: entry.key, attempts: entry.attempts },
        );
      } catch (error) {
        logger.category("api").warn("Offline queue replay failed", {
          key: entry.key,
          attempts: entry.attempts,
          error,
        });
      }
    }
  }

  /** Get offline queue statistics. */
  getOfflineQueueStats() {
    return OfflineQueueManager.getStats();
  }

  /** Clear fetcher registry (used for testing or memory cleanup). */
  clearFetcherRegistry(): void {
    FetcherRegistry.clear();
  }

  // ==========================================
  // Internal — Cleanup
  // ==========================================

  /** Start periodic cleanup of stale entries across all subsystems */
  private startCleanupTimer(): void {
    if (this.cleanupTimer) return;

    this.cleanupTimer = setInterval(() => {
      this.cleanupStaleEntries();
    }, this.CLEANUP_INTERVAL);

    // Make timer non-blocking (won't prevent process exit) on Node.js
    if (
      typeof this.cleanupTimer === "object" &&
      "unref" in this.cleanupTimer
    ) {
      (this.cleanupTimer as any).unref();
    }
  }

  private stopCleanupTimer(): void {
    if (this.cleanupTimer !== null) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /** Cleanup stale entries across all subsystems */
  private cleanupStaleEntries(): void {
    const removedDedup = RequestDeduplication.cleanupStale(
      this.STALE_THRESHOLD,
    );
    const removedRateLimits = RequestRateLimiter.cleanupStale(
      this.STALE_THRESHOLD,
    );
    const removedInFlight = AbortAndRetry.cleanupStale(30 * 60 * 1000); // 30 min for in-flight

    if (removedDedup > 0 || removedRateLimits > 0 || removedInFlight > 0) {
      logger.category("api").debug("Cleanup cycle completed", {
        dedup: removedDedup,
        rateLimits: removedRateLimits,
        inFlight: removedInFlight,
        totalPendingNow: RequestDeduplication.size,
        totalInFlightNow: AbortAndRetry.size,
      });
    }
  }

  /**
   * Shutdown RequestManager and clean up all resources.
   * Should be called during app termination or hard reset.
   */
  shutdown(): void {
    logger.category("api").debug("Shutting down RequestManager");
    this.stopCleanupTimer();
    RequestDeduplication.clear();
    RequestRateLimiter.reset();
    AbortAndRetry.clear();
    AbortAndRetry.unsubscribe();
    FetcherRegistry.clear();
  }
}

// Create singleton instance
export const RequestManager = new RequestManagerClass();

export default RequestManager;
