/**
 * Phase 4 Enhancements for Offline Replay
 *
 * This module provides all Phase 4 enhancements:
 * 1. Auth-on-Replay: Inject fresh tokens during mutation replay
 * 2. Deterministic Redaction: Strip tokens/PII before storage
 * 3. Scheduled Retries: Persist nextAttemptAt with backoff + jitter
 * 4. Failure Telemetry: Per-entry tracking and observability
 * 5. Network Error Contracts: Standardized error type classification
 *
 * Architecture:
 * - RedactionManager: Handles deterministic field redaction
 * - AuthReplayManager: Coordinates auth token injection on replay
 * - NetworkErrorClassifier: Maps errors to standardized contracts
 * - OfflineQueueStats: Collects telemetry for observability
 * - BackoffScheduler: Manages scheduled retry timing with jitter
 */

import { OFFLINE_SYNC_DEFAULTS } from "@/config";
import type { AuthContext } from "@/lib/auth/auth-layer";
import { logger } from "@/lib/utils";
import {
  isCircuitBreakerOpen,
  recordCircuitBreakerFailure,
  recordCircuitBreakerSuccess,
} from "@/middleware/api";

import { RedactionManager } from "@/pure-algo-immutables/redaction-manager";
import type {
  AuthReplayMetadata,
  NetworkErrorContract,
  OfflineQueueStats,
  QueuedMutation,
} from "@/type-definitions/mutation-queue-types";

// Re-export QueuedMutation for test imports
export type { QueuedMutation };

// Re-export RedactionManager from centralized location
  export { RedactionManager };

/**
 * Phase 4: Auth Replay Manager
 *
 * Coordinates auth token injection and refresh during mutation replay.
 * Ensures replayed requests use fresh tokens from AuthLayer.
 */
export const AuthReplayManager = {
  /**
   * Prepare a mutation for replay with auth context
   *
   * @param mutation - Queued mutation
   * @returns Auth metadata for replay
   */
  async prepareAuthContext(
    mutation: QueuedMutation,
  ): Promise<AuthReplayMetadata> {
    return {
      authStrategy: mutation.authStrategy || "user",
      shouldRefreshToken: true, // Always refresh on replay
      lastTokenRefreshAt: undefined,
      authFailureCount: 0,
    };
  },

  /**
   * Inject fresh auth headers into a request for replay
   *
   * Used by sync handlers to ensure replayed mutations have valid tokens.
   *
   * @param mutation - Queued mutation
   * @param authLayer - Auth layer instance for token injection
   * @returns Headers with injected auth
   */
  async injectAuthHeaders(
    mutation: QueuedMutation,
    authLayer: any,
  ): Promise<Record<string, string>> {
    const headers: Record<string, string> = {};

    if (!mutation.authStrategy) {
      logger.category("auth").warn("Replay mutation has no authStrategy");
      return headers;
    }

    try {
      // Build auth context for the mutation replay
      // Determine HTTP method based on operation type
      const methodMap: Record<string, "POST" | "PUT" | "DELETE"> = {
        create: "POST",
        update: "PUT",
        delete: "DELETE",
      };
      const method = methodMap[mutation.operation] || "POST";

      const context: AuthContext = {
        url: `mutations/${mutation.table}`, // Simplified context URL
        method,
        endpoint: mutation.table, // Table name as endpoint
        retryCount: mutation.retryCount,
      };

      // Use proper AuthLayer API: injectAuthHeader with AuthContext
      const headersWithAuth = await authLayer.injectAuthHeader(
        headers,
        mutation.authStrategy,
        context,
      );

      return headersWithAuth;
    } catch (error) {
      logger
        .category("error")
        .error(
          `Error injecting auth on replay for ${mutation.authStrategy}:`,
          error,
        );
    }

    return headers;
  },

  /**
   * Check if auth failure during replay is retryable
   *
   * @param error - Error from replay attempt
   * @param authFailureCount - Number of auth failures so far
   * @returns true if should retry
   */
  isAuthFailureRetryable(error: any, authFailureCount: number): boolean {
    const errorCode = error?.statusCode;

    // Unauthorized (401) - token expired, refresh and retry
    if (errorCode === 401) {
      return authFailureCount < 2; // Try refresh once
    }

    // Forbidden (403) - permission issue, don't retry
    if (errorCode === 403) {
      return false;
    }

    return false;
  },
};

