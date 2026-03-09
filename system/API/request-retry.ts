import {
  captureErrorCorrelation,
  ErrorType,
  type PayloadQuality,
} from "@/lib/network";
import { logger, type PerfTimer } from "@/lib/utils";
import { NetworkDetection } from "@/system/Network";
import { deriveConnectionType } from "@/system/Network/helpers";
import {
  InterceptorManager,
  type RequestInterceptor,
} from "./interceptor";

/**
 * Request Retry with Exponential Backoff
 *
 * Handles retry orchestration for failed API requests:
 * - Exponential backoff: delay doubles each attempt (1s → 2s → 4s → 8s ...)
 * - Per-attempt timeout via Promise.race
 * - Adaptive quality downgrade on AbortError (hd → sd → thumb → text-only)
 * - Abort-and-retry on network quality degradation (4G → 2G mid-request)
 * - Interceptor hooks: onAfterResponse (success), onError (final failure)
 * - Error-type telemetry capture on final failure
 *
 * This module is pure transport-level logic — no auth, no caching, no app config.
 * Auth retry (401 + token refresh) is handled separately by the auth layer.
 */

// ─── Types ─────────────────────────────────────────────────────────

/** Context passed through the retry chain for interceptors, logging, and telemetry */
export interface RetryRequestContext {
  /** Request key (enriched URL or cache key) */
  key: string;
  /** Parsed endpoint name (e.g., 'worlds', 'users') */
  endpoint?: string;
  /** Auth strategy name (for logging only — auth handling lives elsewhere) */
  authStrategy?: string;
  /** Client-specific interceptors for this request */
  interceptors?: RequestInterceptor[];
  /** Arbitrary context passed through to interceptor hooks */
  context?: Record<string, any>;
}

/** In-flight GET request entry for abort-and-retry tracking */
export interface InFlightRequest {
  /** Network effective type when request started (e.g., '4g', '3g') */
  effectiveType: string | undefined;
  /** Connection type when request started ('WIFI', 'CELLULAR', 'ETHERNET', 'UNKNOWN') */
  connectionType: string;
  /** Timestamp when request started */
  startedAt: number;
  /** AbortController for cancelling this request */
  abortController: AbortController;
  /** Whether this request has already been aborted (prevents redundant abort calls) */
  aborted?: boolean;
}

/** Retry state for adaptive quality downgrade across attempts */
export interface RetryQualityState {
  /** Current attempt number (0-indexed) */
  attemptNumber: number;
  /** Current adaptive quality level (downgraded on AbortError) */
  initialQuality?: PayloadQuality;
}

// ─── Quality Downgrade ─────────────────────────────────────────────

/**
 * Downgrade adaptive quality for retry attempts.
 * Maps: hd → sd → thumb → text-only (minimum)
 *
 * Used when a request aborts/times out and we retry with lower quality hints.
 */
export function downgradeAdaptiveQuality(quality: PayloadQuality): PayloadQuality {
  // Use Map to avoid 'Generic Object Injection Sink' lint warning (security/detect-object-injection)
  const degradeMap = new Map<PayloadQuality, PayloadQuality>([
    ['hd', 'sd'],
    ['sd', 'thumb'],
    ['thumb', 'text-only'],
    ['text-only', 'text-only'], // Already at minimum
  ]);
  return degradeMap.get(quality) ?? 'text-only';
}

// ─── Abort-and-Retry (Network Quality Degradation) ─────────────────

/**
 * Manages in-flight GET request tracking and abort-on-degradation.
 *
 * When network quality degrades significantly during a request:
 * - Abort fetch and retry with lower-quality params (thumbnails, summaries)
 * - Only for queries (GET); mutations handle their own persistence strategy
 * - Prevents long timeouts on requests that started on good connection
 *   but hit poor connection mid-way
 *
 * Example: User starts loading world maps on 4G, drops to 2G mid-request
 * → Abort current fetch → Retry with thumbnail+summaries quality
 */
