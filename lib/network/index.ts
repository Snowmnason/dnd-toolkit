/**
 * Network Detection & Error Handling Module
 *
 * Provides:
 * - Cross-platform network status detection (web, iOS, Android)
 * - Graceful degradation (return stale cache on network errors)
 * - Network error classification
 * - Foundation for future offline mode (Milestone 3+)
 */

export {
    ConnectionQuality, NetworkDetection,
    useNetworkStatus
} from "./network-detection";
export type { NetworkStatus, NetworkStatusCallback } from "./network-detection";

export {
    handleErrorGracefully, isNetworkError, logNetworkError, shouldServeStaleOnError
} from "./error-handling";
export type { GracefulErrorOptions } from "./error-handling";

export {
    LATENCY_THRESHOLD,
    LOW_BATTERY_THRESHOLD, SUPABASE_HEALTH_ENDPOINT,
    WEB_PING_INTERVAL,
    WEB_PING_TIMEOUT, getSupabaseHealthEndpoint
} from "./network-config";

