import * as Sentry from '@sentry/react-native';
import { Analytics } from '../analytics';
import { logger } from '../utils/logger';

/**
 * Request Manager: Centralized API request layer with:
 * - Request deduplication (avoid duplicate in-flight requests)
 * - Retry logic with exponential backoff
 * - Optional rate limiting (token bucket)
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
// Configuration
// ==========================================

const DEFAULT_OPTIONS: Required<RequestOptions> = {
  dedupe: true,
  retries: 3,
  retryDelay: 1000,
  failOpen: false,
  timeout: 30000,
  rateLimitKey: '',
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
  
  /** Periodic cleanup timer to prevent memory leaks */
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;
  
  /** Cleanup interval: 1 hour */
  private readonly CLEANUP_INTERVAL = 60 * 60 * 1000;
  
  /** Stale entry threshold: 1 hour of inactivity */
  private readonly STALE_THRESHOLD = 60 * 60 * 1000;
  
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
    if (typeof this.cleanupTimer === 'object' && 'unref' in this.cleanupTimer) {
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
        logger.warn('request-manager', `Cleaned up stale pending request: ${key}`);
      }
    }

    if (removedBuckets > 0 || removedRequests > 0) {
      logger.debug('request-manager', `Cleaned up ${removedBuckets} stale rate limit buckets and ${removedRequests} stale pending requests`);
    }
  }

  /**
   * Execute a request with optional dedupe, retry, and rate limiting
   * 
   * @param key - Unique key for deduplication (should be deterministic)
   * @param fetcher - Async function that performs the actual request
   * @param options - Request options (dedupe, retries, failOpen, etc.)
   * @returns The result of the fetcher function
   * 
   * @example
   * ```typescript
   * const worlds = await RequestManager.fetch(
   *   `worlds:user:${userId}`,
   *   () => worldsDB.getMyWorlds(userId),
   *   { dedupe: true, rateLimitKey: `user:${userId}` }
   * );
   * ```
   */
  async fetch<T>(
    key: string,
    fetcher: () => Promise<T>,
    options: RequestOptions = {}
  ): Promise<T | null> {
    const options_ = { ...DEFAULT_OPTIONS, ...options };
    const startedAt = Date.now();

    try {
      // ========== DEDUPE CHECK ==========
      if (options_.dedupe && this.pendingRequests.has(key)) {
        logger.debug('request-manager', 'Returning deduplicated request:', key);
        // Wrap the deduplicated promise to ensure error handling, Sentry reporting,
        // and fail-open behavior apply even to deduplicated requests
        const deduplicatedPromise = this.pendingRequests.get(key)!.promise;
        return deduplicatedPromise.catch((error) => {
          logger.error('request-manager', 'Deduplicated request failed:', { key, error });
          this.reportErrorToSentry(error, { key, options: options_ });
          
          if (options_.failOpen) {
            logger.warn('request-manager', 'Fail-open enabled for deduplicated request, returning null:', key);
            return null;
          }
          
          throw error;
        });
      }

      // ========== RATE LIMIT CHECK ==========
      if (options_.rateLimitKey) {
        const canProceed = this.checkRateLimit(options_.rateLimitKey);
        if (!canProceed) {
          logger.warn('request-manager', 'Rate limited:', options_.rateLimitKey);
          if (options_.failOpen) {
            return null;
          }
          throw new Error(`Rate limit exceeded: ${options_.rateLimitKey}`);
        }
      }

      // ========== EXECUTE WITH RETRY ==========
      const promise = this.executeWithRetry(
        fetcher,
        options_.retries,
        options_.retryDelay,
        options_.timeout
      );

      // Attach lightweight duration tracking without altering the original promise
      promise.then(
        () => {
          const duration_ms = Date.now() - startedAt;
          Analytics.track('api_request', { key, ok: true, duration_ms });
          if (duration_ms > 3000) {
            logger.warn('request-manager', `Slow request: ${key} took ${duration_ms}ms`);
          }
        },
        (err) => {
          const duration_ms = Date.now() - startedAt;
          Analytics.track('api_request', { key, ok: false, duration_ms, error: (err as Error)?.message });
          if (duration_ms > 3000) {
            logger.warn('request-manager', `Slow failed request: ${key} took ${duration_ms}ms`);
          }
        }
      ).catch(() => {});

      // ========== TRACK PENDING REQUEST ==========
      if (options_.dedupe) {
        this.pendingRequests.set(key, {
          promise,
          timestamp: Date.now(),
        });

        // Clean up pending request after it settles (success or failure).
        // Uses a single .then() call with both onFulfilled and onRejected handlers
        // to avoid creating intermediate promise chains that could accumulate if
        // the same key is reused frequently with deduplication enabled.
        // Both handlers do the same cleanup; the second .catch() only suppresses
        // errors that might occur in the cleanup operation itself.
        promise.then(
          () => this.pendingRequests.delete(key),
          () => this.pendingRequests.delete(key)
        ).catch(() => {}); // Suppress any errors from cleanup function
      }

      return promise;
    } catch (error) {
      logger.error('request-manager', 'Request failed:', { key, error });

      // ========== SENTRY REPORTING ==========
      this.reportErrorToSentry(error, { key, options: options_ });

      // Tracking for thrown path (in case promise creation failed early)
      const duration_ms = Date.now() - startedAt;
      Analytics.track('api_request', { key, ok: false, duration_ms, error: (error as Error)?.message });

      // ========== FAIL OPEN BEHAVIOR ==========
      if (options_.failOpen) {
        logger.warn('request-manager', 'Fail-open enabled, returning null:', key);
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
  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    retriesLeft: number,
    delay: number,
    timeout: number
  ): Promise<T> {
    try {
      return await this.executeWithTimeout(fn, timeout);
    } catch (error) {
      if (retriesLeft <= 0) {
        throw error;
      }

      logger.debug('request-manager', 'Retrying after error:', {
        error: (error as Error).message,
        retriesLeft,
        delayMs: delay,
      });

      // Wait before retry
      await new Promise((resolve) => setTimeout(resolve, delay));

      // Exponential backoff: delay *= 2
      return this.executeWithRetry(fn, retriesLeft - 1, delay * 2, timeout);
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
    timeout: number
  ): Promise<T> {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const timeoutPromise = new Promise<T>((_, reject) => {
      timeoutId = setTimeout(
        () => reject(new Error(`Request timeout after ${timeout}ms`)),
        timeout
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
    const tokensToAdd = Math.round((timePassed * RATE_LIMIT_CONFIG.tokensPerSecond) / 1000);
    bucket.tokens = Math.min(
      RATE_LIMIT_CONFIG.maxTokens,
      bucket.tokens + tokensToAdd
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
    context: { key: string; options: Required<RequestOptions> }
  ): void {
    try {
      Sentry.captureException(error, {
        tags: {
          component: 'request-manager',
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
        level: 'error',
      });
    } catch (sentryError) {
      logger.warn(
        'request-manager',
        'Failed to report to Sentry:',
        sentryError
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
        }
      ),
    };
  }

  /**
   * Clear all pending requests
   * WARNING: Only use during logout/cleanup
   */
  clearPending(): void {
    logger.debug('request-manager', 'Clearing pending requests');
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
      logger.debug('request-manager', 'Reset rate limit for:', key);
    } else {
      this.rateLimitBuckets.clear();
      logger.debug('request-manager', 'Reset all rate limits');
    }
  }
}

// Create singleton instance
export const RequestManager = new RequestManagerClass();

export default RequestManager;