/**
 * Phase 4: Network Error Classifier
 *
 * Maps errors to standardized NetworkErrorContract types.
 * Used by _shouldQueueRequest to make robust queueing decisions.
 */
export const NetworkErrorClassifier = {
  /**
   * Classify an error into a standardized network error contract
   *
   * @param error - Error object or message
   * @param statusCode - HTTP status code if available
   * @returns Classified error contract
   */
  classify(error: any, statusCode?: number): NetworkErrorContract {
    const message = error?.message || String(error) || "Unknown error";
    const lowerMsg = message.toLowerCase();

    // Network errors (offline, timeout, DNS failure) - check message patterns
    if (
      lowerMsg.includes("network") ||
      lowerMsg.includes("offline") ||
      lowerMsg.includes("timeout") ||
      lowerMsg.includes("econnrefused") ||
      lowerMsg.includes("enotfound") ||
      lowerMsg.includes("fetch") ||
      lowerMsg.includes("unreachable")
    ) {
      return {
        type: "network",
        retryable: true,
        shouldQueue: true,
        suggestedBackoffMs: 2000,
        message,
      };
    }

    // Authentication errors (401, 403)
    if (statusCode === 401 || lowerMsg.includes("unauthorized")) {
      return {
        type: "auth",
        statusCode: 401,
        retryable: true, // Retry with fresh token
        shouldQueue: true,
        suggestedBackoffMs: 1000,
        message: "Unauthorized - token may have expired",
      };
    }

    if (statusCode === 403 || lowerMsg.includes("forbidden")) {
      return {
        type: "auth",
        statusCode: 403,
        retryable: false,
        shouldQueue: false,
        message: "Forbidden - insufficient permissions",
      };
    }

    // Validation errors (400)
    if (statusCode === 400 || lowerMsg.includes("validation")) {
      return {
        type: "validation",
        statusCode: 400,
        retryable: false,
        shouldQueue: false,
        message: "Validation failed - payload format invalid",
      };
    }

    // Conflict errors (409)
    if (
      statusCode === 409 ||
      lowerMsg.includes("conflict") ||
      lowerMsg.includes("version")
    ) {
      return {
        type: "conflict",
        statusCode: 409,
        retryable: true,
        shouldQueue: true,
        suggestedBackoffMs: 5000,
        message: "Conflict detected - local and server state differ",
      };
    }

    // Rate limiting (429)
    if (statusCode === 429 || lowerMsg.includes("rate limit")) {
      return {
        type: "rate_limit",
        statusCode: 429,
        retryable: true,
        shouldQueue: true,
        suggestedBackoffMs: 30000,
        message: "Rate limited - too many requests",
      };
    }

    // Server errors (5xx)
    if (statusCode && statusCode >= 500) {
      return {
        type: "server",
        statusCode,
        retryable: true,
        shouldQueue: true,
        suggestedBackoffMs: 5000,
        message: "Server error - temporary service disruption",
      };
    }

    // Errors without status code are treated as network errors
    if (statusCode === undefined) {
      return {
        type: "network",
        retryable: true,
        shouldQueue: true,
        suggestedBackoffMs: 2000,
        message,
      };
    }

    // Unknown
    return {
      type: "unknown",
      statusCode,
      retryable: false,
      shouldQueue: false,
      message,
    };
  },
};

/**
 * Phase 4: Backoff Scheduler
 *
 * Manages scheduled retry timing with exponential backoff + jitter.
 * Persists nextAttemptAt so retries survive app restarts.
 */
