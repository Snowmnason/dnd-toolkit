/**
 * Network Detection Utilities
 *
 * Provides cross-platform network status detection for web, iOS, and Android.
 * Tracks detailed connection states (good, bad, cellular, offline) for implementing
 * degraded modes and safe modes when network is unavailable or unreliable.
 *
 * Features:
 * - Real-time network status with detailed connection quality
 * - Battery-aware "expensive" flag (avoid heavy ops on cellular + low battery)
 * - Periodic ping fallback for web (in case events fail)
 * - Cross-platform detection (web, iOS, Android)
 * - Comprehensive logging for debugging
 * - Graceful degradation across all platforms
 */

import {
  LATENCY_THRESHOLD,
  LOW_BATTERY_THRESHOLD,
  getSupabaseHealthEndpoint,
  getWebPingInterval,
  getWebPingTimeout,
} from "@/lib/network/network-config";
import {
  NetworkStateManager,
  type NetworkState,
} from "@/lib/network/state-machine";
import { logger } from "@/lib/utils/logger";
import * as React from "react";
import { Platform } from "react-native";

/**
 * Connection quality states for implementing degraded/safe modes
 */
export enum ConnectionQuality {
  /** Excellent connection - can do all operations */
  GOOD = "good",
  /** Poor connection - latency/packet loss detected - should use smaller payloads */
  BAD = "bad",
  /** Cellular/hotspot connection (may be metered) */
  CELLULAR = "cellular",
  /** No network service at all */
  OFFLINE = "offline",
}

/**
 * Network status information
 */
export interface NetworkStatus {
  /** Is device connected to any network */
  isOnline: boolean;
  /** Network type: wifi, cellular, none, unknown */
  type: "wifi" | "cellular" | "none" | "unknown";
  /** Is connection expensive (cellular or low battery + not charging) */
  isExpensive: boolean;
  /** Connection quality for implementing degraded modes */
  connectionQuality: ConnectionQuality;
  /** More accurate than isOnline (requires native package) */
  isInternetReachable?: boolean;
  /** Effective connection type for adaptive payloads: '4g' | '3g' | '2g' | 'slow-2g' | 'offline' */
  effectiveType?: "4g" | "3g" | "2g" | "slow-2g" | "offline";
}

/**
 * Battery status information
 */
interface BatteryStatus {
  level: number | null; // 0..1 or null if unavailable
  charging: boolean;
}

/**
 * Callback when network status changes
 */
export type NetworkStatusCallback = (status: NetworkStatus) => void;

/**
 * Convert ConnectionQuality to NetworkState
 * Standalone function for use in state machine and telemetry
 */
export function qualityToNetworkState(quality: ConnectionQuality): NetworkState {
  switch (quality) {
    case ConnectionQuality.GOOD:
      return "GOOD";
    case ConnectionQuality.BAD:
      return "BAD";
    case ConnectionQuality.CELLULAR:
      return "CELLULAR";
    case ConnectionQuality.OFFLINE:
      return "OFFLINE";
  }
}

/**
 * Network detection service (cross-platform)
 *
 * Handles:
 * - Web: navigator.onLine, visibilitychange events, periodic ping
 * - Native: react-native-netinfo package integration, battery tracking
 * - Graceful degradation on both platforms
 */
class NetworkDetectionClass {
  private currentStatus: NetworkStatus = {
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
    type: "unknown",
    isExpensive: false,
    connectionQuality: ConnectionQuality.GOOD,
    effectiveType: "4g", // Default to 4g; will be updated by deriveEffectiveType() on first status change
  };

  private currentBattery: BatteryStatus = {
    level: null,
    charging: false,
  };

