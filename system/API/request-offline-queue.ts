import { logger } from "@/lib/utils";
import type { RequestOptions } from "@/system/API/request-manager";
import {
    CircuitBreakerManager,
} from "@/system/API/resilience/circuit-breaker";
import {
    OfflineQueueManager,
    type QueuedRequestEntry,
} from "@/system/API/resilience/offline-queue";
import { NetworkDetection } from "@/system/Network";

/**
 * Request Offline Queue Integration
 *
 * Bridge between the request pipeline and OfflineQueueManager.
 * Handles the decision logic, entry construction, and fetcher reconstruction
 * that connect request execution to the offline queue system.
 *
 * The actual queue storage, persistence, deduplication, and replay logic
 * lives in OfflineQueueManager — this module provides:
 * - **When** to queue (shouldQueueRequest)
 * - **What** to queue (buildQueueEntry)
 * - **How** to replay (FetcherRegistry + reconstructFetcherFromEntry)
 *
 * Network handling:
 * - OFFLINE → queue the request
 * - CELLULAR → valid connected state, do NOT queue (per state machine)
 * - ONLINE → do NOT queue (unless circuit breaker is open or network-level error)
 */

// ─── Types ─────────────────────────────────────────────────────────

/** Subset of RequestOptions that can be serialized into a queue entry */
export type SerializableRequestOptions = Required<
  Omit<RequestOptions, "authStrategy" | "interceptors">
> & {
  authStrategy?: string;
};

/** Additional request context preserved in queue entries */
export interface QueueRequestContext {
  /** Arbitrary context for interceptor hooks (preserved across replay) */
  context?: Record<string, any>;
  /** Idempotency key for at-most-once semantics (preserved across replay) */
  idempotencyKey?: string;
}

// ─── Fetcher Registry ──────────────────────────────────────────────

/**
 * Registry of fetcher functions for offline queue replay.
 *
 * When a request goes through the pipeline, its fetcher is registered here
 * keyed by the enriched request key. When the queue replays, it looks up
 * the original fetcher here first before falling back to reconstruction.
 *
 * Note: Fetchers are functions and NOT serializable — this registry is
 * in-memory only and cleared on app restart. The reconstruction fallback
 * handles cases where the fetcher is no longer in memory.
 */
export const FetcherRegistry = {
  _registry: new Map<string, () => Promise<any>>(),

  /**
   * Register a fetcher function for a request key.
   * Called when a request enters the pipeline so it can be replayed later.
   */
  register(key: string, fetcher: () => Promise<any>): void {
    this._registry.set(key, fetcher);
  },

  /**
   * Retrieve a registered fetcher for a key.
   * Returns undefined if not registered (app restarted, etc.)
   */
  get(key: string): (() => Promise<any>) | undefined {
    return this._registry.get(key);
  },

  /**
   * Check if a fetcher is registered for a key.
   */
  has(key: string): boolean {
    return this._registry.has(key);
  },

  /**
   * Clear all registered fetchers.
   * Called during app shutdown, hard reset, or testing.
   */
  clear(): void {
    this._registry.clear();
    logger.category('api').debug("Fetcher registry cleared");
  },

  /** Number of registered fetchers */
  get size(): number {
    return this._registry.size;
  },
};

// ─── Queue Decision Logic ──────────────────────────────────────────

/**
 * Determine if a failed request should be queued for offline replay.
 *
 * Queuing rules:
 * 1. **Offline** → always queue (connectionQuality === "offline")
 * 2. **Cellular** → do NOT queue (valid connected state per state machine)
 * 3. **Online** → do NOT queue unless:
 *    - Circuit breaker is Open for the endpoint
 *    - Network-level error (TypeError from fetch failure, AbortError)
 *
 * @param error - The error that caused the request to fail
 * @param circuitBreakerKey - Optional circuit breaker key to check state
 * @returns true if the request should be queued
 */
