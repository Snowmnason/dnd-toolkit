import { logger } from "@/lib/utils";
import {
    InterceptorManager,
    parseEndpoint,
    type RequestInterceptor,
} from "./interceptor";

/**
 * Request Interceptor Coordination
 *
 * Provides request-lifecycle-specific wrappers around InterceptorManager.
 * The core interceptor engine (registration, serial execution, timeout/nonBlocking)
 * lives in interceptor.ts. This module adds:
 *
 * - **Before-request**: Build proper context (url, init, endpoint) and run hooks
 * - **Queued notification**: Standardized error-hook call when a request is queued
 *   for offline replay (used by both circuit-breaker-open and offline-queue paths)
 *
 * After-response and error hooks for the retry lifecycle are coordinated
 * by request-retry.ts (called inside the retry loop).
 */

// ─── Before-Request Coordination ───────────────────────────────────

/**
 * Run onBeforeRequest interceptor hooks for a request attempt.
 *
 * Creates a fresh RequestInit for each attempt (prevents header accumulation
 * across retries) and attaches the abort signal for quality-based abort-and-retry.
 *
 * @param url - Enriched request key or URL
 * @param abortSignal - AbortController signal for this attempt
 * @param interceptors - Client-specific interceptors for this request
 * @returns The populated RequestInit (with headers set by interceptors) and parsed endpoint
 */
export async function runBeforeRequestHooks(
  url: string,
  abortSignal: AbortSignal,
  interceptors?: RequestInterceptor[],
): Promise<{ requestInit: RequestInit; endpoint: string | undefined }> {
  // Create a fresh requestInit for each retry attempt
  // Ensures each attempt starts with clean state
  const requestInit: RequestInit = {
    signal: abortSignal,
  };
  const endpoint = parseEndpoint(url);

  await InterceptorManager.executeBeforeRequestHooks(
    {
      url,
      init: requestInit,
      endpoint,
    },
    interceptors,
  );

  return { requestInit, endpoint };
}

/**
 * Normalize HeadersInit to a plain Record<string, string>.
 *
 * Supports all HeadersInit formats:
 * - Headers object → Object.fromEntries
 * - Array of tuples → Object.fromEntries
 * - Plain object → use as-is
 *
 * @param headersInit - Headers in any supported format
 * @returns Plain object with string keys and values
 */
export function normalizeHeaders(
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

// ─── Queued Request Notification ───────────────────────────────────

/**
 * Notify interceptors that a request was queued for offline replay.
 *
 * Called when a request is queued due to:
 * - Circuit breaker being Open (fast-fail → queue for later)
 * - Network being offline (catch path → queue for replay)
 * - Network-level error (TypeError, AbortError)
 *
 * This is an observational notification only — interceptors cannot suppress
 * or modify the queuing decision. The `queued: true` flag lets interceptors
 * distinguish between actual failures and queued-for-later requests.
 *
 * @param error - The error that triggered queuing
 * @param url - Enriched request key or URL
 * @param endpoint - Parsed endpoint name (optional)
 * @param interceptors - Client-specific interceptors for this request
 */
export async function notifyRequestQueued(
  error: Error,
  url: string,
  endpoint?: string,
  interceptors?: RequestInterceptor[],
): Promise<void> {
  try {
    const statusCode = (error as any)?.status || (error as any)?.code;

    await InterceptorManager.executeErrorHooks(
      {
        error,
        url,
        init: {},
        statusCode,
        isNetworkError: false,
        endpoint,
        queued: true,
      },
      interceptors,
    );
  } catch (hookErr) {
    logger.category('api').warn(
      "Interceptor error while reporting queued request",
      hookErr,
    );
  }
}

// ─── Convenience Re-exports ────────────────────────────────────────

// Re-export core interceptor types and utilities for consumers
// that only need request-lifecycle integration (avoids importing from two files)
export { InterceptorManager, parseEndpoint } from "./interceptor";
export type { RequestInterceptor } from "./interceptor";

