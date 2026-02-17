/**
 * Network Detection & Error Handling Module
 *
 * Provides:
 * - Cross-platform network status detection (web, iOS, Android)
 * - Graceful degradation (return stale cache on network errors)
 * - Network error classification
 * - Explicit state machine for network states
 * - Transition hooks for recovery logic
 * - Foundation for future offline mode (Milestone 3+)
 */

export {
  ConnectionQuality,
  NetworkDetection, qualityToNetworkState, useNetworkStatus
} from "./network-detection";
export type { NetworkStatus, NetworkStatusCallback } from "./network-detection";

export { NetworkStateManager, VALID_TRANSITIONS } from "./state-machine";
export type {
  NetworkState,
  SpecificTransitionHook,
  TransitionHook
} from "./state-machine";

export {
  handleErrorGracefully,
  isNetworkError,
  logNetworkError,
  shouldServeStaleOnError
} from "./error-handling";
export type { GracefulErrorOptions } from "./error-handling";

export {
  getSupabaseHealthEndpoint,
  getWebPingInterval,
  getWebPingTimeout,
  LATENCY_THRESHOLD,
  LOW_BATTERY_THRESHOLD,
  SUPABASE_HEALTH_ENDPOINT
} from "./network-config";

export {
  buildAdaptiveQueryParams,
  getAdaptivePayloadOptions,
  getCacheKeyQualityComponent
} from "./adaptive-payload";

export type {
  AdaptivePayloadOptions,
  PayloadQuality
} from "./adaptive-payload";

export {
  appendAdaptiveParams,
  getAdaptiveQueryString,
  shouldDowngradeResource
} from "./adaptive-payload-request";

export {
  composeNetworkContext, deriveConnectionType
} from "./helpers";
export type { ConnectionType, NetworkContext } from "./helpers";

export {
  cleanupTelemetry,
  ConnectionQualityTier,
  emitHealthCheckEvent,
  emitQualityChangeEvent,
  initializeTelemetry,
  mapQualityTier,
  startHealthCheckInterval,
  stopHealthCheckInterval,
  ErrorType,
  captureErrorCorrelation,
  getAndClearErrorQueue,
  getErrorQueue
} from "./network-telemetry";
export type { NetworkHealthEvent, ErrorCorrelationEvent } from "./network-telemetry";