export const BackoffScheduler = {
  /**
   * Calculate next retry time with exponential backoff + jitter
   *
   * @param mutation - Queued mutation
   * @param baseMs - Base backoff (default: 2000ms)
   * @returns Next attempt timestamp
   */
  calculateNextAttemptAt(
    mutation: QueuedMutation,
    baseMs: number = OFFLINE_SYNC_DEFAULTS.retryBaseMs,
  ): number {
    const multiplier = Math.pow(2, mutation.retryCount);
    const jitter = 0.9 + Math.random() * 0.2; // ±10% random factor

    const backoffMs = Math.floor(baseMs * multiplier * jitter);
    const cappedBackoffMs = Math.min(backoffMs, OFFLINE_SYNC_DEFAULTS.backoffCapMs); // Cap at 5 minutes

    const nextAttemptAt = Date.now() + cappedBackoffMs;

    logger
      .category("storage")
      .debug(
        `Scheduled retry for ${mutation.id}: retryCount=${mutation.retryCount}, ` +
          `backoffMs=${cappedBackoffMs}, nextAttemptAt=${new Date(nextAttemptAt).toISOString()}`,
      );

    return nextAttemptAt;
  },

  /**
   * Check if a mutation is ready to retry based on nextAttemptAt
   *
   * @param mutation - Queued mutation
   * @returns true if current time >= nextAttemptAt
   */
  isReadyToRetry(mutation: QueuedMutation): boolean {
    if (!mutation.nextAttemptAt) {
      return true; // No schedule, ready now
    }
    return Date.now() >= mutation.nextAttemptAt;
  },

  /**
   * Filter mutations that are ready to retry
   *
   * @param mutations - List of mutations
   * @returns Mutations ready for immediate retry
   */
  filterReadyMutations(mutations: QueuedMutation[]): QueuedMutation[] {
    return mutations.filter((m) => this.isReadyToRetry(m));
  },

  /**
   * Get next retry time for a mutation
   *
   * @param mutation - Queued mutation
   * @returns Milliseconds until next attempt (0 if ready)
   */
  getTimeUntilRetry(mutation: QueuedMutation): number {
    if (!mutation.nextAttemptAt) {
      return 0;
    }
    return Math.max(0, mutation.nextAttemptAt - Date.now());
  },
};

/**
 * Phase 4: Offline Queue Stats Collector
 *
 * Collects telemetry on queued mutations for observability.
 * Used by getStats() to expose failure reasons and timing info.
 */
