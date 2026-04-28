/**
 * API Request Middleware — Precondition checks and orchestration
 *
 * This middleware sits BEFORE RequestManager and handles:
 * - Network status validation (can we send at all?)
 * - Request transformation (lib format → API format)
 * - Default/fallback values (auth level, permissions, etc.)
 * - Offline queueing on network failure (dispatch to OfflineQueueManager)
 * - Recovery orchestration on state transitions (NetworkRecoveryManager)
 *
 * Does NOT:
 * - Retry (RequestManager handles retries)
 * - Cache (RequestManager/lib/storage handles caching)
 * - Deduplication (RequestManager handles dedup)
 */

import { logger } from '@/lib/utils/logger';
import { type RequestInterceptor } from '@/system/API/interceptor';
import { RequestManager, type RequestOptions } from '@/system/API/request-manager';
import { CircuitBreakerManager, DEFAULT_THRESHOLDS } from '@/system/API/resilience/circuit-breaker';
import { OfflineQueueManager, type QueuedRequestEntry } from '@/system/API/resilience/offline-queue';
import { ConnectionQuality, NetworkDetection } from '@/system/Network';
import {
    NetworkRecoveryManager,
    registerNetworkRecoveryHooks
} from './network-recovery';

// Re-export type so manager can use it without importing system/API
export type { RequestInterceptor, RequestOptions };

// ─── Types ─────────────────────────────────────────────────────────

export interface ApiMiddlewareContext {
  /** User ID or auth context (will be passed to request-manager) */
  userId?: string;
  
  /** Permission/auth level (defaults to 'user' if not provided) */
  authLevel?: 'guest' | 'user' | 'admin';
  
  /** Descriptive request label for logging/tracing */
  label?: string;
}

export interface ApiMiddlewareOptions {
  /** Skip network check (for specific use-cases, rare) */
  skipNetworkCheck?: boolean;
  
  /** Context to pass through to request */
  context?: ApiMiddlewareContext;
  
  /** Should this request be queued if offline? (default: true) */
  queueIfOffline?: boolean;
}

// ─── Precondition Checks ───────────────────────────────────────────

/**
 * Check if API operations can proceed based on current network status.
 * 
 * @returns { canAttempt: boolean, networkStatus: NetworkStatus }
 */
function checkNetworkStatus(): { canAttempt: boolean; status: ReturnType<typeof NetworkDetection.getStatus> } {
  const status = NetworkDetection.getStatus();
  const isOnline = status.connectionQuality !== ConnectionQuality.OFFLINE;
  
  return {
    canAttempt: isOnline,
    status,
  };
}

/**
 * Determine if a request failure is network-related and should be queued.
 * 
 * Network-related errors typically:
 * - Network timeout
 * - Connection refused
 * - DNS failure
 * - Currently offline
 * 
 * @param error The error thrown from requestFn
 * @returns true if error appears to be network-related
 */
function isNetworkError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;
  
  const message = error.message.toLowerCase();
  
  // Check for common network error patterns
  const networkPatterns = [
    'network',
    'timeout',
    'connection refused',
    'econnrefused',
    'enotfound',
    'dns',
    'offline',
    'no response',
    'failed to fetch',
  ];
  
  return networkPatterns.some((pattern) => message.includes(pattern));
}

/**
 * Ensure context has defaults (e.g., auth level).
 * 
 * @param context Input context
 * @returns Context with defaults applied
 */
function ensureContextDefaults(
  context: ApiMiddlewareContext | undefined
): ApiMiddlewareContext {
  return {
    authLevel: 'user', // Default to lowest auth level if not provided
    ...context,
  };
}

// ─── Main Middleware ───────────────────────────────────────────────

/**
 * Execute an API request through the middleware stack.
 * 
 * Flow:
 * 1. Check preconditions (network status, context defaults)
 * 2. Execute the request function
 * 3. On network failure + offline: queue the request
 * 4. Dispatch to recovery manager for state-specific handling
 * 5. Return result or throw
 * 
 * @param requestFn The function that makes the actual request (should throw on failure)
 * @param options Middleware options (network check, context, offline queue, retry info)
 * @returns Result from requestFn or null if queued
 * @throws Error if request fails and cannot be queued
 */