export async function shouldQueueRequest(
  error: unknown,
  circuitBreakerKey?: string,
): Promise<boolean> {
  // Check network state — only true OFFLINE triggers queueing
  // CELLULAR is a valid connected state and should NOT trigger offline queueing
  const networkStatus = NetworkDetection.getStatus();
  const isOffline = networkStatus.connectionQuality === "offline";

  if (isOffline) {
    logger.category('api').debug("Should queue: network offline", {
      connectionQuality: networkStatus.connectionQuality,
    });
    return true;
  }

  // Check if circuit breaker is open (network error that opened circuit)
  if (circuitBreakerKey) {
    const cbState = CircuitBreakerManager.getState(circuitBreakerKey);
    if (cbState === "Open") {
      logger.category('api').debug("Should queue: circuit breaker open", {
        endpoint: circuitBreakerKey,
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
    logger.category('api').debug("Should queue: network-level error detected", {
      errorType: (error as any)?.name,
    });
    return true;
  }

  return false;
}

// ─── Queue Entry Construction ──────────────────────────────────────

/**
 * Build a queue entry from request context.
 * Only stores serializable data — secrets, functions, and live references are excluded.
 *
 * Preserves:
 * - Idempotency key (for at-most-once replay semantics)
 * - Request context (for interceptor hooks on replay)
 * - Auth strategy name (fresh token fetched at replay time)
 *
 * @param key - Enriched request key (URL or cache key)
 * @param options - Request options (serializable subset)
 * @param url - HTTP URL or endpoint identifier
 * @param method - HTTP method (GET, POST, etc.)
 * @param requestContext - Additional context to preserve
 * @returns Queue entry ready for OfflineQueueManager.enqueue()
 */
export function buildQueueEntry(
  key: string,
  options: SerializableRequestOptions,
  url: string,
  method: string,
  requestContext?: QueueRequestContext,
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
      idempotencyKey: requestContext?.idempotencyKey,
      context: requestContext?.context,
    },
    createdAt: Date.now(),
    attempts: 0,
  };

  // Include idempotency key in entry headers for replay
  // Ensures replayed requests maintain at-most-once semantics
  if (requestContext?.idempotencyKey) {
    entry.headers = { "Idempotency-Key": requestContext.idempotencyKey };
  }

  return entry;
}

// ─── Fetcher Reconstruction ────────────────────────────────────────

/**
 * Reconstruct a fetcher function from a queued entry for replay.
 *
 * Priority:
 * 1. FetcherRegistry — original fetcher still in memory (same app session)
 * 2. Metadata reconstruction — build a basic fetch() call from stored URL/method/body
 *
 * The registry approach is preferred because it preserves the original fetcher's
 * full behavior (Supabase client, custom HTTP wrappers, etc.). The fallback
 * supports simple HTTP operations across app restarts.
 *
 * @param entry - Queued request entry with stored metadata
 * @returns Async function that performs the request
 */
export function reconstructFetcherFromEntry(
  entry: QueuedRequestEntry,
): () => Promise<any> {
  // Attempt to retrieve the original fetcher from the registry
  const registeredFetcher = FetcherRegistry.get(entry.key);

  if (registeredFetcher) {
    logger.category('api').debug(
      "Offline queue replay: using registered fetcher from registry",
      {
        key: entry.key,
        url: entry.url,
      },
    );
    return registeredFetcher;
  }

  // Fallback: reconstruct a basic fetch call from stored metadata
  // Allows replays even if the original fetcher isn't registered (app restarted)
  logger.category('api').debug(
    "Offline queue replay: reconstructing fetcher from stored metadata",
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

    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      const error: any = new Error(`HTTP ${response.status}: ${response.statusText}`);
      error.status = response.status;
      throw error;
    }

    return response.json();
  };
}

// ─── Convenience Re-exports ────────────────────────────────────────

/** Delegate to OfflineQueueManager for actual queue operations */
export const enqueueRequest = OfflineQueueManager.enqueue.bind(OfflineQueueManager);
export const getOfflineQueueStats = OfflineQueueManager.getStats.bind(OfflineQueueManager);