export const AbortAndRetry = {
  /** In-flight GET requests tracked for quality degradation abort */
  _inFlight: new Map<string, InFlightRequest>(),

  /** Network quality subscription unsubscribe function */
  _unsubscribe: null as (() => void) | null,

  /**
   * Track a GET request's initial network quality with abort controller.
   *
   * @param key - Cache key or URL of the request
   * @param abortController - AbortController for this request
   */
  track(key: string, abortController: AbortController): void {
    const status = NetworkDetection.getStatus();
    if (!status) {
      return;
    }

    this._inFlight.set(key, {
      effectiveType: status.effectiveType,
      connectionType: deriveConnectionType(status),
      startedAt: Date.now(),
      abortController,
    });
  },

  /**
   * Untrack a GET request after it completes.
   *
   * @param key - Cache key or URL of the request
   */
  untrack(key: string): void {
    this._inFlight.delete(key);
  },

  /**
   * Subscribe to network quality changes and abort in-flight GETs on significant degradation.
   * Call once during initialization.
   */
  subscribe(): void {
    this._unsubscribe = NetworkDetection.subscribe((status) => {
      const entries = Array.from(this._inFlight.entries());

      for (const [key, entry] of entries) {
        // Skip entries that have already been aborted to prevent redundant abort calls
        // when network quality changes multiple times before the request cleanup completes
        if (entry.aborted) {
          continue;
        }

        if (this.shouldAbortDueToQualityDegradation(key, 2000)) {
          logger.category('api').info('Aborting in-flight GET due to quality degradation', {
            key,
            startQuality: entry.effectiveType,
            currentQuality: status.effectiveType,
            ageMs: Date.now() - entry.startedAt,
          });

          // Mark as aborted to prevent redundant abort calls if quality changes again
          // before the promise cleanup removes this entry from tracking
          entry.aborted = true;

          // Abort the request — the retry will happen automatically via the catch block
          entry.abortController.abort();
        }
      }
    });
  },

  /**
   * Unsubscribe from network quality changes. Call during cleanup.
   */
  unsubscribe(): void {
    if (this._unsubscribe) {
      this._unsubscribe();
      this._unsubscribe = null;
    }
  },

  /**
   * Check if quality degradation should trigger abort-and-retry for in-flight request.
   *
   * Conservative thresholds:
   * - Only abort if quality degraded by ≥2 tiers (e.g., 4g → 2g)
   * - Only abort if request has been in-flight > maxAgeMsForRetry (give fast requests time to complete)
   * - Never abort upgrades (2g → 4g) — let original request finish
   * - Skip entries already marked as aborted (prevents race condition on repeated quality changes)
   *
   * @param key - Cache key or URL
   * @param maxAgeMsForRetry - Only retry if request has been in-flight longer than this (ms)
   * @returns true if quality degraded enough to warrant abort-retry
   */
  shouldAbortDueToQualityDegradation(
    key: string,
    maxAgeMsForRetry: number = 2000,
  ): boolean {
    const inFlightRequest = this._inFlight.get(key);
    if (!inFlightRequest) {
      return false;
    }

    // Skip requests already marked as aborted
    if (inFlightRequest.aborted) {
      return false;
    }

    // If request is very young, don't abort yet — give it a chance to complete
    const age = Date.now() - inFlightRequest.startedAt;
    if (age < maxAgeMsForRetry) {
      return false;
    }

    const currentStatus = NetworkDetection.getStatus();
    if (!currentStatus) {
      return false;
    }

    // Quality rank based on effectiveType.
    // NOTE: effectiveType already encodes cellular vs wifi via deriveEffectiveType():
    //   - GOOD + wifi → '4g' (rank 5)
    //   - GOOD + cellular → '3g' (rank 4)
    //   - CELLULAR quality → '3g'/'2g' (rank 4/3)
    //   - BAD → '2g'/'slow-2g' (rank 3/2)
    //   - OFFLINE → 'offline' (rank 1)
    // So cellular connections already get lower ranks than wifi at the same signal quality.
    const qualityRank = new Map<string, number>([
      ['4g', 5],
      ['3g', 4],
      ['2g', 3],
      ['slow-2g', 2],
      ['offline', 1],
      ['unknown', 3], // Treat unknown as 2g-equivalent
    ]);

    const UNKNOWN_RANK = 3;
    const getRank = (quality: string | undefined): number => {
      if (!quality) return UNKNOWN_RANK;
      return qualityRank.get(quality) ?? UNKNOWN_RANK;
    };

    const startRank = getRank(inFlightRequest.effectiveType);
    const currentRank = getRank(currentStatus.effectiveType);

    // Check for connection type transition (wifi → cellular) as a degradation signal.
    // Even if effectiveType rank doesn't change much, switching from wifi to cellular
    // indicates the user lost their stable connection and is now on metered/less reliable network.
    // This adds 1 bonus tier of degradation for the wifi→cellular transition.
    const currentConnectionType = deriveConnectionType(currentStatus);
    const wifiToCellularPenalty =
      inFlightRequest.connectionType === 'WIFI' && currentConnectionType === 'CELLULAR' ? 1 : 0;

    const totalDegradation = (startRank - currentRank) + wifiToCellularPenalty;

    // Only abort if quality degraded by at least 2 tiers (e.g., 4g → 2g, or 4g → 3g + wifi→cellular)
    // Minor degradation (4g → 3g on same connection type) not worth aborting
    const DEGRADATION_THRESHOLD = 2;
    return totalDegradation >= DEGRADATION_THRESHOLD;
  },

  /**
   * Clean up stale in-flight entries (requests older than threshold).
   * Handles edge cases where requests hang without settling.
   *
   * @param staleThresholdMs - Entries older than this are removed
   * @returns Number of entries removed
   */
  cleanupStale(staleThresholdMs: number): number {
    const now = Date.now();
    let removed = 0;

    const entries = Array.from(this._inFlight.entries());
    for (const [key, entry] of entries) {
      if (now - entry.startedAt > staleThresholdMs) {
        this._inFlight.delete(key);
        removed++;
      }
    }

    return removed;
  },

  /** Clear all tracked in-flight requests */
  clear(): void {
    this._inFlight.clear();
  },

  /** Number of currently tracked in-flight requests */
  get size(): number {
    return this._inFlight.size;
  },
};

