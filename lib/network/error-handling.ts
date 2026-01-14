/**
 * Network Error Handling Utilities
 * 
 * Provides graceful degradation when network is unavailable.
 * Currently: Return stale cache on network errors
 * Future (Milestone 3+): Queue mutations, sync when online
 */

import { logger } from '../utils/logger';
import { NetworkDetection } from './network-detection';

/**
 * Check if an error is network-related
 */
export function isNetworkError(error: any): boolean {
  if (!error) return false;

  const errorMessage = error?.message?.toLowerCase() || '';
  const errorCode = error?.code;

  // Common network error patterns
  const networkPatterns = [
    'network',
    'offline',
    'timeout',
    'connection',
    'fetch',
    'enotfound',
    'econnrefused',
    'econnreset',
  ];

  for (const pattern of networkPatterns) {
    if (errorMessage.includes(pattern)) {
      return true;
    }
  }

  // Check common error codes
  if (
    errorCode === 'NETWORK_ERROR' ||
    errorCode === 'FETCH_ERROR' ||
    errorCode === 'TIMEOUT' ||
    errorCode === 'ENOTFOUND' ||
    errorCode === 'ECONNREFUSED' ||
    errorCode === 'ECONNRESET'
  ) {
    return true;
  }

  // HTTP status codes that indicate network issues
  if (error?.status >= 500 || error?.status === 0) {
    return true;
  }

  return false;
}

/**
 * Determine if we should serve stale cache on error
 * 
 * Strategy:
 * - Network error + offline → Serve stale
 * - Network error + slow network → Serve stale
 * - Server error (5xx) + has cache → Serve stale
 * - Client error (4xx) → Don't serve stale (real error)
 */
export function shouldServeStaleOnError(error: any, options: {
  isNetworkError: boolean;
  hasCache: boolean;
  isOnline: boolean;
}): boolean {
  const { isNetworkError, hasCache, isOnline } = options;

  // Only serve stale if we have cached data
  if (!hasCache) {
    return false;
  }

  // Network error + offline → Definitely serve stale
  if (isNetworkError && !isOnline) {
    return true;
  }

  // Network error + online but slow/unreliable → Serve stale
  if (isNetworkError && isOnline) {
    // Could be temporarily unreliable network
    return true;
  }

  // Server error (5xx) → Serve stale
  if (error?.status >= 500) {
    return true;
  }

  // Client error (4xx) → Don't serve stale
  return false;
}

/**
 * Log network error for debugging and monitoring
 */
export function logNetworkError(
  error: any,
  context: {
    key: string;
    operation: 'fetch' | 'mutation' | 'invalidate';
    isNetworkError: boolean;
    isOnline: boolean;
    servedStale?: boolean;
  }
): void {
  const { key, operation, isNetworkError, isOnline, servedStale } = context;

  if (servedStale) {
    logger.warn('network', `Serving stale cache for ${operation}:`, {
      key,
      isOnline,
      error: error?.message,
    });
  } else {
    logger.error('network', `${operation} failed for ${key}:`, {
      isNetworkError,
      isOnline,
      error: error?.message,
      status: error?.status,
    });
  }
}

/**
 * Options for graceful error handling
 */
export interface GracefulErrorOptions {
  /**
   * Try to serve stale cache on network errors
   * FUTURE: Will also queue mutations for later sync
   */
  gracefulDegradation?: boolean;

  /**
   * Show offline indicator to user
   * FUTURE: Display UI that we're using stale data
   */
  showOfflineIndicator?: boolean;
}

/**
 * Handle error gracefully with cache fallback
 * 
 * @returns { success: true, data } if stale cache was served
 * @returns { success: false, error } if error should be thrown
 */
export async function handleErrorGracefully(error: any, context: {
  key: string;
  operation: 'fetch' | 'mutation';
  getCachedData?: () => Promise<any>;
  options?: GracefulErrorOptions;
}): Promise<{ success: boolean; data?: any; error?: any }> {
  const { key, operation, getCachedData, options = {} } = context;
  const { gracefulDegradation = true } = options;
  // Note: showOfflineIndicator is reserved for future use (Milestone 3+)

  const isNetError = isNetworkError(error);
  const isOnline = NetworkDetection.isOnline();

  // Check if we have cached data
  let cachedData: any = undefined;
  if (gracefulDegradation && getCachedData) {
    try {
      cachedData = await getCachedData();
    } catch (cacheError) {
      logger.warn('network', 'Failed to retrieve cache for fallback:', { key, cacheError });
    }
  }

  // Determine if we should serve stale
  const shouldServeStale = shouldServeStaleOnError(error, {
    isNetworkError: isNetError,
    hasCache: cachedData !== undefined && cachedData !== null,
    isOnline,
  });

  if (shouldServeStale && cachedData) {
    logNetworkError(error, { key, operation, isNetworkError: isNetError, isOnline, servedStale: true });
    return { success: true, data: cachedData };
  }

  // No stale cache available - error should be thrown
  logNetworkError(error, { key, operation, isNetworkError: isNetError, isOnline, servedStale: false });
  return { success: false, error };
}
