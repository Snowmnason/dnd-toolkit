/**
 * Network Detection Helpers
 *
 * Provides utility functions for deriving connection type, effective type,
 * and composing the full network context used by the state machine and telemetry.
 *
 * Separation of concerns:
 * - ConnectionType ('WIFI' | 'CELLULAR' | 'ETHERNET' | 'UNKNOWN'): what network we're on
 * - EffectiveType ('4g' | '3g' | '2g' | 'slow-2g' | 'offline'): quality tier for adaptive payloads
 * - ConnectionQuality (enum): state-machine state (GOOD | BAD | CELLULAR | OFFLINE)
 * - NetworkState (type): state-machine state literal
 */

import type { NetworkStatus } from "@/lib/network/network-detection";
import { ConnectionQuality, qualityToNetworkState } from "@/lib/network/network-detection";

/**
 * Connection type: what network medium we're connected to
 */
export type ConnectionType = "WIFI" | "CELLULAR" | "ETHERNET" | "UNKNOWN";

/**
 * Derive connection type from network status and runtime API
 *
 * Attempts to use Network Information API first, falls back to heuristics
 * based on status flags and connection quality.
 *
 * @param status - Current network status
 * @returns Connection type (WIFI, CELLULAR, ETHERNET, or UNKNOWN)
 */
export function deriveConnectionType(status: NetworkStatus): ConnectionType {
  // Try Network Information API if available (primarily web)
  if (typeof navigator !== "undefined") {
    const navConn = (navigator as any).connection;
    if (navConn && navConn.type) {
      const typeStr = String(navConn.type).toLowerCase();
      if (typeStr.includes("wifi")) return "WIFI";
      if (typeStr.includes("cellular") || typeStr.includes("cell")) return "CELLULAR";
      if (typeStr.includes("ethernet")) return "ETHERNET";
    }
  }

  // Fallback heuristics: use status flags
  if (!status.isOnline) return "UNKNOWN";

  // Explicit type from network detection
  if (status.type === "cellular") return "CELLULAR";
  if (status.type === "wifi") return "WIFI";

  // Check isExpensive flag (cellular is expensive)
  if (status.isExpensive === true) return "CELLULAR";

  // Check connectionQuality enum (CELLULAR was formerly NO_WIFI; still indicates cellular type)
  if (status.connectionQuality === ConnectionQuality.CELLULAR) return "CELLULAR";

  // Default to UNKNOWN if offline or undetected
  if (!status.isOnline || status.type === "none") return "UNKNOWN";

  // Fallback: assume WIFI for other online cases
  return "WIFI";
}

/**
 * Compose the full network context: connection type, effective type, and state
 *
 * This is the single source of truth for how connection type and quality tier
 * work together. Callers should use this function rather than deriving values
 * independently to ensure consistency.
 *
 * @param status - Current network status (from NetworkDetection)
 * @returns Composed network context with all derived values
 */
export function composeNetworkContext(status: NetworkStatus) {
  const connectionType = deriveConnectionType(status);
  const effectiveType = status.effectiveType ?? "offline";
  const quality = status.connectionQuality;
  const networkState = qualityToNetworkState(quality);

  return {
    connectionType,
    effectiveType,
    quality,
    networkState,
    // Convenience: true if we're on cellular network
    isCellular: connectionType === "CELLULAR",
    // Convenience: true if we're online and reasonably healthy
    isHealthy:
      networkState === "GOOD" ||
      (networkState === "CELLULAR" && effectiveType !== "2g" && effectiveType !== "slow-2g"),
  };
}

/**
 * Type-safe extraction of composed context for use in state-machine decisions
 * Ensures type safety when accessing nested context values
 */
export type NetworkContext = ReturnType<typeof composeNetworkContext>;