// ─── Timeout Wrapper ───────────────────────────────────────────────

/**
 * Execute a function with a timeout.
 * Uses Promise.race between the function and a timeout rejection.
 *
 * @param fn - Async function to execute
 * @param timeout - Timeout in ms
 * @returns Result of the function or throws TimeoutError
 */
export function executeWithTimeout<T>(
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
      if (timeoutId !== null) clearTimeout(timeoutId);
      return result;
    })
    .catch((error) => {
      if (timeoutId !== null) clearTimeout(timeoutId);
      throw error;
    });
}

// ─── Error Type Classification ─────────────────────────────────────

/**
 * Classify an error into an ErrorType for telemetry.
 * Used on final failure (all retries exhausted) to capture error correlation.
 */
function classifyErrorType(error: unknown, statusCode?: number): ErrorType {
  const errorMsg = (error as Error)?.message || String(error);

  if (errorMsg.includes("timeout") || errorMsg.includes("AbortError")) {
    return ErrorType.TIMEOUT;
  }
  if (errorMsg.includes("DNS") || errorMsg.includes("dns")) {
    return ErrorType.DNS_FAIL;
  }
  if (errorMsg.includes("connection reset") || errorMsg.includes("ECONNRESET")) {
    return ErrorType.CONNECTION_RESET;
  }
  if (statusCode && statusCode >= 500) {
    return ErrorType.HTTP_5XX;
  }
  if (statusCode && statusCode >= 400 && statusCode < 500) {
    return ErrorType.HTTP_4XX;
  }
  return ErrorType.OTHER;
}

// ─── Retry Executor ────────────────────────────────────────────────

/** Retry state tracking for adaptive quality downgrade across attempts */
const retryQualityState = new Map<string, RetryQualityState>();

/**
 * Get the current retry quality state for a key.
 * Used by the caller to initialize/read quality tracking.
 */
export function getRetryQualityState(key: string): RetryQualityState | undefined {
  return retryQualityState.get(key);
}

/**
 * Set or initialize retry quality state for a key.
 * Call before starting the retry sequence to track initial quality.
 */
export function setRetryQualityState(key: string, state: RetryQualityState): void {
  retryQualityState.set(key, state);
}

/** Clear retry quality state for a key (call after request completes). */
export function clearRetryQualityState(key: string): void {
  retryQualityState.delete(key);
}

