/**
 * Network Detection & Error Handling Module
 * 
 * Provides:
 * - Cross-platform network status detection (web, iOS, Android)
 * - Graceful degradation (return stale cache on network errors)
 * - Network error classification
 * - Foundation for future offline mode (Milestone 3+)
 */

export { NetworkDetection, useNetworkStatus } from './network-detection';
export type { NetworkStatus, NetworkStatusCallback } from './network-detection';

export {
  isNetworkError,
  shouldServeStaleOnError,
  logNetworkError,
  handleErrorGracefully,
} from './error-handling';
export type { GracefulErrorOptions } from './error-handling';
