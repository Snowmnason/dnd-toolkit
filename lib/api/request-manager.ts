import {
  Analytics,
  AnalyticsConsent,
  getCrashReportPayload,
  sanitizeError as sanitizeErrorForAnalytics,
} from "../analytics";
import { QueryCache } from "../cache";
import { getAppConfig } from "../config";
import {
  buildAdaptiveQueryParams,
  captureErrorCorrelation,
  ErrorType,
  getAdaptivePayloadOptions,
  NetworkDetection,
  type PayloadQuality,
} from "../network";
import { getErrorTracker } from "../services";
import { logger } from "../utils/logger";
import { AuthLayer, type AuthContext } from "./auth-layer";
import {
  CircuitBreakerManager,
  CircuitBreakerOpenError,
  DEFAULT_THRESHOLDS,
  type CircuitThresholds,
} from "./circuit-breaker";
import {
  InterceptorManager,
  parseEndpoint,
  type RequestInterceptor,
} from "./interceptor";
import { OfflineQueueManager, type QueuedRequestEntry } from "./offline-queue";

/**
 * Request Manager: Centralized API request layer with:
 * - Request deduplication (avoid duplicate in-flight requests)
 * - Retry logic with exponential backoff
 * - Optional rate limiting (token bucket)
 * - Optional QueryCache integration for data persistence
 * - Fail-open flag (graceful degradation when offline/disabled)
 * - Sentry error reporting
 * - Offline request queuing & replay on reconnect
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

  /** Enable automatic adaptive payload parameter injection based on network quality (default: true for HTTP URLs) */
  useAdaptiveParams?: boolean;

  // ===== Phase 4 Enhancements =====

  /**
   * Request context for logging, tracing, and interceptor access.
   *
   * Passed to all interceptor hooks (onBeforeRequest, onAfterResponse, onError),
   * allowing interceptors to access request-specific metadata without relying on
   * global state or closures. Also preserved in offline queue entries for replay.
   *
   * Example:
   *   context: { userId: 'user_123', feature: 'campaign_creation' }
   */
  context?: Record<string, any>;

  /**
   * Idempotency key: sent to backend to prevent duplicate operations.
   *
   * Injected as the 'Idempotency-Key' HTTP header on each request (including retries).
   * Allows the backend to deduplicate requests and provide at-most-once semantics.
   * Also preserved in offline queue entries, ensuring replayed requests maintain
   * idempotency across app restarts and network disconnections.
   *
   * Example:
   *   idempotencyKey: 'create_campaign_' + Date.now() + '_' + uuid()
   */
  idempotencyKey?: string;

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

  // ===== Circuit Breaker Integration =====

  /** Circuit breaker key (defaults to cache key prefix if not specified; set to null to disable) */
  circuitBreakerKey?: string | null;

  /** Circuit breaker thresholds for this request (overrides global defaults if provided) */
  circuitThresholds?: CircuitThresholds;

  /** Client-specific interceptors to execute for this request */
  interceptors?: RequestInterceptor[];
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

/**
 * Fetcher function types
 *
 * Fetchers are user-provided async functions that perform the actual request.
 * RequestManager supports multiple fetcher signatures for flexibility:
 *
 * 1. **Basic fetcher (no parameters):** `() => Promise<T>`
 *    - Use when you don't need AbortSignal or auth headers
 *    - Example: Supabase client methods, database queries
 *    - ```typescript
 *    const data = await RequestManager.fetch('key', () => supabase.from('table').select());
 *    ```
 *
 * 2. **Fetcher with signal:** `(signal?: AbortSignal) => Promise<T>`
 *    - Use when you need to support cancellation via AbortController
 *    - Example: Raw fetch calls, HTTP clients with cancel support
 *    - ```typescript
 *    const data = await RequestManager.fetch(
 *      'key',
 *      (signal) => fetch(url, { signal })
 *    );
 *    ```
 *
 * 3. **Fetcher with signal and headers:** `(headers?: Record<string,string>, signal?: AbortSignal) => Promise<T>`
 *    - Use for custom HTTP clients that need both auth headers and cancellation
 *    - Example: Custom API wrapper handling auth and requests
 *    - ```typescript
 *    const data = await RequestManager.fetch(
 *      'key',
 *      (headers, signal) => customHttpClient(url, { headers, signal })
 *    );
 *    ```
 *
 * **How it works:**
 * - If your fetcher accepts a signal parameter, RequestManager will pass the AbortController.signal
 * - If your fetcher accepts headers, RequestManager will pass auth headers (if authStrategy is set)
 * - If your fetcher doesn't accept these parameters, they're simply not passed (no error)
 * - The exact parameters passed depend on your context (auth strategy, etc.)
 *
 * **Note on AbortSignal:**
 * RequestManager supports quality downgrade on repeated AbortErrors (from network degradation).
 * For this feature to work, your fetcher must support the signal parameter.
 */
type FetcherSignature<T> = 
  | (() => Promise<T>)
  | ((signal?: AbortSignal) => Promise<T>)
  | ((headers?: Record<string, string>, signal?: AbortSignal) => Promise<T>)

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
  Required<
    Omit<
      RequestOptions,
      | "authStrategy"
      | "circuitBreakerKey"
      | "circuitThresholds"
      | "interceptors"
      | "context"
      | "idempotencyKey"
      | "params"
      | "useAdaptiveParams"
    >
  >,
  never
> & {
  circuitBreakerKey: undefined;
  circuitThresholds: undefined;
  context: undefined;
  idempotencyKey: undefined;
  params: undefined;
  useAdaptiveParams: undefined;
} {
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
    context: undefined,
    idempotencyKey: undefined,
    circuitBreakerKey: undefined,
    circuitThresholds: undefined,
    params: undefined,
    useAdaptiveParams: undefined,
  };
}