/**
 * Execute a request with retry logic and exponential backoff.
 *
 * Each attempt:
 * 1. Calls `fn(attemptNumber)` to get the fetcher for this attempt
 * 2. Wraps with timeout via `executeWithTimeout`
 * 3. On success: runs onAfterResponse interceptors, returns result
 * 4. On failure with retries left: logs, downgrades quality on AbortError,
 *    waits (delay), then recurses with delay *= 2
 * 5. On final failure: runs onError interceptors, captures error telemetry, throws
 *
 * @param fn - Function that accepts attemptNumber and returns an async fetcher
 * @param retriesLeft - Number of retries remaining
 * @param delay - Current delay in ms (doubles each retry)
 * @param timeout - Timeout per attempt in ms
 * @param totalRetries - Total retries configured (used to calculate attempt number)
 * @param requestContext - Context for interceptors, logging, telemetry
 * @param timer - Performance timer (created on first attempt, passed through recursion)
 * @returns Result of the function
 */
export async function executeWithRetry<T>(
  fn: (attemptNumber: number) => () => Promise<T>,
  retriesLeft: number,
  delay: number,
  timeout: number,
  totalRetries?: number,
  requestContext?: RetryRequestContext,
  timer?: PerfTimer,
): Promise<T> {
  // Use provided totalRetries or default to retriesLeft if not provided
  const _totalRetries = totalRetries ?? retriesLeft;
  
  // Calculate current attempt number (0-indexed)
  const attemptNumber = _totalRetries - retriesLeft;

  // Performance timing: start timer on first attempt only
  if (attemptNumber === 0 && !timer) {
    timer = logger.startTiming('api', `Request ${requestContext?.endpoint || requestContext?.key}`);
  }

  try {
    const result = await executeWithTimeout(fn(attemptNumber), timeout);

    // ── Interceptor: onAfterResponse ──
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

    // End timer on successful completion
    if (timer) {
      const elapsed = timer.getElapsed();
      logger.category('api').perf(`Request ${requestContext?.endpoint || requestContext?.key} completed`, {
        duration: elapsed,
        endpoint: requestContext?.endpoint,
        key: requestContext?.key,
      });
    }

    return result;
  } catch (error) {
    if (retriesLeft <= 0) {
      // ── Final failure: all retries exhausted ──

      // End performance timer
      if (timer) {
        const elapsed = timer.getElapsed();
        logger.category('api').perf(`Request ${requestContext?.endpoint || requestContext?.key} failed after retries`, {
          duration: elapsed,
          endpoint: requestContext?.endpoint,
          key: requestContext?.key,
          error: (error as Error).message,
        });
      }

      // ── Interceptor: onError ──
      // Only call error interceptors when retries are exhausted
      // (not for 401 — that's handled by the auth layer)
      const statusCode = (error as any)?.status || (error as any)?.code;
      
      // Safely derive error message (handles non-Error types: strings, objects, etc.)
      const errorMsg = error instanceof Error ? error.message : String((error as any)?.message ?? error);
      const isNetworkError =
        !(error as any)?.status &&
        errorMsg.toLowerCase().includes("network");

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

      // ── Telemetry: capture error-network correlation ──
      const mappedErrorType = classifyErrorType(error, statusCode);
      captureErrorCorrelation(mappedErrorType, errorMsg, statusCode);

      throw error;
    }

    // ── Detect abort-and-retry (quality degradation) ──
    const isAbortError = (error as any)?.name === "AbortError";
    if (isAbortError && requestContext) {
      const stateKey = requestContext.key;
      const state = retryQualityState.get(stateKey);

      if (state && state.initialQuality && state.initialQuality !== 'text-only') {
        const currentQuality = state.initialQuality;
        const downgradedQuality = downgradeAdaptiveQuality(currentQuality);
        state.initialQuality = downgradedQuality;

        logger.category('api').info("Downgrading image quality on abort", {
          key: requestContext.key,
          from: currentQuality,
          to: downgradedQuality,
          attemptNumber,
          retriesLeft,
        });
      } else {
        logger.category('api').debug("Request aborted due to network quality degradation", {
          key: requestContext.key,
          attemptNumber,
          retriesLeft,
          quality: state?.initialQuality || 'unknown',
        });
      }
    }

    // ── Log retry ──
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
    return executeWithRetry(
      fn,
      retriesLeft - 1,
      delay * 2,
      timeout,
      _totalRetries,
      requestContext,
      timer, // Pass timer through recursive calls
    );
  }
}