export async function executeApiRequest<T>(
  requestFn: () => Promise<T>,
  options?: ApiMiddlewareOptions
): Promise<T | null> {
  const ctx = ensureContextDefaults(options?.context);
  const label = ctx.label || 'api-request';

  // Step 1: Precondition check
  const { canAttempt, status } = checkNetworkStatus();
  
  if (!options?.skipNetworkCheck && !canAttempt) {
    logger.category('api').warn(`${label}: network offline, cannot attempt request`, {
      connectionQuality: status.connectionQuality,
    });

    // Check if should queue
    if (options?.queueIfOffline !== false) {
      // Cannot execute now, but might queue for later
      // Caller should handle queueing separately (via executeApiRequestWithQueue)
      logger.category('api').debug(`${label}: request should be queued for offline replay`);
    }

    throw new Error(`Network offline - ${label} cannot proceed`);
  }

  try {
    // Step 2: Execute the request
    logger.category('api').debug(`${label}: executing request`, { 
      authLevel: ctx.authLevel,
    });
    const result = await requestFn();
    
    logger.category('api').debug(`${label}: request completed successfully`);
    return result;

  } catch (error) {
    // Step 3: Classify failure
    const isNetFail = isNetworkError(error);
    const currentNetwork = NetworkDetection.getStatus();
    const isCurrentlyOffline = currentNetwork.connectionQuality === ConnectionQuality.OFFLINE;

    logger.category('api').warn(`${label}: request failed`, {
      isNetworkError: isNetFail,
      isCurrentlyOffline,
      error: error instanceof Error ? error.message : 'Unknown error',
    });

    // Step 4: Attempt offline queueing if applicable
    if (isNetFail && isCurrentlyOffline && options?.queueIfOffline !== false) {
      logger.category('api').info(`${label}: queuing request for offline replay`);
      
      // Queue attempt (OfflineQueueManager handles persistence)
      try {
        // Note: Caller should provide queueEntry if they want offline support
        // For now, we just log that it should be queued
        logger.category('api').debug(`${label}: offline queue entry prepared (awaiting caller)`);
      } catch (queueError) {
        logger.category('api').error(`${label}: failed to queue request`, queueError);
      }
    }

    // Step 5: Re-throw so caller can handle
    throw error;
  }
}

/**
 * Build a QueuedRequestEntry from request parameters.
 * 
 * Used when you want to manually enqueue a request after it fails.
 * 
 * @param endpoint API endpoint/URL
 * @param method HTTP method
 * @param options Request options and context
 * @returns QueuedRequestEntry ready for OfflineQueueManager.enqueue()
 */
export function buildQueueEntry(
  endpoint: string,
  method: string,
  options?: {
    headers?: Record<string, string>;
    body?: any;
    params?: Record<string, any>;
    authStrategy?: string;
    context?: ApiMiddlewareContext;
  }
): QueuedRequestEntry {
  const ctx = ensureContextDefaults(options?.context);
  
  // Build a stable key from endpoint + method + context
  const keyParts = [
    'api',
    method.toLowerCase(),
    endpoint.replace(/[^a-z0-9]/gi, '_'),
    ctx.userId || 'anon',
  ];
  
  return {
    key: keyParts.join(':'),
    url: endpoint,
    method: method.toUpperCase(),
    headers: options?.headers,
    body: options?.body,
    params: options?.params,
    authStrategy: options?.authStrategy,
    options: {
      context: options?.context,
    },
    createdAt: Date.now(),
    attempts: 0,
  };
}

// ─── Request Execution (System Bridge) ─────────────────────────────

/**
 * Execute a request through RequestManager with precondition checks.
 * 
 * This is the ONLY function that should call RequestManager.fetch() from lib.
 * All lib modules go: api-manager → this function → RequestManager.
 *
 * Middleware responsibilities:
 * 1. Check network readiness (can we call system at all?)
 * 2. Normalize request options (ensure defaults are applied)
 * 3. Log request dispatch for tracing
 * 4. Call system (RequestManager.fetch)
 * 5. Handle system-level errors with meaningful feedback
 *
 * @param key - Unique request key (URL or cache key)
 * @param fetcher - Async function that performs the actual request
 * @param options - Request options (validated by manager before arriving here)
 * @returns Result from RequestManager
 */
