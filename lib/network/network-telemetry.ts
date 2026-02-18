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
 * - Enforce privacy consent before capturing or emitting any telemetry
 *
 * ===== PRIVACY & PII AUDIT =====
 * Data COLLECTED in telemetry events (intentional):
 * - eventType: 'quality_change' | 'health_check' | 'error_correlation'
 * - timestamp: UTC milliseconds (Date.now())
 * - platform: 'web' | 'ios' | 'android' | 'desktop'
 * - currentQuality: EXCELLENT | GOOD | POOR | OFFLINE
 * - previousQuality: (quality_change only) for transition tracking
 * - isOnline: boolean
 * - connectionType: 'wifi' | 'cellular' | 'ethernet' | 'unknown'
 * - isExpensive: boolean (cellular = expensive)
 * - latency: RTT in ms (from Network Information API, omitted if unavailable)
 * - downlink: Mbps (from Network Information API, omitted if unavailable)
 * - rtt: RTT in ms (from Network Information API, omitted if unavailable)
 * - userAgent: browser/app UA string (web only, optional)
 * - errorType: (error_correlation only) timeout | dns_fail | connection_reset | 5xx | 4xx | other
 * - errorCode: (error_correlation only) HTTP status or error code
 * - errorMessage: (error_correlation only) human-readable error text
 *
 * Data NEVER collected (privacy-safe):
 * ✗ userId / user identity
 * ✗ email / phone / personally identifiable info (PII)
 * ✗ geolocation / GPS coordinates
 * ✗ app version / build number (could be identifying)
 * ✗ device IMEI / UDID / hardware serial
 * ✗ IP address (implicit in network, not explicit)
 * ✗ request/response body or headers (except error classification)
 * ✗ app-specific data or customer data
 *
 * Privacy Controls:
 * - Consent gating: respects config.network.telemetry.enabled and AnalyticsConsent.isAllowed('performance')
 * - Integrates with lib/analytics/consent.ts for centralized consent management
 * - If consent is not granted or config disabled, NO data is captured or emitted
 * - Error queue is bounded to prevent memory exhaustion; oldest events dropped on overflow
 * - No backend ingestion yet; Phase 1 is local logging only (Phase 2+ will add server integration)
 *
 * Sampling and privacy controls are handled in Phase 1c.
 */

import { AnalyticsConsent } from "@/lib/analytics";
import { getPlatformName } from "@/lib/config/platform-config";
import { composeNetworkContext, type ConnectionType, type NetworkContext } from "@/lib/network/helpers";
import { NetworkDetection, type NetworkStatus } from "@/lib/network/network-detection";
import { logger } from "@/lib/utils/logger";

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
 * Error type classification for telemetry correlation
 */
export enum ErrorType {
  TIMEOUT = "timeout",
  DNS_FAIL = "dns_fail",
  CONNECTION_RESET = "connection_reset",
  HTTP_5XX = "5xx",
  HTTP_4XX = "4xx",
  OTHER = "other",
}

/**
 * Error correlation event: error + network quality snapshot
 * Created on request/sync failure; emitted in Phase 1c with sampling
 */