export const OfflineQueueStatsCollector = {
  /**
   * Collect comprehensive stats from queue
   *
   * @param mutations - All queued mutations
   * @param lastSyncResult - Result of last sync attempt
   * @returns Aggregated statistics
   */
  collectStats(
    mutations: QueuedMutation[],
    lastSyncResult?: any,
  ): OfflineQueueStats {
    const stats: OfflineQueueStats = {
      totalQueued: mutations.length,
      pending: 0,
      failuresByType: {
        network: 0,
        auth: 0,
        conflict: 0,
        validation: 0,
        rate_limit: 0,
        server: 0,
        unknown: 0,
      },
      avgRetryCount: 0,
      scheduledForRetry: 0,
    };

    if (mutations.length === 0) {
      return stats;
    }

    let totalRetries = 0;
    let oldestTimestamp = Infinity;

    for (const mutation of mutations) {
      // Distinguish between pending (never-failed) and actual failures
      const hasFailed = mutation.retryCount > 0 || mutation.lastErrorType;

      if (hasFailed) {
        // Count by error type only for mutations that have actually failed
        const errorType: keyof typeof stats.failuresByType =
          mutation.lastErrorType || "unknown";
        /* eslint-disable-next-line security/detect-object-injection -- safe: errorType is from internal enum or 'unknown' */
        stats.failuresByType[errorType]++;
      } else {
        // Track mutations awaiting their first sync attempt
        stats.pending++;
      }

      // Track retry count
      totalRetries += mutation.retryCount;

      // Track scheduled for retry
      if (!BackoffScheduler.isReadyToRetry(mutation)) {
        stats.scheduledForRetry++;
      }

      // Track oldest mutation
      if (mutation.timestamp < oldestTimestamp) {
        oldestTimestamp = mutation.timestamp;
      }
    }

    stats.avgRetryCount = Math.round(totalRetries / mutations.length);
    stats.oldestMutationAge =
      oldestTimestamp === Infinity ? undefined : Date.now() - oldestTimestamp;

    if (lastSyncResult) {
      stats.lastSyncResult = {
        timestamp: lastSyncResult.timestamp || Date.now(),
        succeeded: lastSyncResult.syncedCount || 0,
        failed: lastSyncResult.failedCount || 0,
        conflicted: lastSyncResult.conflictedCount || 0,
      };
    }

    return stats;
  },

  /**
   * Format stats as human-readable string for logging
   *
   * @param stats - Queue statistics
   * @returns Formatted string
   */
  formatStats(stats: OfflineQueueStats): string {
    const lines = [
      `Queue Stats: ${stats.totalQueued} queued`,
      `  Failures: network=${stats.failuresByType.network}, auth=${stats.failuresByType.auth}, ` +
        `conflict=${stats.failuresByType.conflict}, validation=${stats.failuresByType.validation}`,
      `  Scheduled for retry: ${stats.scheduledForRetry}`,
      `  Avg retries: ${stats.avgRetryCount}`,
    ];

    if (stats.oldestMutationAge !== undefined) {
      lines.push(
        `  Oldest queued: ${Math.round(stats.oldestMutationAge / 1000)}s ago`,
      );
    }

    if (stats.lastSyncResult) {
      lines.push(
        `  Last sync: ${stats.lastSyncResult.succeeded} ✓, ` +
          `${stats.lastSyncResult.failed} ✗, ` +
          `${stats.lastSyncResult.conflicted} conflicts`,
      );
    }

    return lines.join("\n");
  },
};

/**
 * Phase 4: Circuit Breaker Replay Manager
 *
 * Tracks circuit breaker state during replay to avoid cascading failures.
 * Updates CB state when replays fail to prevent aggressive retry storms.
 */
export const CircuitBreakerReplayManager = {
  /**
   * Get circuit breaker key for a mutation
   *
   * @param mutation - Queued mutation
   * @returns Circuit breaker key (table name or custom)
   */
  getCircuitBreakerKey(mutation: QueuedMutation): string {
    // Use table name as CB key
    return `offline:${mutation.table}`;
  },

  /**
   * Record replay failure in circuit breaker
   *
   * When a replay fails, update the CB to avoid immediate aggressive retries.
   * This prevents cascading failures if the server is under load.
   *
   * @param mutation - Queued mutation that failed
   * @param error - Error that occurred
   * @param isNetworkError - Whether error is network-related
   */
  async recordReplayFailure(
    mutation: QueuedMutation,
    error: any,
    isNetworkError: boolean = false,
  ): Promise<void> {
    try {
      const key = this.getCircuitBreakerKey(mutation);

      // Record failure in circuit breaker via middleware
      recordCircuitBreakerFailure(key, isNetworkError);

      if (isCircuitBreakerOpen(key)) {
        logger
          .category("storage")
          .warn(`Circuit breaker OPEN for ${key} after replay failure`, {
            mutationId: mutation.id,
            error: error?.message,
          });
      } else {
        logger
          .category("storage")
          .debug(`Circuit breaker failure recorded for ${key}`, {
            mutationId: mutation.id,
            isNetworkError,
          });
      }
    } catch (err) {
      logger
        .category("error")
        .warn("Failed to record CB state on replay failure:", err);
    }
  },

  /**
   * Record replay success in circuit breaker
   *
   * When a replay succeeds, reset CB state if needed.
   *
   * @param mutation - Queued mutation that succeeded
   */
  async recordReplaySuccess(mutation: QueuedMutation): Promise<void> {
    try {
      const key = this.getCircuitBreakerKey(mutation);

      // Record success in circuit breaker via middleware
      recordCircuitBreakerSuccess(key);

      logger
        .category("storage")
        .debug(`Circuit breaker success recorded for ${key}`, {
          mutationId: mutation.id,
        });
    } catch (err) {
      logger
        .category("error")
        .warn("Failed to record CB success on replay:", err);
    }
  },

  /**
   * Check if a mutation's endpoint is open circuit (should not retry)
   *
   * @param mutation - Queued mutation
   * @returns true if circuit is Open (should not retry)
   */
  async isCircuitOpen(mutation: QueuedMutation): Promise<boolean> {
    try {
      const key = this.getCircuitBreakerKey(mutation);
      // Check circuit breaker state via middleware
      return isCircuitBreakerOpen(key);
    } catch {
      return false; // If CB check fails, allow retry
    }
  },
};