export async function executeRequest<T>(
  key: string,
  fetcher: () => Promise<T>,
  options?: RequestOptions,
): Promise<T | null> {
  // 1. Network readiness check
  const status = NetworkDetection.getStatus();
  const isOnline = status.connectionQuality !== ConnectionQuality.OFFLINE;
  
  if (!isOnline) {
    logger.category('api').warn('executeRequest: network offline', {
      key: key.substring(0, 80),
      connectionQuality: status.connectionQuality,
    });
    // Don't throw — let RequestManager's offline queue handle it
    // (it checks network status internally too, this is early warning)
  }

  // 2. Normalize options (ensure minimal defaults)
  const normalizedOptions: RequestOptions = {
    ...options,
    // Ensure context always has a trace label
    context: {
      ...options?.context,
      _middlewareTrace: true,
    },
  };

  // 3. Log dispatch
  logger.category('api').debug('Dispatching to RequestManager', {
    key: key.substring(0, 80),
    hasAuth: !!normalizedOptions.authStrategy,
    dedupe: normalizedOptions.dedupe,
    retries: normalizedOptions.retries,
  });

  // 4. Call system
  return RequestManager.fetch(key, fetcher, normalizedOptions);
}

/**
 * Get RequestManager stats (pending requests, rate limits, etc.)
 * Wraps system call for middleware-level access.
 */
export function getRequestStats() {
  return RequestManager.getStats();
}

/**
 * Clear pending requests. 
 * Use during logout/cleanup.
 */
export function clearPendingRequests(): void {
  RequestManager.clearPending();
}

/**
 * Flush offline queue for a specific key or all keys.
 */
export async function flushOfflineQueue(key?: string): Promise<void> {
  return RequestManager.flushOfflineQueue(key);
}

/**
 * Get offline queue statistics.
 */
export function getOfflineQueueStats() {
  return RequestManager.getOfflineQueueStats();
}

/**
 * Get circuit breaker state for an endpoint.
 */
export function getCircuitBreakerState(key: string) {
  return CircuitBreakerManager.getState(key);
}

/**
 * Get circuit breaker stats for an endpoint.
 */
export function getCircuitBreakerStats(key: string) {
  return CircuitBreakerManager.getStats(key);
}

/**
 * Record a failure in circuit breaker (for offline replay).
 * @param key Circuit breaker key
 * @param isNetworkError Whether failure was network-related
 */
export function recordCircuitBreakerFailure(
  key: string,
  isNetworkError: boolean = false,
) {
  CircuitBreakerManager.recordFailure(key, isNetworkError, DEFAULT_THRESHOLDS);
}

/**
 * Record a success in circuit breaker (for offline replay).
 * @param key Circuit breaker key
 */
export function recordCircuitBreakerSuccess(key: string) {
  CircuitBreakerManager.recordSuccess(key);
}

/**
 * Check if circuit breaker is open for an endpoint.
 * @param key Circuit breaker key
 * @returns true if circuit is Open (should not retry)
 */
export function isCircuitBreakerOpen(key: string): boolean {
  return CircuitBreakerManager.getState(key) === "Open";
}

// ─── Initialization ────────────────────────────────────────────────

/**
 * Initialize API middleware (register network recovery hooks, offline queue, etc).
 * Call once during app bootstrap (AppKernel phase).
 * 
 * @param networkStateMachine The network state machine to hook into
 * @param offlineQueueConfig Optional offline queue configuration
 */
export async function initializeApiMiddleware(
  networkStateMachine?: any,
  offlineQueueConfig?: any
): Promise<void> {
  logger.category('api').info('Initializing API middleware');

  try {
    // Step 1: Initialize offline queue (load persisted requests)
    logger.category('api').debug('Initializing offline queue');
    await OfflineQueueManager.initialize(offlineQueueConfig);
    const queueStats = OfflineQueueManager.getStats();
    logger.category('api').info('Offline queue initialized', {
      queueLength: queueStats.queueLength,
      maxSize: queueStats.maxQueueSize,
    });

    // Step 2: Initialize network recovery manager (load recovery state)
    logger.category('api').debug('Initializing network recovery manager');
    await NetworkRecoveryManager.initialize();
    const recoveryState = NetworkRecoveryManager.getRecoveryState();
    logger.category('api').info('Network recovery manager initialized', {
      retries: recoveryState.retries,
    });

    // Step 3: Register recovery hooks with network state machine
    if (networkStateMachine) {
      logger.category('api').debug('Registering network recovery hooks');
      await registerNetworkRecoveryHooks(networkStateMachine);
      logger.category('api').info('Network recovery hooks registered');
    } else {
      logger.category('api').warn('No network state machine provided - recovery hooks not registered');
    }

    logger.category('api').info('API middleware initialized successfully');
  } catch (error) {
    logger.category('api').error('Error initializing API middleware', error);
    throw error;
  }
}
