/**
 * API Manager — Orchestration Hub for all API requests
 *
 * This is the ONLY entry point for lib modules to make API requests.
 * No lib module should import from system/API directly.
 *
 * Manager Responsibilities:
 * 1. Validate request data (key format, options shape, security checks)
 * 2. Call middleware (executeRequest → RequestManager)
 * 3. Return results to caller
 *
 * Architecture:
 *   lib modules → api-manager (validate) → middleware/api/request-service (network check, normalize) → system/API/RequestManager (transport)
 *
 * Does NOT:
 * - Check network status (middleware handles it)
 * - Implement HTTP transport (system handles it)
 * - Handle retries/caching/dedup (system handles it)
 */

import {
    executeRequest,
    type RequestInterceptor,
    type RequestOptions,
} from '@/middleware/api';

// Re-export types so consumers only need @/lib/api
export type { RequestInterceptor, RequestOptions };

// ─── Validation ────────────────────────────────────────────────────

/**
 * Validate a request key before dispatching.
 * Keys must be non-empty strings, no control characters, reasonable length.
 *
 * @param key - Request key to validate
 * @throws Error if key is invalid
 */
function validateRequestKey(key: string): void {
  if (!key || typeof key !== 'string') {
    throw new Error('[api-manager] Request key must be a non-empty string');
  }

  if (key.length > 2048) {
    throw new Error(`[api-manager] Request key too long (${key.length} chars, max 2048)`);
  }

  // Check for control characters (potential injection)
   
  if (/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(key)) {
    throw new Error('[api-manager] Request key contains invalid control characters');
  }
}

/**
 * Validate request options before dispatching.
 * Catches obvious misconfigurations early before they hit the transport layer.
 *
 * @param options - Request options to validate
 * @throws Error if options are malformed
 */
function validateRequestOptions(options?: RequestOptions): void {
  if (!options) return;

  if (options.retries !== undefined && (options.retries < 0 || options.retries > 10)) {
    throw new Error(`[api-manager] Invalid retries: ${options.retries} (must be 0-10)`);
  }

  if (options.timeout !== undefined && (options.timeout < 0 || options.timeout > 120000)) {
    throw new Error(`[api-manager] Invalid timeout: ${options.timeout}ms (must be 0-120000)`);
  }

  if (options.retryDelay !== undefined && options.retryDelay < 0) {
    throw new Error(`[api-manager] Invalid retryDelay: ${options.retryDelay}ms (must be >= 0)`);
  }
}

// ─── Core API ──────────────────────────────────────────────────────

/**
 * Execute a request through the full pipeline: validate → middleware → system.
 *
 * This is the primary function for all API/database requests from lib modules.
 * Replaces direct `RequestManager.fetch()` calls.
 *
 * @param key - Unique request key for deduplication (URL or cache key like 'user:create:123')
 * @param fetcher - Async function that performs the actual work (DB query, HTTP fetch, etc.)
 * @param options - Request options (retries, timeout, auth, caching, etc.)
 * @returns Result from the fetcher, or null if failOpen/queued
 */
export async function fetchRequest<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: RequestOptions,
): Promise<T | null> {
  // 1. Validate
  validateRequestKey(key);
  validateRequestOptions(options);

  // 2. Dispatch to middleware → system
  return executeRequest(key, fetcher, options);
}

// ─── Convenience Functions ─────────────────────────────────────────

/**
 * Execute a read-only query with standard defaults.
 * Shorthand for fetchRequest with dedupe=true.
 *
 * @param key - Cache key (e.g., 'user:123', 'worlds:list')
 * @param fetcher - Async function that fetches data
 * @param options - Optional overrides
 */
export async function fetchQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: RequestOptions,
): Promise<T | null> {
  return fetchRequest(key, fetcher, {
    dedupe: true,
    ...options,
  });
}

/**
 * Execute a mutation (create/update/delete) with standard defaults.
 * Shorthand for fetchRequest with dedupe=false.
 *
 * @param key - Unique key (e.g., 'user:create:abc123')
 * @param fetcher - Async function that performs the mutation
 * @param options - Optional overrides
 */
export async function fetchMutation<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: RequestOptions,
): Promise<T | null> {
  return fetchRequest(key, fetcher, {
    dedupe: false,
    ...options,
  });
}

// TODO: Add pre/post-operation hooks when hook system is ready


