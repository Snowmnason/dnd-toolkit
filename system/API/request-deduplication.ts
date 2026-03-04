import { logger } from "@/lib/utils";

/**
 * Request Deduplication
 *
 * Tracks in-flight requests by key and returns the existing promise
 * when a duplicate request is made while one is already pending.
 * Prevents redundant network calls for identical concurrent requests.
 *
 * Features:
 * - Key-based deduplication (same key = same request)
 * - Automatic cleanup on promise settlement (success or failure)
 * - Stale request cleanup (configurable threshold)
 * - Stats and debugging support
 */

// ─── Types ─────────────────────────────────────────────────────────

export interface PendingRequest {
  promise: Promise<any>;
  timestamp: number;
}

// ─── Deduplication Manager ─────────────────────────────────────────

/**
 * Manages in-flight request tracking for deduplication.
 *
 * Usage:
 *   // Check if already in flight
 *   const existing = dedup.get(key);
 *   if (existing) return existing.promise;
 *
 *   // Track new request
 *   dedup.track(key, promise, startedAt);
 *
 *   // Cleanup happens automatically on settle
 */
export const RequestDeduplication = {
  /** Track pending requests by key */
  _pending: new Map<string, PendingRequest>(),

  /**
   * Check if a request with this key is already in flight
   */
  has(key: string): boolean {
    return this._pending.has(key);
  },

  /**
   * Get existing pending request (returns undefined if none)
   */
  get(key: string): PendingRequest | undefined {
    return this._pending.get(key);
  },

  /**
   * Track a new in-flight request.
   * Automatically cleans up when the promise settles.
   *
   * @param key Deduplication key
   * @param promise The request promise to track
   * @param timestamp When the request started (for stale detection)
   */
  track(key: string, promise: Promise<any>, timestamp: number): void {
    this._pending.set(key, { promise, timestamp });

    // Auto-cleanup on settlement (success or failure).
    // Uses a single .then() with both handlers to avoid intermediate
    // promise chains that could accumulate with frequent reuse.
    promise
      .then(
        () => this._pending.delete(key),
        () => this._pending.delete(key),
      )
      .catch((cleanupError) => {
        // Cleanup errors are unexpected and indicate potential memory leaks.
        logger.category('api').warn("Dedup cleanup handler error (unexpected):", cleanupError);
      });
  },

  /**
   * Remove stale pending requests that have been in-flight too long.
   * Called by periodic cleanup to prevent memory leaks from hung requests.
   *
   * @param staleThresholdMs Max age in ms before a request is considered stale
   * @returns Number of stale requests removed
   */
  cleanupStale(staleThresholdMs: number): number {
    const now = Date.now();
    let removed = 0;

    const entries = Array.from(this._pending.entries()) as [string, PendingRequest][];
    for (const [key, request] of entries) {
      if (now - request.timestamp > staleThresholdMs) {
        this._pending.delete(key);
        removed++;
        logger.category('api').warn("Stale request cleaned up", {
          key,
          staleSinceMinutes: Math.round((now - request.timestamp) / 1000 / 60),
        });
      }
    }

    return removed;
  },

  /**
   * Number of currently pending requests
   */
  get size(): number {
    return this._pending.size;
  },

  /**
   * Get all pending request keys
   */
  get keys(): string[] {
    return Array.from(this._pending.keys());
  },

  /**
   * Clear all pending requests.
   * WARNING: Only use during logout/cleanup.
   */
  clear(): void {
    logger.category('api').debug("Clearing all pending requests");
    this._pending.clear();
  },
};