  private listeners: Set<NetworkStatusCallback> = new Set();
  private isInitialized = false;
  private webPingTimer: ReturnType<typeof setInterval> | null = null;
  private batteryUnsubscribe: (() => void) | null = null;
  private networkUnsubscribe: (() => void) | null = null;
  private onlineListener: (() => void) | null = null;
  private offlineListener: (() => void) | null = null;
  private visibilityListener: (() => void) | null = null;
  private batteryLevelListener: (() => void) | null = null;
  private batteryChargingListener: (() => void) | null = null;
  private batteryObject: any = null;
  private nativeBatteryPollTimer: ReturnType<typeof setInterval> | null = null;
  private pingLatencies: number[] = [];
  private maxLatencyWindowSize = 10; // Track last 10 ping latencies

  /**
   * Initialize network detection
   * Call this once at app startup
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Clean up any existing listeners before initializing
    this.cleanup();

    try {
      logger
        .category("network")
        .info("Starting network detection initialization");

      // Web: Use navigator.onLine + periodic ping
      if (typeof window !== "undefined") {
        this.setupWebNetworkDetection();
        this.setupWebPeriodicPing();
      }

      // Battery tracking (web + native)
      await this.setupBatteryTracking();

      // Native: Use network detection if available (@react-native-community/netinfo package)
      // This is optional - web works fine without it
      // Skip native detection on web platform
      if (typeof window === "undefined" && Platform?.OS !== "web") {
        try {
          const NetInfo = await this.loadNetInfo();
          if (NetInfo) {
            this.setupNativeNetworkDetection(NetInfo);
            logger
              .category("network")
              .info("Native network detection initialized");
          } else {
            logger
              .category("network")
              .debug("Native network package unavailable, using fallback");
          }
        } catch (error) {
          logger
            .category("network")
            .warn("Failed to setup native network detection:", error);
        }
      }

      this.isInitialized = true;

      // Initialize state machine to detected state
      const initialNetworkState = qualityToNetworkState(
        this.currentStatus.connectionQuality,
      );
      try {
        await NetworkStateManager.transitionTo(
          initialNetworkState,
          "initial detection",
        );
      } catch (error) {
        logger.warn("network", `Failed to set initial network state: ${error}`);
      }

      logger
        .category("network")
        .info(
          `Network detection initialized (online: ${this.currentStatus.isOnline}, quality: ${this.currentStatus.connectionQuality})`,
        );
    } catch (error) {
      logger
        .category("network")
        .error("Failed to initialize network detection:", error);
      throw error;
    }
  }

  /**
   * Clean up listeners and timers
   */
  private cleanup(): void {
    // Clean up network listener
    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
      this.networkUnsubscribe = null;
    }

    // Clean up battery listener
    if (this.batteryUnsubscribe) {
      this.batteryUnsubscribe();
      this.batteryUnsubscribe = null;
    }

    // Clean up web ping timer
    if (this.webPingTimer) {
      clearInterval(this.webPingTimer);
      this.webPingTimer = null;
    }

    // Clean up web event listeners
    if (
      typeof window !== "undefined" &&
      typeof window.removeEventListener === "function"
    ) {
      if (this.onlineListener) {
        window.removeEventListener("online", this.onlineListener);
        this.onlineListener = null;
      }
      if (this.offlineListener) {
        window.removeEventListener("offline", this.offlineListener);
        this.offlineListener = null;
      }
    }

    if (
      typeof document !== "undefined" &&
      typeof document.removeEventListener === "function"
    ) {
      if (this.visibilityListener) {
        document.removeEventListener(
          "visibilitychange",
          this.visibilityListener,
        );
        this.visibilityListener = null;
      }
    }

    // Clean up battery listeners
    if (
      this.batteryObject &&
      typeof this.batteryObject.removeEventListener === "function"
    ) {
      if (this.batteryLevelListener) {
        this.batteryObject.removeEventListener(
          "levelchange",
          this.batteryLevelListener,
        );
        this.batteryLevelListener = null;
      }
      if (this.batteryChargingListener) {
        this.batteryObject.removeEventListener(
          "chargingchange",
          this.batteryChargingListener,
        );
        this.batteryChargingListener = null;
      }
      this.batteryObject = null;
    }

