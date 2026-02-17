/**
 * Network Telemetry & Monitoring
 *
 * Emits events for network quality changes and periodic health checks.
 * Events are logged via logger.category('network') for observability and debugging.
 *
 * Key responsibilities:
 * - Emit quality_change events when effectiveType changes
 * - Emit health_check events periodically (5min default)
 * - Detect and warn on rapid quality changes (flapping)
 * - Include platform, latency, and connection type in events
 * - Integrate with NetworkDetection subscription
 *
 * Sampling and privacy controls are handled in Phase 1c.
 */

import { composeNetworkContext, type ConnectionType, type NetworkContext } from "@/lib/network/helpers";
import { NetworkDetection, type NetworkStatus } from "@/lib/network/network-detection";
import { logger } from "@/lib/utils/logger";
import { Platform } from "react-native";

/**
 * Quality tier for telemetry events
 * (Maps from effectiveType and latency for consistent quality categorization)
 */
export enum ConnectionQualityTier {
  EXCELLENT = "excellent", // 4g, wifi < 50ms
  GOOD = "good", // 3g, wifi 50-100ms
  POOR = "poor", // 2g, slow-2g, or > 100ms latency
  OFFLINE = "offline", // no connection
}

/**
 * Network health event emitted on quality change or periodic health check
 */
export interface NetworkHealthEvent {
  eventType: "quality_change" | "health_check" | "error_correlation";
  previousQuality?: ConnectionQualityTier;
  currentQuality: ConnectionQualityTier;
  isOnline: boolean;
  connectionType?: ConnectionType;
  isExpensive?: boolean; // cellular = expensive
  latency?: number; // RTT in ms (from Network Information API if available; omitted on unsupported browsers)
  packetLoss?: number; // percent (not available from browser API; omit or use 0)
  downlink?: number; // Mbps (from Network Information API; omitted on unsupported browsers)
  rtt?: number; // round-trip time (ms, from Network Information API; omitted if unavailable)
  timestamp: number;
  userAgent?: string;
  platform: "web" | "ios" | "android" | "desktop"; // Detected via Platform.OS (React Native) or 'web' for browser
}

/**
 * Map effectiveType and latency to a quality tier for telemetry
 */
export function mapQualityTier(
  effectiveType: string | undefined,
  latency?: number,
): ConnectionQualityTier {
  if (!effectiveType || effectiveType === "offline") {
    return ConnectionQualityTier.OFFLINE;
  }

  if (effectiveType === "4g") {
    // Excellent if < 50ms, otherwise good
    return latency && latency < 50 ? ConnectionQualityTier.EXCELLENT : ConnectionQualityTier.GOOD;
  }

  if (effectiveType === "3g") {
    // Good if < 100ms, otherwise poor
    return latency && latency < 100 ? ConnectionQualityTier.GOOD : ConnectionQualityTier.POOR;
  }

  // 2g and slow-2g always poor
  if (effectiveType === "2g" || effectiveType === "slow-2g") {
    return ConnectionQualityTier.POOR;
  }

  return ConnectionQualityTier.GOOD; // Default fallback
}

/**
 * Get platform identifier
 */
function getPlatform(): "web" | "ios" | "android" | "desktop" {
  if (typeof window !== "undefined" && typeof navigator !== "undefined") {
    return "web";
  }
  if (Platform.OS === "ios") return "ios";
  if (Platform.OS === "android") return "android";
  if (Platform.OS === "windows" || Platform.OS === "macos") return "desktop";
  return "web"; // fallback
}

/**
 * Get latency from Network Information API if available
 * Returns RTT (round-trip time) in milliseconds
 */
function getLatencyFromAPI(): number | undefined {
  if (typeof navigator === "undefined") return undefined;
  const navConn = (navigator as any).connection;
  if (!navConn) return undefined;

  // rtt is in milliseconds
  if (navConn.rtt) return navConn.rtt;
  return undefined;
}

/**
 * Compose a network health event from current status
 */
function composeHealthEvent(
  status: NetworkStatus,
  eventType: NetworkHealthEvent["eventType"],
  previousQuality?: ConnectionQualityTier,
): NetworkHealthEvent {
  const latency = getLatencyFromAPI();
  const ctx: NetworkContext = composeNetworkContext(status);
  const effectiveType = ctx.effectiveType;
  const currentQuality = mapQualityTier(effectiveType, latency);
  const connectionType = ctx.connectionType;

  return {
    eventType,
    previousQuality,
    currentQuality,
    isOnline: status.isOnline,
    connectionType,
    isExpensive: status.isExpensive,
    latency,
    timestamp: Date.now(),
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    platform: getPlatform(),
  };
}

/**
 * Singleton state for telemetry management
 */
interface TelemetryState {
  lastQuality?: ConnectionQualityTier;
  healthCheckInterval: ReturnType<typeof setInterval> | null;
  qualityChangeTimestamps: number[]; // Track last 10 quality changes for flapping detection
  subscriptionUnsubscribe: (() => void) | null;
}

