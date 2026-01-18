/**
 * Network Detection Utilities
 *
 * Provides cross-platform network status detection for web, iOS, and Android.
 * Tracks detailed connection states (good, bad, no-wifi, offline) for implementing
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
  /** WiFi disconnected, using cellular/hotspot - may be metered */
  NO_WIFI = "no-wifi",
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
}

/**
 * Battery status information
 */
interface BatteryStatus {
  level: number | null; // 0..1 or null if unavailable
  charging: boolean;
}

const LOW_BATTERY_THRESHOLD = 0.2; // 20% threshold for expensive flag
const WEB_PING_INTERVAL = 5 * 60 * 1000; // 5 minutes
const WEB_PING_TIMEOUT = 5000; // 5 second timeout
const LATENCY_THRESHOLD = 500; // 500ms = poor connection

/**
 * Callback when network status changes
 */
export type NetworkStatusCallback = (status: NetworkStatus) => void;

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
  };

  private currentBattery: BatteryStatus = {
    level: null,
    charging: false,
  };

  private listeners: Set<NetworkStatusCallback> = new Set();
  private isInitialized = false;
  private webPingTimer: ReturnType<typeof setInterval> | null = null;
  private batteryUnsubscribe: (() => void) | null = null;
  private pingLatencies: number[] = [];
  private maxLatencyWindowSize = 10; // Track last 10 ping latencies

  /**
   * Initialize network detection
   * Call this once at app startup
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

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

      // Native: Use network detection if available (react-native-netinfo package)
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
      logger.category("network").info("Network detection initialized", {
        isOnline: this.currentStatus.isOnline,
        connectionQuality: this.currentStatus.connectionQuality,
      });
    } catch (error) {
      logger
        .category("network")
        .error("Failed to initialize network detection:", error);
      throw error;
    }
  }

  /**
   * Safely load NetInfo from react-native-netinfo
   * Returns null if package not available
   */
  private async loadNetInfo(): Promise<any> {
    try {
      // Load react-native-netinfo (cross-platform, reliable)
      const module = await import("react-native-netinfo");

      // Extract NetInfo - it's a named export
      const NetInfo = module.NetInfo || null;
      if (!NetInfo) {
        logger
          .category("network")
          .debug("NetInfo export not found in react-native-netinfo package");
      }
      return NetInfo;
    } catch (error) {
      logger
        .category("network")
        .debug("Failed to load react-native-netinfo package:", error);
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
            // Initial battery state
            this.currentBattery = {
              level: battery.level,
              charging: battery.charging,
            };
            this.updateExpensiveFlag();

            // Listen to battery changes
            battery.addEventListener("levelchange", () => {
              this.currentBattery.level = battery.level;
              this.updateExpensiveFlag();
              logger.category("network").debug("Battery level changed", {
                level: battery.level,
              });
            });

            battery.addEventListener("chargingchange", () => {
              this.currentBattery.charging = battery.charging;
              this.updateExpensiveFlag();
              logger.category("network").debug("Charging state changed", {
                charging: battery.charging,
              });
            });

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
            setInterval(async () => {
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
    }, WEB_PING_INTERVAL);

    // Do initial ping
    this.performWebPing();

    logger.category("network").debug("Web periodic ping initialized", {
      interval: WEB_PING_INTERVAL,
    });
  }

  /**
   * Perform a single ping to verify web connectivity and measure latency
   */
  private async performWebPing(): Promise<void> {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), WEB_PING_TIMEOUT);
      const startTime = performance.now();

      // Use a lightweight endpoint that returns 204 No Content
      // Using a data URL to avoid CORS issues
      const response = await fetch(
        "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7",
        {
          method: "GET",
          signal: controller.signal,
        }
      );

      clearTimeout(timeout);
      const latency = performance.now() - startTime;

      // Track latency for connection quality
      this.pingLatencies.push(latency);
      if (this.pingLatencies.length > this.maxLatencyWindowSize) {
        this.pingLatencies.shift();
      }

      const wasOnline = this.currentStatus.isOnline;
      const isNowOnline = response.ok || response.status < 400;

      if (wasOnline !== isNowOnline) {
        logger.category("network").info("Ping detected connectivity change", {
          from: wasOnline,
          to: isNowOnline,
          latency,
        });
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
      this.updateStatus({ connectionQuality: ConnectionQuality.NO_WIFI });
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
    if (typeof window === "undefined") return;

    // Initial status
    this.currentStatus = {
      isOnline: navigator.onLine,
      type: navigator.onLine ? "wifi" : "none",
      isExpensive: false,
      connectionQuality: navigator.onLine
        ? ConnectionQuality.GOOD
        : ConnectionQuality.OFFLINE,
    };

    logger.category("network").info("Web network detection initialized", {
      isOnline: this.currentStatus.isOnline,
    });

    // Listen to online/offline events
    window.addEventListener("online", () => {
      logger
        .category("network")
        .info("Network came online (navigator.online event)");
      this.updateStatus({
        isOnline: true,
        type: "wifi",
        connectionQuality: ConnectionQuality.GOOD,
      });
    });

    window.addEventListener("offline", () => {
      logger
        .category("network")
        .info("Network went offline (navigator.offline event)");
      this.updateStatus({
        isOnline: false,
        type: "none",
        connectionQuality: ConnectionQuality.OFFLINE,
      });
    });

    // Also listen to visibility changes (helps detect network loss while backgrounded)
    document.addEventListener("visibilitychange", () => {
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
    });
  }

  /**
   * Setup native network detection via react-native-netinfo
   */
  private setupNativeNetworkDetection(NetInfo: any): void {
    // Subscribe to network state updates
    if (NetInfo.addEventListener) {
      NetInfo.addEventListener((state: any) => {
        logger.category("network").debug("Native network state changed", {
          isInternetReachable: state.isInternetReachable,
          type: state.type,
          isConnectionExpensive: state.details?.isConnectionExpensive,
        });

        let quality = ConnectionQuality.GOOD;
        if (state.isInternetReachable === false) {
          quality = ConnectionQuality.OFFLINE;
        } else if (state.type === "cellular") {
          quality = ConnectionQuality.NO_WIFI;
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
   * Update status and notify listeners
   */
  private updateStatus(partial: Partial<NetworkStatus>): void {
    const oldStatus = { ...this.currentStatus };
    this.currentStatus = { ...this.currentStatus, ...partial };

    // Log significant changes
    if (oldStatus.isOnline !== this.currentStatus.isOnline) {
      logger.category("network").info("Online status changed", {
        from: oldStatus.isOnline,
        to: this.currentStatus.isOnline,
      });
    }

    if (oldStatus.type !== this.currentStatus.type) {
      logger.category("network").debug("Network type changed", {
        from: oldStatus.type,
        to: this.currentStatus.type,
      });
    }

    if (oldStatus.connectionQuality !== this.currentStatus.connectionQuality) {
      logger.category("network").info("Connection quality changed", {
        from: oldStatus.connectionQuality,
        to: this.currentStatus.connectionQuality,
      });
    }

    if (oldStatus.isExpensive !== this.currentStatus.isExpensive) {
      logger.category("network").debug("Expensive flag changed", {
        from: oldStatus.isExpensive,
        to: this.currentStatus.isExpensive,
      });
    }

    this.notifyListeners();
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
    NetworkDetection.getStatus()
  );

  React.useEffect(() => {
    // Subscribe to changes
    const unsubscribe = NetworkDetection.subscribe(setStatus);
    return unsubscribe;
  }, []);

  return status;
}