    // Clean up native battery polling timer
    if (this.nativeBatteryPollTimer) {
      clearInterval(this.nativeBatteryPollTimer);
      this.nativeBatteryPollTimer = null;
    }
  }

  /**
   * Safely load NetInfo from @react-native-community/netinfo
   * Returns null if package not available
   */
  private async loadNetInfo(): Promise<any> {
    try {
      // Load @react-native-community/netinfo (cross-platform, reliable)
      const module = await import("@react-native-community/netinfo");

      // Extract NetInfo - it's a named export
      const NetInfo = module.NetInfo || null;
      if (!NetInfo) {
        logger
          .category("network")
          .debug(
            "NetInfo export not found in @react-native-community/netinfo package",
          );
      }
      return NetInfo;
    } catch (error) {
      logger
        .category("network")
        .debug(
          "Failed to load @react-native-community/netinfo package:",
          error,
        );
      return null;
    }
  }

  /**
   * Setup battery tracking (web + native)
   * Updates isExpensive flag based on battery level and charging state
   */
  private async setupBatteryTracking(): Promise<void> {
    try {
      // Web: Battery Status API
      if (typeof navigator !== "undefined" && "getBattery" in navigator) {
        try {
          const battery = await (navigator as any).getBattery?.();
          if (battery) {
            // Store battery object reference for cleanup
            this.batteryObject = battery;

            // Initial battery state
            this.currentBattery = {
              level: battery.level,
              charging: battery.charging,
            };
            this.updateExpensiveFlag();

            // Listen to battery changes
            this.batteryLevelListener = () => {
              this.currentBattery.level = battery.level;
              this.updateExpensiveFlag();
              logger.category("network").debug("Battery level changed", {
                level: battery.level,
              });
            };
            battery.addEventListener("levelchange", this.batteryLevelListener);

            this.batteryChargingListener = () => {
              this.currentBattery.charging = battery.charging;
              this.updateExpensiveFlag();
              logger.category("network").debug("Charging state changed", {
                charging: battery.charging,
              });
            };
            battery.addEventListener(
              "chargingchange",
              this.batteryChargingListener,
            );

            logger
              .category("network")
              .info("Battery tracking initialized (web)", {
                level: battery.level,
                charging: battery.charging,
              });
          }
        } catch (error) {
          logger
            .category("network")
            .debug("Battery Status API unavailable:", error);
        }
      }

      // Native: Battery tracking via device-info
      if (typeof window === "undefined" && Platform?.OS !== "web") {
        try {
          // eslint-disable-next-line import/no-unresolved
          const deviceInfo = await import("react-native-device-info");
          if (deviceInfo) {
            // Poll battery every 30 seconds
            this.nativeBatteryPollTimer = setInterval(async () => {
              try {
                const level = await deviceInfo.getBatteryLevel?.();
                const charging = await deviceInfo.isCharging?.();

                if (
                  level !== this.currentBattery.level ||
                  charging !== this.currentBattery.charging
                ) {
                  this.currentBattery = { level, charging };
                  this.updateExpensiveFlag();
                  logger.category("network").debug("Battery state updated", {
                    level,
                    charging,
                  });
                }
              } catch (batteryError) {
                logger
                  .category("network")
                  .debug("Error reading battery status:", batteryError);
              }
            }, 30000);

            logger
              .category("network")
              .info("Battery tracking initialized (native)");
          }
        } catch (deviceInfoError) {
          logger
            .category("network")
            .debug("Native battery tracking unavailable:", deviceInfoError);
        }
      }
    } catch (error) {
      logger.category("network").warn("Battery tracking setup error:", error);
    }
  }

  /**
   * Setup periodic ping for web (fallback if events fail)
   * Verifies connectivity and measures latency every 5 minutes
   */
  private setupWebPeriodicPing(): void {
    if (typeof window === "undefined" || typeof fetch === "undefined") return;

    // Start ping timer
    this.webPingTimer = setInterval(() => {
      this.performWebPing();
    }, getWebPingInterval());

    // Do initial ping
    this.performWebPing();

    logger.category("network").debug("Web periodic ping initialized", {
      interval: getWebPingInterval(),
    });
  }

  /**
   * Perform a single ping to verify web connectivity and measure latency
   */
  private async performWebPing(): Promise<void> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), getWebPingTimeout());
      const startTime = performance.now();

      // Use Supabase health endpoint instead of Cloudflare for CSP compliance
      // Supabase is already whitelisted in CSP for API calls
      // Endpoint is configured in network-config.ts
      const response = await fetch(getSupabaseHealthEndpoint(), {
        method: "HEAD",
        signal: controller.signal,
      });

      clearTimeout(timeout);
      const latency = performance.now() - startTime;

      // Track latency for connection quality
      this.pingLatencies.push(latency);
      if (this.pingLatencies.length > this.maxLatencyWindowSize) {
        this.pingLatencies.shift();
      }

      const wasOnline = this.currentStatus.isOnline;
      // Consider online if we got ANY response (including auth errors like 401/403)
      // Auth errors indicate network is working, just auth failed
      // Only offline on network errors (>= 500 or connection refused, etc)
      let isNowOnline = response.ok || response.status < 500;

      // If the health endpoint responds with 401, the function may require JWT
      // at the project level. Treat 401 as "online" to avoid noisy auth errors
      // in the console and keep connectivity semantics intact.
      if (response.status === 401) {
        logger
          .category("network")
          .debug(
            `Health endpoint returned 401 - treating as online (project requires auth). (${latency}ms)`,
          );
        isNowOnline = true;
      }

      if (wasOnline !== isNowOnline) {
        logger
          .category("network")
          .info(
            `Ping detected connectivity change: ${wasOnline} -> ${isNowOnline} (${latency}ms, status: ${response.status})`,
          );
        this.updateStatus({ isOnline: isNowOnline });
      }

      // Update connection quality based on latency
      this.updateConnectionQuality();
    } catch (error) {
      // Ping failed - might indicate offline
      if (this.currentStatus.isOnline) {
        logger
          .category("network")
          .debug("Ping failed, marking potentially offline:", error);
        this.updateStatus({ isOnline: false });
      }
    }
  }

  /**
   * Determine connection quality based on network type and latency
   */
  private updateConnectionQuality(): void {
    if (!this.currentStatus.isOnline) {
      this.updateStatus({ connectionQuality: ConnectionQuality.OFFLINE });
      return;
    }

    if (this.currentStatus.type === "none") {
      this.updateStatus({ connectionQuality: ConnectionQuality.OFFLINE });
      return;
    }

    if (this.currentStatus.type === "cellular") {
      this.updateStatus({ connectionQuality: ConnectionQuality.CELLULAR });
      return;
    }

    // For wifi, check latency
    if (this.pingLatencies.length > 0) {
      const avgLatency =
        this.pingLatencies.reduce((a, b) => a + b, 0) /
        this.pingLatencies.length;
      const quality =
        avgLatency > LATENCY_THRESHOLD
          ? ConnectionQuality.BAD
          : ConnectionQuality.GOOD;
      this.updateStatus({ connectionQuality: quality });
      return;
    }

    // Default to good if we have no latency data
    this.updateStatus({ connectionQuality: ConnectionQuality.GOOD });
  }

  /**
   * Update isExpensive flag based on network type + battery
   * Expensive = cellular OR (low battery AND not charging)
   */
  private updateExpensiveFlag(): void {
    const isCellular = this.currentStatus.type === "cellular";
    const isLowBattery =
      this.currentBattery.level != null &&
      this.currentBattery.level < LOW_BATTERY_THRESHOLD;
    const isCharging = this.currentBattery.charging;

    const newIsExpensive = isCellular || (isLowBattery && !isCharging);

    if (newIsExpensive !== this.currentStatus.isExpensive) {
      this.updateStatus({ isExpensive: newIsExpensive });
      logger.category("network").debug("Expensive flag updated", {
        newValue: newIsExpensive,
        reason: isCellular ? "cellular" : "low-battery",
        batteryLevel: this.currentBattery.level,
        charging: this.currentBattery.charging,
      });
    }
  }

  /**
   * Setup web-based network detection
   */
  private setupWebNetworkDetection(): void {
    if (
      typeof window === "undefined" ||
      typeof navigator === "undefined" ||
      typeof window.addEventListener !== "function" ||
      typeof window.removeEventListener !== "function"
    ) {
      return;
    }

    // Initial status
    this.currentStatus = {
      isOnline: navigator.onLine,
      type: navigator.onLine ? "wifi" : "none",
      isExpensive: false,
      connectionQuality: navigator.onLine
        ? ConnectionQuality.GOOD
        : ConnectionQuality.OFFLINE,
    };

    logger
      .category("network")
      .info(
        `Web network detection initialized (online: ${this.currentStatus.isOnline})`,
      );

    // Listen to online/offline events
    this.onlineListener = () => {
      logger
        .category("network")
        .info("Network came online (navigator.online event)");
      this.updateStatus({
        isOnline: true,
        type: "wifi",
        connectionQuality: ConnectionQuality.GOOD,
      });
    };
    window.addEventListener("online", this.onlineListener);

    this.offlineListener = () => {
      logger
        .category("network")
        .info("Network went offline (navigator.offline event)");
      this.updateStatus({
        isOnline: false,
        type: "none",
        connectionQuality: ConnectionQuality.OFFLINE,
      });
    };
    window.addEventListener("offline", this.offlineListener);

    // Also listen to visibility changes (helps detect network loss while backgrounded)
    if (typeof document !== "undefined") {
      this.visibilityListener = () => {
        if (document.visibilityState === "visible") {
          // App came to foreground - recheck network status
          const wasOnline = this.currentStatus.isOnline;
          const isNowOnline = navigator.onLine;

          if (wasOnline !== isNowOnline) {
            logger
              .category("network")
              .info("Network status changed on foreground", {
                from: wasOnline,
                to: isNowOnline,
              });
          }

          this.updateStatus({
            isOnline: isNowOnline,
            type: isNowOnline ? "wifi" : "none",
            connectionQuality: isNowOnline
              ? ConnectionQuality.GOOD
              : ConnectionQuality.OFFLINE,
          });
        }
      };
      document.addEventListener("visibilitychange", this.visibilityListener);
    }
  }

  /**
   * Setup native network detection via @react-native-community/netinfo
   */
  private setupNativeNetworkDetection(NetInfo: any): void {
    // Subscribe to network state updates
    if (NetInfo.addEventListener) {
      this.networkUnsubscribe = NetInfo.addEventListener((state: any) => {
        logger.category("network").debug("Native network state changed", {
          isInternetReachable: state.isInternetReachable,
          type: state.type,
          isConnectionExpensive: state.details?.isConnectionExpensive,
        });

        let quality = ConnectionQuality.GOOD;
        if (state.isInternetReachable === false) {
          quality = ConnectionQuality.OFFLINE;
        } else if (state.type === "cellular") {
          quality = ConnectionQuality.CELLULAR;
        }

        this.updateStatus({
          isOnline: state.isInternetReachable !== false,
          type: state.type || "unknown",
          isExpensive: state.details?.isConnectionExpensive || false,
          isInternetReachable: state.isInternetReachable,
          connectionQuality: quality,
        });
      });
    }
  }

  /**
   * Convert connection quality to effective network type for adaptive payloads
   *
   * Maps:
   * - OFFLINE → "offline"
   * - CELLULAR (cellular) → "3g"
   * - BAD (high latency) → "2g" or "slow-2g" based on severity
   * - GOOD + wifi → "4g"
   * - GOOD + cellular → "3g" (cellular is metered, treat as 3G)
   */
  private deriveEffectiveType(status: NetworkStatus): NetworkStatus["effectiveType"] {
    if (status.connectionQuality === ConnectionQuality.OFFLINE) {
      return "offline";
    }

    if (status.connectionQuality === ConnectionQuality.CELLULAR) {
      // Cellular networks are typically 3G speed; use 2g if also expensive/low battery
      return status.isExpensive ? "2g" : "3g";
    }

    if (status.connectionQuality === ConnectionQuality.BAD) {
      // High latency detected; use slow-2g for very poor connections, 2g for moderate
      // Average latency from pingLatencies indicates severity
      const avgLatency =
        this.pingLatencies.length > 0
          ? this.pingLatencies.reduce((a, b) => a + b, 0) /
            this.pingLatencies.length
          : 0;

      // If latency is extreme (>1000ms), treat as slow-2g; otherwise 2g
      const isSevere = avgLatency > 1000;
      return isSevere ? "slow-2g" : "2g";
    }

    // GOOD connection
    if (status.type === "cellular") {
      // Cellular on good signal is 3G capability
      return "3g";
    }

    // WiFi on good signal is 4G capability
    return "4g";
  }

  /**
   * Update status and notify listeners
   */
  private updateStatus(partial: Partial<NetworkStatus>): void {
    const oldStatus = { ...this.currentStatus };
    this.currentStatus = { ...this.currentStatus, ...partial };

    // Derive and include effectiveType in the updated status
    this.currentStatus.effectiveType = this.deriveEffectiveType(this.currentStatus);

    // Trigger state transition if connection quality changed
    if (oldStatus.connectionQuality !== this.currentStatus.connectionQuality) {
      const oldState = qualityToNetworkState(oldStatus.connectionQuality);
      const newState = qualityToNetworkState(
        this.currentStatus.connectionQuality,
      );
      this.triggerStateTransition(oldState, newState).catch((error) => {
        logger.warn("network", `Failed to transition state: ${error}`);
      });
    }

    // Log significant changes
    if (oldStatus.isOnline !== this.currentStatus.isOnline) {
      logger
        .category("network")
        .info(
          `Online status changed: ${oldStatus.isOnline} -> ${this.currentStatus.isOnline}`,
        );
    }

    if (oldStatus.type !== this.currentStatus.type) {
      logger.category("network").debug("Network type changed", {
        from: oldStatus.type,
        to: this.currentStatus.type,
      });
    }

    if (oldStatus.connectionQuality !== this.currentStatus.connectionQuality) {
      logger
        .category("network")
        .info(
          `Connection quality changed: ${oldStatus.connectionQuality} -> ${this.currentStatus.connectionQuality}`,
        );
    }

    if (oldStatus.isExpensive !== this.currentStatus.isExpensive) {
      logger.category("network").debug("Expensive flag changed", {
        from: oldStatus.isExpensive,
        to: this.currentStatus.isExpensive,
      });
    }

    if (oldStatus.effectiveType !== this.currentStatus.effectiveType) {
      logger
        .category("network")
        .debug(
          `Effective type changed (adaptive payload quality): ${oldStatus.effectiveType} -> ${this.currentStatus.effectiveType}`,
        );
    }

    this.notifyListeners();
  }

  /**
   * Trigger state machine transition
   *
   * Handles the required OFFLINE → RECOVERING → Connected state sequence.
   * The state machine enforces that OFFLINE can only transition to RECOVERING,
   * not directly to connected states. This method enforces that constraint.
   */
  private async triggerStateTransition(
    oldState: NetworkState,
    newState: NetworkState,
  ): Promise<void> {
    try {
      // If transitioning FROM offline TO a connected state (GOOD/BAD/CELLULAR),
      // we must go through RECOVERING first (state machine constraint)
      if (oldState === "OFFLINE" && newState !== "OFFLINE") {
        const isConnectedState = ["GOOD", "BAD", "CELLULAR"].includes(newState);
        if (isConnectedState) {
          // Transition through RECOVERING: OFFLINE → RECOVERING → newState
          logger.info(
            "network",
            `Offline recovery detected: ${oldState} → RECOVERING → ${newState}`,
          );
          await NetworkStateManager.transitionTo(
            "RECOVERING",
            "offline recovery start",
          );
          // Now transition to the final connected state
          await NetworkStateManager.transitionTo(
            newState,
            "offline recovery complete",
          );
          return;
        }
      }

      // For all other transitions, go directly
      await NetworkStateManager.transitionTo(newState, `from ${oldState}`);
    } catch (error) {
      logger.warn(
        "network",
        `Failed state transition ${oldState} → ${newState}: ${error}`,
      );
    }
  }

  /**
   * Notify all listeners of status change
   */
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener(this.currentStatus);
      } catch (error) {
        logger
          .category("network")
          .error("Network status listener error:", error);
      }
    }
  }

  /**
   * Get current network status
   */
  getStatus(): NetworkStatus {
    return { ...this.currentStatus };
  }

  /**
   * Check if currently online
   */
  isOnline(): boolean {
    return this.currentStatus.isOnline;
  }

  /**
   * Get current connection quality
   */
  getConnectionQuality(): ConnectionQuality {
    return this.currentStatus.connectionQuality;
  }

  /**
   * Subscribe to network status changes
   * Returns unsubscribe function
   */
  subscribe(callback: NetworkStatusCallback): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Get current network state from state machine
   */
  getNetworkState(): NetworkState {
    return NetworkStateManager.getState();
  }

  /**
   * Register hook for specific state transition
   * Called when transitioning from → to
   *
   * @param from - Source state
   * @param to - Target state
   * @param hook - Callback to execute on transition
   * @returns Unsubscribe function to remove the hook
   */
  onSpecificTransition(
    from: NetworkState,
    to: NetworkState,
    hook: () => Promise<void> | void,
  ): () => void {
    return NetworkStateManager.onSpecificTransition(from, to, hook);
  }

  /**
   * Register hook for any state transition
   * Called on every state change
   *
   * @param hook - Callback to execute on any transition
   * @returns Unsubscribe function to remove the hook
   */
  onAnyTransition(
    hook: (from: NetworkState, to: NetworkState) => Promise<void> | void,
  ): () => void {
    return NetworkStateManager.onTransition(hook);
  }

  /**
   * Get recovery backoff time (for implementing retry logic)
   */
  getRecoveryBackoff(): number {
    return NetworkStateManager.getRecoveryBackoff();
  }

  /**
   * Check if currently in RECOVERING state
   */
  isRecovering(): boolean {
    return NetworkStateManager.isRecovering();
  }

  /**
   * Transition to a specific state (for testing)
   */
  transitionTo(state: NetworkState): Promise<void> {
    return NetworkStateManager.transitionTo(
      state,
      "manual transition (testing)",
    );
  }
}

/**
 * Singleton instance
 */
export const NetworkDetection = new NetworkDetectionClass();

/**
 * Hook for detecting network status changes in React components
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { isOnline, connectionQuality } = useNetworkStatus();
 *
 *   if (connectionQuality === ConnectionQuality.OFFLINE) {
 *     return <div>Offline - showing cached data</div>;
 *   }
 *
 *   if (connectionQuality === ConnectionQuality.BAD) {
 *     return <div>Poor connection - reduced features</div>;
 *   }
 *
 *   return <div>Online</div>;
 * }
 * ```
 */
export function useNetworkStatus(): NetworkStatus {
  const [status, setStatus] = React.useState<NetworkStatus>(
    NetworkDetection.getStatus(),
  );

  React.useEffect(() => {
    // Subscribe to changes
    const unsubscribe = NetworkDetection.subscribe(setStatus);
    return unsubscribe;
  }, []);

  return status;
}