/**
 * Phase 4: Fetcher Registry Fallback Manager
 *
 * Improves reconstructed fetchers to properly handle interceptors and auth.
 * Provides safe fallbacks when sync handlers need to reconstruct fetch behavior.
 */
export const FetcherRegistryFallback = {
  /**
   * Create an enhanced fetcher with auth and error handling
   *
   * For sync handlers that need to make HTTP requests directly,
   * provides a fetcher that handles auth injection and error classification.
   *
   * @param baseUrl - Base URL for requests
   * @param mutation - Current mutation (for auth context)
   * @param authLayer - AuthLayer for token injection
   * @returns Enhanced fetch function
   */
  async createAuthenticatedFetcher(
    baseUrl: string,
    mutation: QueuedMutation,
    authLayer?: any,
  ): Promise<(url: string, options?: RequestInit) => Promise<Response>> {
    return async (url: string, options?: RequestInit): Promise<Response> => {
      const fullUrl = url.startsWith("http") ? url : `${baseUrl}${url}`;

      // Prepare headers with auth if available
      let headerObject: Record<string, string> = {};
      if (options?.headers instanceof Headers) {
        options.headers.forEach((value, key) => {
          /* eslint-disable-next-line security/detect-object-injection -- safe: copying header entries into local object */
          headerObject[key] = value;
        });
      } else if (options?.headers) {
        headerObject = { ...(options.headers as Record<string, string>) };
      }

      if (authLayer && mutation.authStrategy) {
        try {
          // Build auth context for this request
          const method = (options?.method || "GET") as
            | "GET"
            | "POST"
            | "PUT"
            | "DELETE"
            | "PATCH"
            | "HEAD";

          const context: AuthContext = {
            url: fullUrl,
            method,
            endpoint: mutation.table,
            retryCount: mutation.retryCount,
          };

          // Use proper AuthLayer API: injectAuthHeader with AuthContext
          headerObject = await authLayer.injectAuthHeader(
            headerObject,
            mutation.authStrategy,
            context,
          );
        } catch (err) {
          logger
            .category("error")
            .warn("Failed to inject auth in fallback fetcher:", err);
        }
      }

      // Make request
      try {
        const response = await fetch(fullUrl, {
          ...options,
          headers: headerObject,
        });

        return response;
      } catch (error) {
        logger
          .category("error")
          .error(`Fallback fetcher failed for ${fullUrl}:`, error);
        throw error;
      }
    };
  },

  /**
   * Create a safe HTTP client for sync handler use
   *
   * Provides a simple, safe way for sync handlers to make authenticated requests
   * with automatic error classification.
   *
   * @param mutation - Current mutation
   * @param authLayer - AuthLayer for token injection
   * @returns HTTP client methods
   */
  async createHttpClient(mutation: QueuedMutation, authLayer?: any) {
    const fetcher = await this.createAuthenticatedFetcher(
      "",
      mutation,
      authLayer,
    );

    return {
      /**
       * Perform GET request
       */
      get: async <T = any>(url: string): Promise<T> => {
        const response = await fetcher(url, { method: "GET" });
        if (!response.ok) {
          const error = new Error(`GET ${url} failed: ${response.status}`);
          Object.assign(error, { statusCode: response.status });
          throw error;
        }
        return response.json();
      },

      /**
       * Perform POST request
       */
      post: async <T = any>(url: string, data: any): Promise<T> => {
        const response = await fetcher(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!response.ok) {
          const error = new Error(`POST ${url} failed: ${response.status}`);
          Object.assign(error, { statusCode: response.status });
          throw error;
        }
        return response.json();
      },

      /**
       * Perform PATCH request
       */
      patch: async <T = any>(url: string, data: any): Promise<T> => {
        const response = await fetcher(url, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
        if (!response.ok) {
          const error = new Error(`PATCH ${url} failed: ${response.status}`);
          Object.assign(error, { statusCode: response.status });
          throw error;
        }
        return response.json();
      },

      /**
       * Perform DELETE request
       */
      delete: async <T = any>(url: string): Promise<T> => {
        const response = await fetcher(url, { method: "DELETE" });
        if (!response.ok) {
          const error = new Error(`DELETE ${url} failed: ${response.status}`);
          Object.assign(error, { statusCode: response.status });
          throw error;
        }
        return response.json();
      },
    };
  },

  /**
   * Validate sync handler result for safety
   *
   * Ensures sync handler results have proper error classification
   * for telemetry and retry decisions.
   *
   * @param result - Sync handler result
   * @returns Validated result with error classification
   */
  validateSyncHandlerResult(result: any): any {
    if (!result) {
      return {
        success: false,
        error: "No result from sync handler",
      };
    }

    // Ensure error type is set if failed
    if (!result.success && !result.errorType) {
      result.errorType = "unknown";
    }

    return result;
  },

  /**
   * Document limitations of fallback fetcher
   *
   * Logs what fallback fetcher does NOT support so developers know
   * when they need a full sync handler instead.
   */
  logLimitations(): void {
    logger
      .category("storage")
      .info(
        "Fallback fetcher limitations:",
        [
          "- No automatic request/response validation (use Zod in sync handler)",
          "- No interceptor hooks (apply manually if needed)",
          "- No retry logic (sync manager handles)",
          "- No automatic cache invalidation (done by sync manager)",
          "- No conflict detection (implement in sync handler)",
        ].join("\n"),
      );
  },
};

/**
 * Phase 4: All Enhancements Exported
 *
 * High-level API for Phase 4 features
 */
export const Phase4Enhancements = {
  // RedactionManager now imported from centralized utils
  RedactionManager: RedactionManager as typeof RedactionManager,
  AuthReplayManager,
  NetworkErrorClassifier,
  BackoffScheduler,
  OfflineQueueStatsCollector,
  CircuitBreakerReplayManager,
  FetcherRegistryFallback,

  /**
   * Initialize and prepare a mutation for queueing
   *
   * @param mutation - Raw mutation before queueing
   * @returns Mutation with Phase 4 enhancements applied
   */
  async prepareForQueue(
    mutation: Omit<QueuedMutation, "id" | "timestamp" | "retryCount">,
  ): Promise<Omit<QueuedMutation, "id" | "timestamp" | "retryCount">> {
    // Apply redaction to payload
    const redactedPayload =
      RedactionManager.redactObject(mutation.payload) || {};

    // Log validation for testing
    const foundSensitive = RedactionManager.validateRedaction(redactedPayload);
    const remainingSensitiveCount = foundSensitive.length;
    if (remainingSensitiveCount > 0) {
      logger
        .category("security")
        .warn(
          `WARNING: Detected ${remainingSensitiveCount} potentially sensitive fields remaining after redaction. Review redaction rules to ensure all sensitive data is stripped before queueing.`,
        );
    }

    return {
      ...mutation,
      payload: redactedPayload,
      // nextAttemptAt will be set by BackoffScheduler when mutation fails
      // authStrategy should be set by API client
    };
  },
};