const DEFAULT_OPTIONS = getDefaultOptions() as Omit<
  Required<
    Omit<
      RequestOptions,
      | "authStrategy"
      | "circuitBreakerKey"
      | "circuitThresholds"
      | "interceptors"
      | "context"
      | "idempotencyKey"
      | "params"
      | "useAdaptiveParams"
    >
  >,
  never
> & {
  circuitBreakerKey: undefined;
  circuitThresholds: undefined;
  context: undefined;
  idempotencyKey: undefined;
  params: undefined;
  useAdaptiveParams: undefined;
};

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

  /** Registry of fetcher functions for offline queue replay */
  private fetcherRegistry: Map<string, () => Promise<any>> = new Map();

  /**
   * Track in-flight GET requests and their initial network quality
   * Used for abort-and-retry logic when quality degrades mid-request
   * 
   * When network quality degrades significantly during a request:
   * - Abort fetch and retry with lower-quality params (thumbnails, summaries)
   * - Only for queries (GET); mutations handle their own persistence strategy
   * - Prevents long timeouts on requests that started on good connection but hit poor connection mid-way
   * 
   * Example: User starts loading world maps on 4G, drops to 2G mid-request
   * → Abort current fetch → Retry with thumbnail+summaries quality
   */
  private inFlightGetRequests: Map<
    string,
    { effectiveType: string | undefined; startedAt: number; abortController: AbortController; aborted?: boolean }
  > = new Map();

  /** Network quality subscription for abort-and-retry */
  private networkQualityUnsubscribe: (() => void) | null = null;

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

  /** Track current retry state for adaptive param downgrading */
  private currentRetryState: Map<string, { attemptNumber: number; initialQuality?: PayloadQuality }> = new Map();

  constructor() {
    // Start periodic cleanup of stale rate limit buckets
    this.startCleanupTimer();

    // Subscribe to network quality changes for abort-and-retry
    this.subscribeToNetworkQuality();
  }

  /**
   * Convert params object to querystring
   * Example: { imageQuality: 'hd', limit: 10 } → 'imageQuality=hd&limit=10'
   */
  private paramsToQueryString(params: Record<string, string | number | boolean>): string {
    const entries = Object.entries(params).map(([key, value]) => {
      return `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`;
    });
    return entries.join('&');
  }

  /**
   * Append params to a URL/key, handling existing query strings
   */
  private appendParamsToKey(key: string, params: Record<string, string | number | boolean>): string {
    if (Object.keys(params).length === 0) return key;
    const queryString = this.paramsToQueryString(params);
    const separator = key.includes('?') ? '&' : '?';
    return `${key}${separator}${queryString}`;
  }

  /**
   * Downgrade adaptive quality for retry attempts
   * Maps: hd → sd → thumb → text-only
   * Used when a request aborts/times out and we retry with lower quality hints
   */
  private downgradeAdaptiveQuality(quality: PayloadQuality): PayloadQuality {
    const degradeMap: Record<PayloadQuality, PayloadQuality> = {
      'hd': 'sd',
      'sd': 'thumb',
      'thumb': 'text-only',
      'text-only': 'text-only', // Already at minimum
    };
    return degradeMap[quality];
  }

  /**
   * Determine if we should auto-inject adaptive params for this key
   * Only inject for HTTP-like URLs, not for internal cache keys like 'worlds:list'
   */
  private shouldAutoInjectAdaptiveParams(key: string, useAdaptiveParams?: boolean): boolean {
    // Explicit disable
    if (useAdaptiveParams === false) return false;
    // Explicit enable
    if (useAdaptiveParams === true) return true;
    // Default: only for HTTP-like URLs (default auto-injection for external requests)
    return key.startsWith('http') || key.startsWith('/');
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
   * Track a GET request's initial network quality with abort controller
   * Used for abort-and-retry logic when quality degrades mid-request
   * 
   * @param key - Cache key or URL of the request
   * @param abortController - AbortController for this request
   */
  private trackInFlightGetRequest(key: string, abortController: AbortController): void {
    const status = NetworkDetection.getStatus();
    if (!status) {
      return;
    }

    this.inFlightGetRequests.set(key, {
      effectiveType: status.effectiveType,
      startedAt: Date.now(),
      abortController,
    });
  }

  /**
   * Untrack a GET request after it completes
   * 
   * @param key - Cache key or URL of the request
   */
  private untrackInFlightGetRequest(key: string): void {
    this.inFlightGetRequests.delete(key);
  }

  /**
   * Subscribe to network quality changes and abort in-flight GETs on significant degradation
   */
  private subscribeToNetworkQuality(): void {
    this.networkQualityUnsubscribe = NetworkDetection.subscribe((status) => {
      // Check all in-flight GET requests for degradation
      const entries = Array.from(this.inFlightGetRequests.entries());
      
      for (const [key, entry] of entries) {
        // Skip entries that have already been aborted to prevent redundant abort calls
        // when network quality changes multiple times before the request cleanup completes
        if (entry.aborted) {
          continue;
        }

        if (this.shouldAbortAndRetryDueToQualityDegradation(key, 2000)) {
          logger.info('api', 'Aborting in-flight GET due to quality degradation', {
            key,
            startQuality: entry.effectiveType,
            currentQuality: status.effectiveType,
            ageMs: Date.now() - entry.startedAt,
          });

          // Mark as aborted to prevent redundant abort calls if quality changes again
          // before the promise cleanup removes this entry from tracking
          entry.aborted = true;

          // Abort the request - the retry will happen automatically via the catch block
          entry.abortController.abort();
        }
      }
    });
  }

  /**
   * Check if quality degradation should trigger abort-and-retry for in-flight request
   * 
   * Conservative thresholds:
   * - Only abort if quality degraded by ≥2 tiers (e.g., 4g → 2g)
   * - Only abort if request has been in-flight > 2s (give fast requests time to complete)
   * - Never abort upgrades (2g → 4g) - let original request finish
   * - Skip entries already marked as aborted (prevents race condition on repeated quality changes)
   * 
   * Example: Started on 4G, now on 2G → true (abort and retry with thumbnails)
   * Example: Started on 3G, now on 3G → false (no degradation)
   * Example: Started on 2G, now on 4G → false (upgraded, complete original request)
   * 
   * @param key - Cache key or URL
   * @param maxAgeMsForRetry - Only retry if request has been in-flight longer than this (ms)
   * @returns true if quality degraded enough to warrant abort-retry, false otherwise
   */
  private shouldAbortAndRetryDueToQualityDegradation(
    key: string,
    maxAgeMsForRetry: number = 2000, // Only retry if in-flight > 2s
  ): boolean {
    const inFlightRequest = this.inFlightGetRequests.get(key);
    if (!inFlightRequest) {
      return false;
    }

    // Skip requests already marked as aborted to prevent redundant abort calls
    // when network quality changes multiple times before cleanup completes
    if (inFlightRequest.aborted) {
      return false;
    }

    // If request is very young, don't abort yet - give it a chance to complete
    const age = Date.now() - inFlightRequest.startedAt;
    if (age < maxAgeMsForRetry) {
      return false;
    }

    const currentStatus = NetworkDetection.getStatus();
    if (!currentStatus) {
      return false;
    }

    // Quality rank: 4g > 3g > 2g > slow-2g > offline
    const qualityRank = {
      '4g': 5,
      '3g': 4,
      '2g': 3,
      'slow-2g': 2,
      'offline': 1,
      'unknown': 3, // Treat unknown as 2g-equivalent
    } as const;

    // Type-safe helper to get quality rank (eliminates object injection warnings)
    const getRank = (quality: string | undefined): number => {
      if (!quality) return qualityRank.unknown;
      const rank = qualityRank[quality as keyof typeof qualityRank];
      return rank ?? qualityRank.unknown;
    };

    const startQuality = inFlightRequest.effectiveType;
    const currentQuality = currentStatus.effectiveType;

    const startRank = getRank(startQuality);
    const currentRank = getRank(currentQuality);

    // Only abort if quality degraded by at least 2 tiers (e.g., 4g → 2g)
    // Minor degradation (4g → 3g) not worth aborting
    const DEGRADATION_THRESHOLD = 2;
    const degradation = startRank - currentRank;

    return degradation >= DEGRADATION_THRESHOLD;
  }

  /**
   * Remove stale rate limit bucket entries that haven't been accessed
   * This prevents unbounded memory growth in long-running applications
   */
  private cleanupStaleEntries(): void {
    const now = Date.now();
    let removedBuckets = 0;
    let removedRequests = 0;
    let removedInFlightRequests = 0;

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

    // Clean up stale in-flight GET request tracking (older than 30 minutes)
    // These should normally be removed by untrackInFlightGetRequest, but cleanup handles edge cases
    const inFlightEntries = Array.from(this.inFlightGetRequests.entries());
    for (const [key, entry] of inFlightEntries) {
      if (now - entry.startedAt > 30 * 60 * 1000) {
        // 30 minutes
        this.inFlightGetRequests.delete(key);
        removedInFlightRequests++;
      }
    }

    if (removedBuckets > 0 || removedRequests > 0 || removedInFlightRequests > 0) {
      logger.category("api").debug("Cleanup cycle completed", {
        buckets: removedBuckets,
        requests: removedRequests,
        inFlightGetRequests: removedInFlightRequests,
        totalPendingNow: this.pendingRequests.size,
        totalBucketsNow: this.rateLimitBuckets.size,
        totalInFlightNow: this.inFlightGetRequests.size,
      });
    }
  }

  /**
   * Execute a request with optional dedupe, retry, rate limiting, and QueryCache
   *
   * @param key - Unique key for deduplication (should be deterministic)
   * @param fetcher - Async function that performs the actual request
   *   Supports multiple signatures:
   *   - `() => Promise<T>` – basic fetcher (no signal/headers)
   *   - `(signal?: AbortSignal) => Promise<T>` – accepts cancellation signal
   *   - `(headers?: Record<string,string>, signal?: AbortSignal) => Promise<T>` – accepts both
   *   See FetcherSignature type docs for details and examples.
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
   *
   * // With adaptive payloads (automatically adjusts quality based on network)
   * import { appendAdaptiveParams } from '@/lib/network';
   * const key = appendAdaptiveParams('worlds:list'); // Adds ?imageQuality=hd&...
   * const data = await RequestManager.fetch(key, () => fetcher());
   *
   * // With AbortSignal support for cancellation on network degradation
   * const data = await RequestManager.fetch(
   *   url,
   *   (signal) => fetch(url, { signal })
   * );
   * ```
   */
  async fetch<T>(
    key: string,
    fetcher: FetcherSignature<T>,
    options?: RequestOptions,
  ): Promise<T | null> {
    // Create options with all defaults applied
    const options_ = { ...DEFAULT_OPTIONS, ...options } as unknown as Required<
      Omit<RequestOptions, "authStrategy">
    > & { authStrategy?: string };

    // Extract context and idempotencyKey for later use, since they're optional
    const requestContext = options
      ? { context: options.context, idempotencyKey: options.idempotencyKey }
      : {};

    // ========== ADAPTIVE PARAMS INJECTION ==========
    // Auto-append adaptive quality params based on network connection
    // Only for HTTP-like URLs; internal cache keys are not modified
    let keyWithParams = key;
    let initialAdaptiveQuality: PayloadQuality | undefined;
    
    if (this.shouldAutoInjectAdaptiveParams(key, options_.useAdaptiveParams)) {
      const status = NetworkDetection.getStatus();
      if (status) {
        const payloadOptions = getAdaptivePayloadOptions(status);
        const adaptiveParams = buildAdaptiveQueryParams(payloadOptions);
        if (Object.keys(adaptiveParams).length > 0) {
          keyWithParams = this.appendParamsToKey(keyWithParams, adaptiveParams);
          initialAdaptiveQuality = payloadOptions.imageQuality;
        }
      }
    }

    // ========== PARAMS CONVERSION ==========
    // Convert options.params to querystring and append to key
    if (options_.params) {
      keyWithParams = this.appendParamsToKey(keyWithParams, options_.params);
    }

    // Use the enriched key for all downstream operations (dedupe, cache, etc.)
    const enrichedKey = keyWithParams;

    // ========== RETRY STATE TRACKING (for quality downgrade on abort) ==========
    // Track current quality for this base key so we can downgrade on AbortError
    // This enables progressive quality degradation on network failures
    if (initialAdaptiveQuality) {
      const existingState = this.currentRetryState.get(key);
      if (!existingState) {
        // First attempt: initialize with current quality
        this.currentRetryState.set(key, {
          attemptNumber: 0,
          initialQuality: initialAdaptiveQuality,
        });
      }
      // On subsequent retries with the same key, the state persists
      // and will be updated if quality is downgraded
    }

    const startedAt = Date.now();
    const trackingEnabled = Analytics.enabled();

    // ========== FETCHER REGISTRY (for offline replay) ==========
    // Register this fetcher for offline queue replay
    // This allows queued requests to be replayed with the original fetcher function
    this.fetcherRegistry.set(enrichedKey, fetcher);

    // ========== QueryCache CHECK (Optional) ==========
    // If useQueryCache is enabled, check cache first before dedupe/retry logic
    if (options_.useQueryCache) {
      try {
        const cached = await QueryCache.get<T>(enrichedKey);
        if (cached !== undefined && cached !== null) {
          const isStale = await QueryCache.isStale(enrichedKey);
          if (!isStale) {
            // Cache hit and not stale - return immediately
            logger.debug("api", "QueryCache hit (not stale):", { key: enrichedKey });
            Analytics.track("api_request", {
              key: enrichedKey,
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
            { key: enrichedKey },
          );
        }
      } catch (error) {
        logger.warn("api", "QueryCache read error:", { key: enrichedKey, error });
        // Continue with normal fetch if cache read fails
      }
    }

    const attachTracking = (p: Promise<T>, started: number): Promise<T> => {
      if (!trackingEnabled) return p;
      return p.then(
        (value) => {
          const duration_ms = Date.now() - started;
          Analytics.track("api_request", { key: enrichedKey, ok: true, duration_ms });
          const slowRequestThreshold =
            Analytics.getThreshold?.("slowRequestMs") ?? 3000;
          if (duration_ms > slowRequestThreshold) {
            logger.warn("api", `Slow request: ${enrichedKey} took ${duration_ms}ms`);
          }
          return value;
        },
        (err) => {
          const duration_ms = Date.now() - started;
          Analytics.track("api_request", {
            key: enrichedKey,
            ok: false,
            duration_ms,
            ...sanitizeErrorForAnalytics(err),
          });
          const slowRequestThreshold =
            Analytics.getThreshold?.("slowRequestMs") ?? 3000;
          if (duration_ms > slowRequestThreshold) {
            logger.warn(
              "api",
              `Slow failed request: ${enrichedKey} took ${duration_ms}ms`,
            );
          }
          throw err;
        },
      );
    };

    // Hoist cbKey outside try block so it's available in catch block for offline queueing
    let cbKey: string | undefined;

    try {
      // ========== DEDUPE CHECK ==========
      if (options_.dedupe && this.pendingRequests.has(enrichedKey)) {
        logger.debug("api", "Returning deduplicated request:", enrichedKey);
        const pending = this.pendingRequests.get(enrichedKey)!;
        const deduplicatedPromise = pending.promise as Promise<T>;
        // Note: Duration tracking uses the original request's timestamp (pending.timestamp)
        // not the current request's startedAt, ensuring accurate duration for deduplicated requests
        return deduplicatedPromise.catch((error) => {
          logger.error("api", "Deduplicated request failed:", { key: enrichedKey, error });
          this.reportErrorToTracker(error, { key: enrichedKey, options: options_ });

          if (options_.failOpen) {
            logger.warn(
              "api",
              "Fail-open enabled for deduplicated request, returning null:",
              enrichedKey,
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

      // ========== CIRCUIT BREAKER CHECK ==========
      cbKey =
        options_.circuitBreakerKey === null
          ? undefined
          : (options_.circuitBreakerKey ?? parseEndpoint(enrichedKey));

      if (cbKey) {
        const cbState = CircuitBreakerManager.getState(cbKey);
        if (cbState === "Open") {
          const stats = CircuitBreakerManager.getStats(cbKey);
          logger.warn("api", "Circuit breaker open, fast-failing:", {
            endpoint: cbKey,
            recoveryAt: stats.nextRecoveryAt,
          });
          const error = new CircuitBreakerOpenError(
            cbKey,
            "Open",
            stats.nextRecoveryAt ?? 0,
          );
          // If caller chose failOpen, short-circuit and return null
          if (options_.failOpen) {
            return null;
          }

          // Otherwise, attempt to queue the request for offline replay instead
          try {
            const entry = this._buildQueueEntry(
              enrichedKey,
              options_,
              enrichedKey, // URL defaults to key
              "POST",
              requestContext, // Pass context and idempotencyKey for queue preservation
            );
            await OfflineQueueManager.enqueue(entry);
            logger.info(
              "api",
              "Circuit-breaker open: request queued for offline replay",
              { key: enrichedKey },
            );

            // Notify error interceptors that the request was queued
            try {
              await InterceptorManager.executeErrorHooks(
                {
                  error,
                  url: enrichedKey,
                  init: {},
                  statusCode: (error as any)?.status || (error as any)?.code,
                  isNetworkError: false,
                  endpoint: cbKey,
                  queued: true,
                },
                options_.interceptors,
              );
            } catch (hookErr) {
              logger.warn(
                "api",
                "Interceptor error while reporting queued circuit-breaker request",
                hookErr,
              );
            }

            return null;
          } catch (queueErr) {
            logger.warn(
              "api",
              "Failed to queue request while circuit breaker open, falling back to error",
              { key: enrichedKey, error: queueErr },
            );
            // If queuing failed, fall back to throwing the original circuit error
            throw error;
          }
        }

        // If Half-Open, try to acquire probe slot
        if (
          cbState === "Half-Open" &&
          !CircuitBreakerManager.tryAcquireProbe(cbKey)
        ) {
          logger.debug(
            "api",
            "Circuit breaker Half-Open probe already in flight, fast-failing:",
            {
              endpoint: cbKey,
            },
          );
          const stats = CircuitBreakerManager.getStats(cbKey);
          const error = new CircuitBreakerOpenError(
            cbKey,
            "Open",
            stats.nextRecoveryAt ?? 0,
          );
          if (options_.failOpen) {
            return null;
          }
          throw error;
        }
      }

      // ========== CREATE ABORT CONTROLLER FOR ADAPTIVE ABORT-AND-RETRY ==========
      // Create AbortController for this request to support abort-and-retry on quality degradation
      // Only used for GET requests (mutations rely on offline queue for resilience)
      const abortController = new AbortController();
      const isGetRequest = true; // TODO: Accept method in options; default to GET for now

      // Track this request for abort-and-retry if it's a GET
      if (isGetRequest) {
        this.trackInFlightGetRequest(enrichedKey, abortController);
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
          const requestInit: RequestInit = {
            signal: abortController.signal, // Add abort signal for quality-based abort-and-retry
          };
          const endpoint = parseEndpoint(enrichedKey);

          await InterceptorManager.executeBeforeRequestHooks(
            {
              url: enrichedKey,
              init: requestInit,
              endpoint,
            },
            options_.interceptors,
          );

          // Normalize headers to Record<string, string> (supports Headers object, array, or plain object)
          let headers = normalizeHeaders(requestInit.headers);

          // ========== INJECT IDEMPOTENCY KEY ==========
          // If provided, add Idempotency-Key header for at-most-once semantics
          // This allows the backend to deduplicate requests and prevent duplicate operations
          if (requestContext.idempotencyKey) {
            headers["Idempotency-Key"] = requestContext.idempotencyKey;
          }

          if (options_.authStrategy) {
            const context: AuthContext = {
              url: enrichedKey,
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
              key: enrichedKey,
              strategy: options_.authStrategy,
              hasAuth: !!authHeaders["Authorization"],
              attemptNumber,
            });

            // Call fetcher with auth headers and abort signal (if it accepts them)
            // Fetchers can have different signatures:
            // - () => Promise<T> – ignores both parameters
            // - (signal) => Promise<T> – uses signal, ignores headers
            // - (headers, signal) => Promise<T> – uses both
            // We use 'as any' to avoid type errors when passing optional parameters
            // the fetcher may or may not accept. JavaScript allows this gracefully.
            return await (fetcher as any)(authHeaders, abortController.signal);
          }

          // No auth strategy - just call fetcher directly with signal (if it accepts it)
          // Fetchers that don't accept parameters simply ignore them.
          return await (fetcher as any)(abortController.signal);
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
          key: enrichedKey,
          endpoint: parseEndpoint(enrichedKey),
          authStrategy: options_.authStrategy,
          interceptors: options_.interceptors,
          context: options_.context, // Pass context through retry chain
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
                enrichedKey,
                result,
                {
                  staleTime: options_.staleTime,
                  cacheTime: options_.cacheTime,
                  tags: options_.tags,
                },
                versionAtStart,
              );
              logger.debug("api", "Persisted to QueryCache:", { key: enrichedKey });
            } catch (error) {
              logger.warn("api", "QueryCache persistence failed:", {
                key: enrichedKey,
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

      // ========== CIRCUIT BREAKER RECORDING ==========
      // Record success/failure in the promise chain
      // This happens after all other processing (caching, auth, etc.)
      // so the circuit breaker sees the actual outcome
      let circuitBreakerRecordedPromise = cachePersistedPromise;
      if (cbKey) {
        const thresholds = options_.circuitThresholds;
        circuitBreakerRecordedPromise = cachePersistedPromise.then(
          (result) => {
            // Success: record success in circuit breaker
            CircuitBreakerManager.recordSuccess(cbKey!);
            return result;
          },
          (error) => {
            // Failure: determine if it's a network error
            const isNetworkError =
              error instanceof TypeError ||
              error?.message?.includes("network") ||
              error?.message?.includes("fetch") ||
              error?.name === "AbortError";

            // Skip recording auth errors (401, 403) - AuthLayer handles these separately
            // and they should not trigger circuit breaker failures
            const isAuthError = error?.status === 401 || error?.status === 403;

            if (!isAuthError) {
              // Record failure in circuit breaker
              CircuitBreakerManager.recordFailure(
                cbKey!,
                isNetworkError,
                thresholds
                  ? {
                      failures:
                        thresholds.failures ?? DEFAULT_THRESHOLDS.failures,
                      ratePercent:
                        thresholds.ratePercent ??
                        DEFAULT_THRESHOLDS.ratePercent,
                      rateWindowMs:
                        thresholds.rateWindowMs ??
                        DEFAULT_THRESHOLDS.rateWindowMs,
                      baseTimeoutMs:
                        thresholds.baseTimeoutMs ??
                        DEFAULT_THRESHOLDS.baseTimeoutMs,
                      maxTimeoutMs:
                        thresholds.maxTimeoutMs ??
                        DEFAULT_THRESHOLDS.maxTimeoutMs,
                      treatNetworkErrors:
                        thresholds.treatNetworkErrors ??
                        DEFAULT_THRESHOLDS.treatNetworkErrors,
                    }
                  : undefined,
              );
            }

            // Rethrow the error so it propagates to the caller
            throw error;
          },
        );
      }

      // ========== TRACK PENDING REQUEST ==========
      if (options_.dedupe) {
        this.pendingRequests.set(enrichedKey, {
          promise: circuitBreakerRecordedPromise,
          timestamp: startedAt,
        });

        // Clean up pending request after it settles (success or failure).
        // Uses a single .then() call with both onFulfilled and onRejected handlers
        // to avoid creating intermediate promise chains that could accumulate if
        // the same key is reused frequently with deduplication enabled.
        // The second .catch() handles rare cases where the cleanup operation itself
        // might fail (e.g., if the Map is corrupted). These errors are logged for
        // debugging but don't affect the main request result.
        circuitBreakerRecordedPromise
          .then(
            () => this.pendingRequests.delete(enrichedKey),
            () => this.pendingRequests.delete(enrichedKey),
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

      // ========== CLEAN UP IN-FLIGHT TRACKER (ABORT-AND-RETRY) ==========
      // Remove from in-flight tracking when request completes (success or failure)
      // This cleanup is separate from deduplication tracking because abort-and-retry
      // specifically monitors in-flight GET requests for network quality degradation
      if (isGetRequest) {
        circuitBreakerRecordedPromise
          .then(
            () => this.untrackInFlightGetRequest(enrichedKey),
            () => this.untrackInFlightGetRequest(enrichedKey),
          )
          .catch((cleanupError) => {
            logger.warn(
              "request-manager",
              "In-flight tracker cleanup error (unexpected):",
              cleanupError,
            );
          });
      }

      // ========== CLEAN UP RETRY STATE (on final success) ==========
      // Clear retry state when request succeeds to allow next fresh request
      // to start with full quality again (don't persist downgrades across cycles)
      circuitBreakerRecordedPromise
        .then(
          () => {
            // Request succeeded: clear the retry state so next fetch() starts fresh
            if (initialAdaptiveQuality) {
              this.currentRetryState.delete(key);
            }
          },
          () => {
            // Request failed: keep retry state so quality downgrade persists
            // for future retry attempts by interested callers (hooks/UI)
          },
        )
        .catch(() => {
          // Cleanup errors are OK; they don't affect the main request result
        });

      return await circuitBreakerRecordedPromise;
    } catch (error) {
      logger.error("request-manager", "Request failed:", { key: enrichedKey, error });

      // ========== ERROR TRACKER REPORTING ==========
      this.reportErrorToTracker(error, { key: enrichedKey, options: options_ });

      // Tracking for thrown path (in case promise creation failed early)
      const duration_ms = Date.now() - startedAt;
      Analytics.track("api_request", {
        key: enrichedKey,
        ok: false,
        duration_ms,
        ...sanitizeErrorForAnalytics(error),
      });

      // ========== OFFLINE QUEUE (Optional) ==========
      // Queue request for replay if offline or circuit is open
      // Pass cbKey so circuit breaker state is checked when deciding to queue
      const shouldQueue = await this._shouldQueueRequest(error, cbKey);
      if (shouldQueue && !options_.failOpen) {
        try {
          const entry = this._buildQueueEntry(
            enrichedKey,
            options_,
            enrichedKey, // URL defaults to key
            "POST", // Default method (could be enhanced to accept method in options)
            requestContext, // Pass context and idempotencyKey for queue preservation
          );
          await OfflineQueueManager.enqueue(entry);
          logger.info("api", "Request queued for offline replay", { key: enrichedKey });
          // Notify error interceptors that the request was queued
          try {
            await InterceptorManager.executeErrorHooks(
              {
                error: error as Error,
                url: enrichedKey,
                init: {},
                statusCode: (error as any)?.status || (error as any)?.code,
                isNetworkError: false,
                endpoint: cbKey ?? parseEndpoint(enrichedKey),
                queued: true,
              },
              options_.interceptors,
            );
          } catch (hookErr) {
            logger.warn(
              "api",
              "Interceptor error while reporting queued request",
              hookErr,
            );
          }

          // Don't throw - queued successfully, return null as if failOpen was true
          return null;
        } catch (queueError) {
          logger.warn("api", "Failed to queue request for offline replay", {
            key: enrichedKey,
            error: queueError,
          });
          // Fall through to normal error handling
        }
      }

      // ========== FAIL OPEN BEHAVIOR ==========
      if (options_.failOpen) {
        logger.warn(
          "request-manager",
          "Fail-open enabled, returning null:",
          enrichedKey,
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
      interceptors?: RequestInterceptor[];
      context?: Record<string, any>; // Pass context through interceptor hooks
    },
  ): Promise<T> {
    // Calculate current attempt number (0-indexed)
    const attemptNumber = totalRetries - retriesLeft;

    try {
      const result = await this.executeWithTimeout(fn(attemptNumber), timeout);

      // ========== INTERCEPTOR: onAfterResponse ==========
      // Call after successful fetch, before data returned to caller
      if (requestContext) {
        await InterceptorManager.executeAfterResponseHooks(
          {
            data: result,
            cacheKey: requestContext.key,
          },
          requestContext.interceptors,
        );
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
          await InterceptorManager.executeErrorHooks(
            {
              error: error as Error,
              url: requestContext.key,
              init: {}, // Fresh requestInit not available here; onError is observational only
              statusCode,
              isNetworkError,
              endpoint: requestContext.endpoint,
            },
            requestContext.interceptors,
          );
        }

        // ========== TELEMETRY: Capture error correlation ==========
        // Capture error + network quality snapshot for Phase 1c analysis
        const errorMsg = (error as Error)?.message || String(error);
        let mappedErrorType = ErrorType.OTHER;
        if (errorMsg.includes("timeout") || errorMsg.includes("AbortError")) {
          mappedErrorType = ErrorType.TIMEOUT;
        } else if (errorMsg.includes("DNS") || errorMsg.includes("dns")) {
          mappedErrorType = ErrorType.DNS_FAIL;
        } else if (errorMsg.includes("connection reset") || errorMsg.includes("ECONNRESET")) {
          mappedErrorType = ErrorType.CONNECTION_RESET;
        } else if (statusCode && statusCode >= 500) {
          mappedErrorType = ErrorType.HTTP_5XX;
        } else if (statusCode && statusCode >= 400 && statusCode < 500) {
          mappedErrorType = ErrorType.HTTP_4XX;
        }
        captureErrorCorrelation(mappedErrorType, errorMsg, statusCode);

        throw error;
      }

      // ========== DETECT ABORT-AND-RETRY ==========
      // If this is an AbortError, it was triggered by network quality degradation
      // Downgrade the requested quality and log it for monitoring
      const isAbortError = (error as any)?.name === "AbortError";
      if (isAbortError && requestContext) {
        // Downgrade quality for next retry attempt
        // Note: The downgraded quality will be used the next time fetch() is called
        // for this key, since enrichedKey is computed at the start of fetch()
        const retryState = this.currentRetryState.get((requestContext as any).baseKey || requestContext.key);
        if (retryState && retryState.initialQuality && retryState.initialQuality !== 'text-only') {
          const currentQuality = retryState.initialQuality;
          const downgradedQuality = this.downgradeAdaptiveQuality(currentQuality);
          retryState.initialQuality = downgradedQuality;
          logger.info("api", "Downgrading image quality on abort", {
            key: requestContext.key,
            from: currentQuality,
            to: downgradedQuality,
            attemptNumber,
            retriesLeft,
          });
        } else {
          logger.debug("api", "Request aborted due to network quality degradation", {
            key: requestContext.key,
            attemptNumber,
            retriesLeft,
            quality: retryState?.initialQuality || 'unknown',
          });
        }
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
   * Report request errors to error tracker
   *
   * @param error - The error that occurred
   * @param context - Context about the request
   */
  private reportErrorToTracker(
    error: unknown,
    context: {
      key: string;
      options: Omit<Required<Omit<RequestOptions, "authStrategy">>, never> & {
        authStrategy?: string;
        interceptors?: RequestInterceptor[];
      };
    },
  ): void {
    try {
      // Convert error to Error instance if needed
      const errorObj = error instanceof Error ? error : new Error(String(error));
      
      // Get tiered payload based on consent level
      const captureOptions = getCrashReportPayload(errorObj, undefined, AnalyticsConsent.getLevel());
      
      if (captureOptions !== null) {
        // Merge request-specific context into the tiered payload
        const mergedOptions = {
          ...captureOptions,
          tags: {
            ...(captureOptions.tags || {}),
            component: "request-manager",
            requestKey: context.key,
          },
          contexts: {
            ...(captureOptions.contexts || {}),
            request: {
              key: context.key,
              dedupe: context.options.dedupe,
              retries: context.options.retries,
              failOpen: context.options.failOpen,
              timeout: context.options.timeout,
              rateLimited: !!context.options.rateLimitKey,
            },
          },
        };
        
        getErrorTracker().captureException(errorObj, mergedOptions);
      } else {
        logger.warn(
          "request-manager",
          "Error not sent to error tracker (consent=none; awaiting user opt-in)",
        );
      }
    } catch (trackerError) {
      logger.warn(
        "request-manager",
        "Failed to report to error tracker:",
        trackerError,
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
   * Flush offline queue: replay queued requests in FIFO order
   * Call manually to force replay, or automatically triggered on reconnect
   *
   * @param key - Optional: flush specific key only. If omitted, flushes all queued requests
   */
  async flushOfflineQueue(key?: string): Promise<void> {
    const allEntries = OfflineQueueManager.getEntries();
    const entries = key ? allEntries.filter((e) => e.key === key) : allEntries;

    if (entries.length === 0) {
      logger.debug("api", "No offline queue entries to flush", { key });
      return;
    }

    logger.info("api", "Flushing offline queue", {
      count: entries.length,
      oldestEntryTime: OfflineQueueManager.getStats().oldestEntryTime,
    });

    for (const entry of entries) {
      try {
        // Record attempt and check if entry is still eligible for replay
        const isEligible = await OfflineQueueManager.recordAttempt(entry.key);
        if (!isEligible) {
          // Entry exceeded max retries and was removed; skip replay
          logger.debug(
            "api",
            "Offline queue entry skipped (max retries exceeded)",
            {
              key: entry.key,
            },
          );
          continue;
        }

        // Reconstruct fetcher from stored entry metadata
        // Store only serializable data, reconstruct actual fetcher at replay time
        const fetcher = this._reconstructFetcherFromQueueEntry(entry);

        // Replay the request with original options
        await this.fetch(entry.key, fetcher, entry.options);

        // Success: remove from queue
        await OfflineQueueManager.dequeue(entry.key);
        logger.info("api", "Offline queue entry replayed successfully", {
          key: entry.key,
          attempts: entry.attempts,
        });
      } catch (error) {
        logger.warn("api", "Offline queue replay failed", {
          key: entry.key,
          attempts: entry.attempts,
          error,
        });
        // Entry remains in queue for manual retry or next auto-replay
        // recordAttempt already incremented attempts counter
      }
    }
  }

  /**
   * Get offline queue statistics
   */
  getOfflineQueueStats() {
    return OfflineQueueManager.getStats();
  }

  /**
   * Clear fetcher registry (used for testing or memory cleanup)
   * Called during app shutdown or hard reset
   */
  clearFetcherRegistry(): void {
    this.fetcherRegistry.clear();
    logger.debug("api", "Fetcher registry cleared");
  }

  /**
   * Private: Determine if request should be queued for offline replay
   * Queue when: network is offline OR circuit breaker is open (for that endpoint)
   */
  private async _shouldQueueRequest(
    error: unknown,
    cbKey?: string,
  ): Promise<boolean> {
    // Check if network is offline. CELLULAR is a valid connected state (per state machine)
    // and should NOT trigger offline queueing. Only true OFFLINE should queue requests.
    const networkStatus = await NetworkDetection.getStatus();
    const isOffline = networkStatus.connectionQuality === "offline";

    if (isOffline) {
      logger.debug("api", "Should queue: network offline", {
        connectionQuality: networkStatus.connectionQuality,
      });
      return true;
    }

    // Check if circuit breaker is open (network error that opened circuit)
    if (cbKey) {
      const cbState = CircuitBreakerManager.getState(cbKey);
      if (cbState === "Open") {
        logger.debug("api", "Should queue: circuit breaker open", {
          endpoint: cbKey,
        });
        return true;
      }
    }

    // Only queue on SPECIFIC, reliable network error types
    // NOT on string matching which is too broad
    const isNetworkError =
      error instanceof TypeError || // Actual fetch failure
      (error as any)?.name === "AbortError"; // Request aborted

    if (isNetworkError && !isOffline) {
      logger.debug("api", "Should queue: network-level error detected", {
        errorType: (error as any)?.name,
      });
      return true;
    }

    return false;
  }

  /**
   * Private: Build a queue entry from request context
   * Only stores serializable data; secrets/functions excluded
   */
  private _buildQueueEntry(
    key: string,
    options: Required<Omit<RequestOptions, "authStrategy" | "interceptors">> & {
      authStrategy?: string;
    },
    url: string,
    method: string,
    requestContext?: { context?: Record<string, any>; idempotencyKey?: string },
  ): QueuedRequestEntry {
    const entry: QueuedRequestEntry = {
      key,
      url,
      method,
      authStrategy: options.authStrategy,
      options: {
        dedupe: options.dedupe,
        retries: options.retries,
        retryDelay: options.retryDelay,
        failOpen: options.failOpen,
        timeout: options.timeout,
        useQueryCache: options.useQueryCache,
        staleTime: options.staleTime,
        cacheTime: options.cacheTime,
        tags: options.tags,
        circuitBreakerKey: options.circuitBreakerKey,
        circuitThresholds: options.circuitThresholds,
        idempotencyKey: requestContext?.idempotencyKey, // Preserve idempotency key for replay
        context: requestContext?.context, // Preserve context for replay interceptor hooks
      },
      createdAt: Date.now(),
      attempts: 0,
    };

    // Include idempotency key in the entry headers if provided
    // This ensures replayed requests maintain at-most-once semantics
    if (requestContext?.idempotencyKey) {
      entry.headers = { "Idempotency-Key": requestContext.idempotencyKey };
    }

    return entry;
  }

  /**
   * Private: Reconstruct a fetcher function from a queued entry
   * Since actual fetcher is not serializable, this returns a no-op fetcher
   * that returns the stored URL/method/body for re-execution
   * In production, the actual API client would need to implement replaying
   */
  private _reconstructFetcherFromQueueEntry(
    entry: QueuedRequestEntry,
  ): () => Promise<any> {
    // Attempt to retrieve the fetcher from the registry
    // The registry is populated when requests go through RequestManager.fetch()
    const registeredFetcher = this.fetcherRegistry.get(entry.key);

    if (registeredFetcher) {
      logger.debug(
        "api",
        "Offline queue entry: using registered fetcher from registry",
        {
          key: entry.key,
          url: entry.url,
        },
      );
      return registeredFetcher;
    }

    // Fallback: if fetcher not in registry, reconstruct a basic fetch call
    // This allows replays even if the original fetcher isn't registered
    // Supports simple HTTP operations
    logger.debug(
      "api",
      "Offline queue entry: reconstructing fetcher from stored metadata",
      {
        key: entry.key,
        url: entry.url,
        method: entry.method,
      },
    );

    return async () => {
      // Build fetch options from stored metadata
      const fetchOptions: RequestInit = {
        method: entry.method,
      };

      // Add headers if present
      if (entry.headers) {
        fetchOptions.headers = entry.headers;
      }

      // Add body if present and not a GET request
      if (entry.body && entry.method !== "GET") {
        fetchOptions.body =
          typeof entry.body === "string"
            ? entry.body
            : JSON.stringify(entry.body);
      }

      // Build URL with query parameters
      let url = entry.url;
      if (entry.params && Object.keys(entry.params).length > 0) {
        const queryString = new URLSearchParams(entry.params).toString();
        url = `${url}?${queryString}`;
      }

      // Reject replay for non-HTTP URLs to avoid Fetch API errors
      if (!/^https?:\/\//i.test(url) && !url.startsWith('/')) {
        logger.warn(
          "api",
          "Offline replay: stored url is not HTTP(S) or absolute path, cannot replay",
          { key: entry.key, url },
        );
        throw new Error(
          `Offline replay not supported for non-HTTP URL: ${url}`,
        );
      }

      // Perform the actual fetch
      const response = await fetch(url, fetchOptions);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Offline replay failed: ${response.status} ${response.statusText} - ${errorText}`,
        );
      }

      // Parse response based on content-type
      const contentType = response.headers.get("content-type") || "";
      if (contentType.includes("application/json")) {
        return await response.json();
      }

      return await response.text();
    };
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
    this.inFlightGetRequests.clear();

    // Unsubscribe from network quality changes
    if (this.networkQualityUnsubscribe) {
      this.networkQualityUnsubscribe();
      this.networkQualityUnsubscribe = null;
    }
  }
}

// Create singleton instance
export const RequestManager = new RequestManagerClass();

export default RequestManager;
