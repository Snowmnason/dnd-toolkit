import { logger } from "@/lib/utils";

/**
 * Request Rate Limiting — Token Bucket Algorithm
 *
 * Controls request throughput per key using a token bucket.
 * Each key gets its own bucket with configurable tokens/second and burst capacity.
 * Prevents overwhelming endpoints with too many concurrent requests.
 *
 * Features:
 * - Per-key rate limiting (separate bucket per endpoint/user/etc.)
 * - Token bucket with burst support (allows short bursts above steady rate)
 * - Automatic token refill based on elapsed time
 * - Stale bucket cleanup (configurable threshold)
 * - Integer math to avoid floating point drift
 */

// ─── Types ─────────────────────────────────────────────────────────

export interface RateLimitBucket {
  /** Available tokens (each request consumes 1) */
  tokens: number;
  /** Timestamp of last token refill */
  lastRefill: number;
  /** Timestamp of last access (for stale cleanup) */
  lastAccess: number;
}

export interface RateLimitConfig {
  /** Tokens added per second (steady-state rate) */
  tokensPerSecond: number;
  /** Maximum tokens in bucket (burst capacity) */
  maxTokens: number;
}

// ─── Default Config ────────────────────────────────────────────────

/** Default: 10 requests/second, burst up to 20 (2 seconds worth) */
const DEFAULT_RATE_LIMIT_CONFIG: RateLimitConfig = {
  tokensPerSecond: 10,
  maxTokens: 20,
};

// ─── Rate Limiter ──────────────────────────────────────────────────

/**
 * Manages per-key rate limiting using the token bucket algorithm.
 *
 * Usage:
 *   if (!rateLimiter.check(key)) {
 *     throw new Error('Rate limited');
 *   }
 *   // proceed with request
 */
export const RequestRateLimiter = {
  /** Rate limit buckets by key */
  _buckets: new Map<string, RateLimitBucket>(),

  /** Active configuration */
  _config: { ...DEFAULT_RATE_LIMIT_CONFIG } as RateLimitConfig,

  /**
   * Update rate limit configuration.
   * Affects all future token refills (existing buckets keep current tokens).
   */
  configure(config: Partial<RateLimitConfig>): void {
    this._config = { ...this._config, ...config };
  },

  /**
   * Check if a request is allowed under the rate limit.
   * Consumes 1 token if allowed.
   *
   * @param key Rate limit key (e.g., endpoint, user ID)
   * @returns true if request is allowed, false if rate limited
   */
  check(key: string): boolean {
    const now = Date.now();
    let bucket = this._buckets.get(key);

    if (!bucket) {
      // First request for this key — initialize with full tokens
      bucket = {
        tokens: this._config.maxTokens,
        lastRefill: now,
        lastAccess: now,
      };
      this._buckets.set(key, bucket);
    }

    // Update last access time for stale cleanup
    bucket.lastAccess = now;

    // Refill tokens based on elapsed time.
    // Uses integer math: multiply first, then divide, to avoid floating point drift.
    const timePassed = now - bucket.lastRefill;
    const tokensToAdd = Math.round(
      (timePassed * this._config.tokensPerSecond) / 1000,
    );
    bucket.tokens = Math.min(
      this._config.maxTokens,
      bucket.tokens + tokensToAdd,
    );
    bucket.lastRefill = now;

    // Consume a token if available
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return true;
    }

    return false;
  },

  /**
   * Remove stale rate limit buckets that haven't been accessed recently.
   * Called by periodic cleanup to prevent memory leaks.
   *
   * @param staleThresholdMs Max idle time before a bucket is removed
   * @returns Number of stale buckets removed
   */
  cleanupStale(staleThresholdMs: number): number {
    const now = Date.now();
    let removed = 0;

    const entries = Array.from(this._buckets.entries()) as [string, RateLimitBucket][];
    for (const [key, bucket] of entries) {
      if (now - bucket.lastAccess > staleThresholdMs) {
        this._buckets.delete(key);
        removed++;
      }
    }

    return removed;
  },

  /**
   * Reset rate limit for a specific key or all keys.
   *
   * @param key Optional key to reset. If omitted, resets all.
   */
  reset(key?: string): void {
    if (key) {
      this._buckets.delete(key);
      logger.category('api').debug("Reset rate limit for:", key);
    } else {
      this._buckets.clear();
      logger.category('api').debug("Reset all rate limits");
    }
  },

  /**
   * Get keys that are currently rate-limited (have < 1 token).
   */
  get rateLimitedKeys(): string[] {
    return Array.from(this._buckets.entries())
      .filter(([, bucket]) => bucket.tokens < 1)
      .map(([key]) => key);
  },

  /**
   * Number of active buckets being tracked.
   */
  get size(): number {
    return this._buckets.size;
  },
};