export interface ErrorCorrelationEvent {
  eventType: "error_correlation";
  errorType: ErrorType | string;
  errorCode?: number;
  errorMessage: string;
  currentQuality: ConnectionQualityTier;
  isOnline: boolean;
  connectionType?: ConnectionType;
  latency?: number;
  timestamp: number;
  platform: "web" | "ios" | "android" | "desktop";
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
 * Uses centralized platform detection from lib/config/platform-config
 */
function getPlatform(): "web" | "ios" | "android" | "desktop" {
  const platformName = getPlatformName();
  // Default to "web" if platform detection returns "unknown"
  return platformName === "unknown" ? "web" : platformName;
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
 * Sampling and queue configuration (from appsettings or defaults)
 */
interface TelemetryConfig {
  healthCheckSampleRate: number; // 0-1 (10% = 0.1)
  errorCorrelationSampleRate: number; // 0-1 (50% = 0.5)
  enabled: boolean;
  maxErrorQueueSize: number; // Max in-memory errors before dropping oldest
}

/**
 * Get telemetry configuration from app settings
 * Defaults: health check 10%, error correlation 50%, queue 1000 events
 * Safe fallback ensures basic functionality even if config loading fails
 */
function getTelemetryConfig(): TelemetryConfig {
  try {
    const { getAppConfig } = require("@/lib/config");
    const config = getAppConfig();
    const telemetryConfig = config?.network?.telemetry;
    return {
      healthCheckSampleRate: telemetryConfig?.healthCheckSampleRate ?? 0.1,
      errorCorrelationSampleRate: telemetryConfig?.errorCorrelationSampleRate ?? 0.5,
      enabled: telemetryConfig?.enabled ?? true,
      maxErrorQueueSize: telemetryConfig?.maxErrorQueueSize ?? 1000,
    };
  } catch {
    // Safe fallback: basic telemetry enabled with conservative defaults
    return {
      healthCheckSampleRate: 0.1,
      errorCorrelationSampleRate: 0.5,
      enabled: true,
      maxErrorQueueSize: 1000,
    };
  }
}

/**
 * Check if an event should be sampled (random probability)
 * @param sampleRate - Sample rate (0-1). 0.1 = 10% of events logged
 * @returns true if event should be emitted, false if filtered by sampling
 */
function shouldSample(sampleRate: number): boolean {
  if (sampleRate >= 1) return true;
  if (sampleRate <= 0) return false;
  return Math.random() < sampleRate;
}

/**
 * Check if analytics consent is granted for network telemetry.
 * 
 * Network telemetry is categorized as 'performance' data (Network Information API,
 * latency measurements, connection quality metrics). This respects the centralized
 * AnalyticsConsent manager in lib/analytics for consistency with other analytics systems.
 * 
 * Behavior:
 * - If config.network.telemetry.enabled === false => false (config takes priority)
 * - Otherwise, check AnalyticsConsent.isAllowed('performance')
 * 
 * @returns true if telemetry is enabled and user has consented to performance tracking
 */
function hasPrivacyConsent(): boolean {
  try {
    // Config toggle takes priority (allows server-side or environment-based disable)
    const { getAppConfig } = require("@/lib/config");
    const cfg = getAppConfig?.();
    if (cfg && cfg.network && cfg.network.telemetry === false) return false;
    if (cfg && cfg.network && typeof cfg.network.telemetry === "object") {
      const enabled = (cfg.network.telemetry as any)?.enabled;
      if (enabled === false) return false;
    }

    // Check centralized analytics consent system
    // Network telemetry is considered 'performance' data
    return AnalyticsConsent.isAllowed("performance");
  } catch {
    // Legacy default: if consent system or config loading errors occur, fall
    // back to legacy behavior (telemetry enabled). This keeps development and
    // unit tests working while production integrations should provide proper
    // consent configuration. Adjust if you want stricter failure behavior.
    return true;
  }
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
  errorQueue: ErrorCorrelationEvent[]; // Collect error events for Phase 1c sampling & emission
  firstHealthCheckEmitted: boolean; // Track if initial health check sent (always unsampled)
}

const telemetryState: TelemetryState = {
  lastQuality: undefined,
  healthCheckInterval: null,
  qualityChangeTimestamps: [],
  subscriptionUnsubscribe: null,
  errorQueue: [],
  firstHealthCheckEmitted: false,
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
  // Respect privacy/consent at emission time
  if (!hasPrivacyConsent()) return;
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
 * Sampling: First check always logged (unsampled); rest sampled at healthCheckSampleRate
 */
export function emitHealthCheckEvent(status: NetworkStatus): void {
  const ctx: NetworkContext = composeNetworkContext(status);
  const currentQuality = mapQualityTier(ctx.effectiveType, getLatencyFromAPI());
  const event = composeHealthEvent(status, "health_check", telemetryState.lastQuality);

  // Update lastQuality so it's ready for the next quality change event or health check
  telemetryState.lastQuality = currentQuality;

  // Apply sampling: first health check is always logged (unsampled)
  const telemetryConfig = getTelemetryConfig();
  if (!telemetryConfig.enabled) {
    return; // Telemetry disabled
  }

  // Respect privacy/consent at emission time
  if (!hasPrivacyConsent()) return;

  const isFirstCheck = !telemetryState.firstHealthCheckEmitted;
  const shouldEmit = isFirstCheck || shouldSample(telemetryConfig.healthCheckSampleRate);

  if (shouldEmit) {
    logger.category("network").info("health_check", event);
    if (isFirstCheck) {
      telemetryState.firstHealthCheckEmitted = true;
    }
  }

  // Always drain error queue on every health check interval, regardless of health check
  // sampling. This prevents error events from accumulating indefinitely in memory.
  // Error drainage is independent of health check sampling to ensure bounded queue growth.
  try {
    const events = getAndClearErrorQueue(true);
    if (events.length > 0) {
      emitSampledErrorEvents(events);
    }
  } catch (err) {
    logger.category("network").debug("error_drain_failed", String(err));
  }
}

/**
 * Capture error + quality snapshot for correlation
 * Call this when a network error occurs (timeout, DNS fail, etc.)
 * Error is queued; Phase 1c will sample & emit based on sampling rate
 *
 * @param errorType - Type of error (timeout, dns_fail, connection_reset, 5xx, 4xx, other)
 * @param errorMessage - Human-readable error message
 * @param errorCode - Optional HTTP status code or error code
 */
export function captureErrorCorrelation(
  errorType: ErrorType | string,
  errorMessage: string,
  errorCode?: number,
): void {
  // Respect privacy/consent: do not capture if user has not consented
  if (!hasPrivacyConsent()) return;

  const status = NetworkDetection.getStatus();
  const ctx = composeNetworkContext(status);
  const latency = getLatencyFromAPI();
  const currentQuality = mapQualityTier(ctx.effectiveType, latency);

  const event: ErrorCorrelationEvent = {
    eventType: "error_correlation",
    errorType,
    errorCode,
    errorMessage,
    currentQuality,
    isOnline: status.isOnline,
    connectionType: ctx.connectionType,
    latency,
    timestamp: Date.now(),
    platform: getPlatform(),
  };

  // Queue for Phase 1c sampling & emission
  // Enforce max queue size (from config) to avoid unbounded memory growth
  const telemetryConfig = getTelemetryConfig();
  if (telemetryState.errorQueue.length >= telemetryConfig.maxErrorQueueSize) {
    // Drop the oldest event to make room for new events
    telemetryState.errorQueue.shift();
    telemetryState.errorQueue.push(event);
  } else {
    telemetryState.errorQueue.push(event);
  }

  logger.category("network").debug(
    "error_correlation_captured",
    `Error captured: ${errorType}. Queue length: ${telemetryState.errorQueue.length}`,
  );
}

/**
 * Get all captured error events and optionally clear the queue
 * Used by Phase 1c to retrieve and sample error events
 *
 * @param clearQueue - If true, clears the error queue after retrieving
 * @returns Array of captured error correlation events
 */
export function getAndClearErrorQueue(clearQueue: boolean = true): ErrorCorrelationEvent[] {
  const events = [...telemetryState.errorQueue];
  if (clearQueue) {
    telemetryState.errorQueue = [];
  }
  return events;
}

/**
 * Emit sampled error correlation events
 * Logs error events at errorCorrelationSampleRate
 * Usually called periodically (e.g., every 5 minutes) to drain the error queue
 *
 * @param events - Error events to emit (typically from getAndClearErrorQueue)
 */
export function emitSampledErrorEvents(events: ErrorCorrelationEvent[]): void {
  const telemetryConfig = getTelemetryConfig();
  if (!telemetryConfig.enabled) {
    return; // Telemetry disabled
  }

  for (const event of events) {
    if (shouldSample(telemetryConfig.errorCorrelationSampleRate)) {
      logger.category("network").info("error_correlation", event);
    }
  }
}

/**
 * Get current error queue without clearing
 * @returns Current error queue
 */
export function getErrorQueue(): ErrorCorrelationEvent[] {
  return [...telemetryState.errorQueue];
}

/**
 * Start periodic health check interval
 * Default 5 minutes (300000 ms); configurable
 *
 * Should be called during app initialization (AppKernel networkReady phase)
 * Cleans up existing interval if already running to prevent duplicates
 * 
 * @param intervalMs - Interval in milliseconds (default: 300000 = 5 minutes)
 * @param skipInitialCheck - If true, skips the immediate initial health check
 *                           Set to true if initializeTelemetry() was called first
 *                           (avoids redundant duplicate health check emission)
 */
export function startHealthCheckInterval(
  intervalMs: number = 300000,
  skipInitialCheck: boolean = false,
): void {
  // Clean up existing interval
  if (telemetryState.healthCheckInterval) {
    clearInterval(telemetryState.healthCheckInterval);
    telemetryState.healthCheckInterval = null;
  }

  // First health check immediately on start (unless skipped)
  // Skip this if initializeTelemetry() already initialized lastQuality
  if (!skipInitialCheck) {
    const initialStatus = NetworkDetection.getStatus();
    emitHealthCheckEvent(initialStatus);
  }

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
 * Initializes lastQuality to the current network state.
 * 
 * **IMPORTANT:** Call this before startHealthCheckInterval() to avoid redundant
 * health check emissions. If both are called (typical in app initialization),
 * pass skipInitialCheck: true to startHealthCheckInterval().
 * 
 * Example:
 *   initializeTelemetry();
 *   startHealthCheckInterval(300000, true); // skip initial check
 * 
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
  telemetryState.errorQueue = [];
  telemetryState.firstHealthCheckEmitted = false;
  logger.category("network").debug("Network telemetry cleaned up");
}
