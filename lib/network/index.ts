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
  handleErrorGracefully,
  isNetworkError,
  logNetworkError,
  shouldServeStaleOnError
} from "./error-handling";
export type { GracefulErrorOptions } from "./error-handling";

export {
  buildAdaptiveQueryParams,
  getAdaptivePayloadOptions,
  getCacheKeyQualityComponent
} from "./adaptive-payload/adaptive-payload";

export type {
  AdaptivePayloadOptions,
  PayloadQuality
} from "./adaptive-payload/adaptive-payload";

export {
  appendAdaptiveParams,
  getAdaptiveQueryString,
  shouldDowngradeResource
} from "./adaptive-payload/adaptive-payload-request";

export {
  getAdaptiveQueryParams,
  getQualityAwareCacheKey,
  getStaleTimeForQuality,
  integrateAdaptivePayloads,
  type AdaptiveQueryConfig
} from "./adaptive-payload/adaptive-payload-integration";

export {
  captureErrorCorrelation, cleanupTelemetry,
  ConnectionQualityTier,
  emitHealthCheckEvent,
  emitQualityChangeEvent,
  emitSampledErrorEvents, ErrorType, getAndClearErrorQueue,
  getErrorQueue, initializeTelemetry,
  mapQualityTier,
  startHealthCheckInterval,
  stopHealthCheckInterval
} from "./network-telemetry";
export type { ErrorCorrelationEvent, NetworkHealthEvent } from "./network-telemetry";

