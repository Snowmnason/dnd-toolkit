import * as Sentry from '@sentry/react-native';
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

  /**
   * Hook for offline request buffering (future implementation)
   * Currently stubbed - can be implemented to queue failed requests
   */
  onOfflineBuffer?: (
    key: string,
    fetcher: () => Promise<any>,
    error: Error
  ) => Promise<void>;

  /**
   * Hook for offline detection
   * When set, RequestManager can short-circuit to fail-open
   */
  onOfflineDetect?: () => boolean | Promise<boolean>;

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
    const opts = { ...DEFAULT_OPTIONS, ...options };

    try {
      // ========== DEDUPE CHECK ==========
      if (opts.dedupe && this.pendingRequests.has(key)) {
        logger.debug('request-manager', 'Returning deduplicated request:', key);
        return this.pendingRequests.get(key)!.promise;
      }

      // ========== RATE LIMIT CHECK ==========
      if (opts.rateLimitKey) {
        const canProceed = this.checkRateLimit(opts.rateLimitKey);
        if (!canProceed) {
          logger.warn('request-manager', 'Rate limited:', opts.rateLimitKey);
          if (opts.failOpen) {
            return null;
          }
          throw new Error(`Rate limit exceeded: ${opts.rateLimitKey}`);
        }
      }

      // ========== EXECUTE WITH RETRY ==========
      const promise = this.executeWithRetry(
        fetcher,
        opts.retries,
        opts.retryDelay,
        opts.timeout
      );

      // ========== TRACK PENDING REQUEST ==========
      if (opts.dedupe) {
        this.pendingRequests.set(key, {
          promise,
          timestamp: Date.now(),
        });

        // Clean up after request completes
        promise
          .finally(() => this.pendingRequests.delete(key))
          .catch(() => {}); // Suppress unhandled rejection warning
      }

      return promise;
    } catch (error) {
      logger.error('request-manager', 'Request failed:', { key, error });

      // ========== SENTRY REPORTING ==========
      this.reportErrorToSentry(error, { key, options: opts });

      // ========== FAIL OPEN BEHAVIOR ==========
      if (opts.failOpen) {
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
    return Promise.race([
      fn(),
      new Promise<T>((_, reject) =>
        setTimeout(
          () => reject(new Error(`Request timeout after ${timeout}ms`)),
          timeout
        )
      ),
    ]);
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
      };
      this.rateLimitBuckets.set(key, bucket);
    }

    // Refill tokens based on time elapsed
    const timePassed = now - bucket.lastRefill;
    const tokensToAdd = (timePassed / 1000) * RATE_LIMIT_CONFIG.tokensPerSecond;
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