const telemetryState: TelemetryState = {
  lastQuality: undefined,
  healthCheckInterval: null,
  qualityChangeTimestamps: [],
  subscriptionUnsubscribe: null,
};

/**
 * Emit quality change event when effectiveType changes
 * Call this when you detect a quality change.
 *
 * Logs via logger.category('network').info('quality_change', eventData)
 */
export function emitQualityChangeEvent(
  previous: ConnectionQualityTier | undefined,
  current: ConnectionQualityTier,
  status: NetworkStatus,
): void {
  const event = composeHealthEvent(status, "quality_change", previous);

  // Detect rapid changes (flapping): 3+ changes in 10 seconds
  const now = Date.now();
  telemetryState.qualityChangeTimestamps.push(now);

  // Keep only timestamps from the last 10 seconds
  telemetryState.qualityChangeTimestamps = telemetryState.qualityChangeTimestamps.filter(
    (ts) => now - ts < 10000,
  );

  if (telemetryState.qualityChangeTimestamps.length >= 3) {
    logger
      .category("network")
      .warn(
        "quality_change_flapping",
        `Rapid quality changes detected (${telemetryState.qualityChangeTimestamps.length} in 10s). Network may be unstable.`,
      );
  }

  logger.category("network").info("quality_change", event);
}

/**
 * Emit health check event periodically
 * Call this on every health check interval.
 *
 * Logs via logger.category('network').info('health_check', eventData)
 * Note: Sampling (which health checks are actually logged) happens in Phase 1c
 */
export function emitHealthCheckEvent(status: NetworkStatus): void {
  const ctx: NetworkContext = composeNetworkContext(status);
  const currentQuality = mapQualityTier(ctx.effectiveType, getLatencyFromAPI());
  const event = composeHealthEvent(status, "health_check", telemetryState.lastQuality);

  // Update lastQuality so it's ready for the next quality change event or health check
  telemetryState.lastQuality = currentQuality;

  logger.category("network").info("health_check", event);
}

/**
 * Start periodic health check interval
 * Default 5 minutes (300000 ms); configurable
 *
 * Should be called during app initialization (AppKernel networkReady phase)
 * Cleans up existing interval if already running to prevent duplicates
 */
export function startHealthCheckInterval(intervalMs: number = 300000): void {
  // Clean up existing interval
  if (telemetryState.healthCheckInterval) {
    clearInterval(telemetryState.healthCheckInterval);
    telemetryState.healthCheckInterval = null;
  }

  // First health check immediately on start (always logged, unsampled)
  const initialStatus = NetworkDetection.getStatus();
  emitHealthCheckEvent(initialStatus);

  // Then periodic checks
  telemetryState.healthCheckInterval = setInterval(() => {
    const status = NetworkDetection.getStatus();
    emitHealthCheckEvent(status);
  }, intervalMs);

  logger.category("network").debug(
    `Health check interval started: ${intervalMs}ms (${(intervalMs / 1000 / 60).toFixed(1)} minutes)`,
  );
}

/**
 * Stop periodic health check interval
 * Should be called on app exit or when user revokes consent (#181)
 */
export function stopHealthCheckInterval(): void {
  if (telemetryState.healthCheckInterval) {
    clearInterval(telemetryState.healthCheckInterval);
    telemetryState.healthCheckInterval = null;
    logger.category("network").debug("Health check interval stopped");
  }
}

/**
 * Initialize telemetry integration with NetworkDetection
 *
 * Subscribes to network status changes and emits quality_change events.
 * Called once during app initialization.
 */
export function initializeTelemetry(): void {
  // Clean up existing subscription if any
  if (telemetryState.subscriptionUnsubscribe) {
    telemetryState.subscriptionUnsubscribe();
  }

  // Subscribe to network status changes to detect quality changes
  telemetryState.subscriptionUnsubscribe = NetworkDetection.subscribe((status) => {
    const ctx: NetworkContext = composeNetworkContext(status);
    const currentQuality = mapQualityTier(ctx.effectiveType, getLatencyFromAPI());

    // Only emit if quality actually changed
    if (telemetryState.lastQuality !== currentQuality) {
      const previous = telemetryState.lastQuality;
      telemetryState.lastQuality = currentQuality;

      emitQualityChangeEvent(previous, currentQuality, status);
    }
  });

  // Initialize last quality from current status
  const initialStatus = NetworkDetection.getStatus();
  telemetryState.lastQuality = mapQualityTier(
    initialStatus.effectiveType,
    getLatencyFromAPI(),
  );

  logger.category("network").debug("Network telemetry initialized");
}

/**
 * Clean up telemetry subscriptions and intervals
 * Called on app exit or for testing/cleanup
 */
export function cleanupTelemetry(): void {
  if (telemetryState.subscriptionUnsubscribe) {
    telemetryState.subscriptionUnsubscribe();
    telemetryState.subscriptionUnsubscribe = null;
  }
  stopHealthCheckInterval();
  logger.category("network").debug("Network telemetry cleaned up");
}
