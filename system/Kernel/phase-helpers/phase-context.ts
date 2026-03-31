/**
 * Phase Context
 *
 * Runtime context for phase execution decisions.
 * Captures platform, device type, and environment at kernel startup.
 *
 * Used by phase-dependency-graph and app-kernel to determine:
 * - Device-specific timeout multipliers
 * - Performance baselines for analytics
 * - Which phases should run (based on environment)
 *
 * Built once at kernel startup, passed through phase execution pipeline.
 */

export interface PhaseContext {
  // Platform identification
  platform: "web" | "ios" | "android" | "desktop";
  deviceType: "phone" | "tablet" | "desktop" | "unknown";

  // Environment
  environment: "development" | "staging" | "production";

  // Network state (detected by network phase)
  networkAvailable?: boolean;
  networkType?: string; // e.g., 'wifi-4G', 'cellular-2G'
}

/**
 * Create phase context from app environment
 * Call once at kernel startup, before phase execution begins
 *
 * @returns PhaseContext with current environment info
 */
export function createPhaseContext(): PhaseContext {
  const platform = detectPlatform();
  const deviceType = detectDeviceType();
  const environment = getEnvironment();

  return {
    platform,
    deviceType,
    environment,
  };
}

/**
 * Detect platform: web, iOS, Android, desktop
 * Called at startup to determine platform-specific behavior
 */
function detectPlatform(): "web" | "ios" | "android" | "desktop" {
  // Check for React Native
  if (typeof navigator !== "undefined" && navigator.product === "ReactNative") {
    // Check specific platform in React Native
    if (typeof process !== "undefined" && process.platform) {
      const platform = (process.platform as string).toLowerCase();
      if (platform === "win32" || platform === "linux" || platform === "darwin") {
        return "desktop";
      }
    }
    // Fallback to user agent
    if (typeof navigator !== "undefined") {
      const ua = navigator.userAgent || "";
      if (/android/i.test(ua)) return "android";
      if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
    }
    return "android"; // Default for RN
  }

  // Web platform detection
  if (typeof navigator !== "undefined") {
    const ua = navigator.userAgent || "";
    if (/android/i.test(ua)) return "android";
    if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
  }

  return "web";
}

/**
 * Detect device type: phone, tablet, or desktop
 * Used for performance tuning and feature availability
 */
function detectDeviceType(): "phone" | "tablet" | "desktop" | "unknown" {
  if (typeof navigator === "undefined") return "unknown";

  const ua = navigator.userAgent || "";

  // Tablet detection
  if (/iPad|android(?!.*mobile)|tablet|playbook|silk|kindle/i.test(ua)) {
    return "tablet";
  }

  // Phone detection
  if (/mobile|iphone|android|blackberry|windows phone/i.test(ua)) {
    return "phone";
  }

  // Desktop detection
  if (/windows|macintosh|linux/i.test(ua)) {
    return "desktop";
  }

  return "unknown";
}

/**
 * Get current environment: development, staging, production
 * Loaded from environment variables
 */
function getEnvironment(): "development" | "staging" | "production" {
  try {
    const env = (process.env as Record<string, unknown>)
      .EXPO_PUBLIC_ENVIRONMENT || process.env.NODE_ENV || "production";

    if (env === "development") return "development";
    if (env === "staging") return "staging";
    return "production";
  } catch {
    return "production";
  }
}

/**
 * Update network info in context after network phase completes
 * Called by app-kernel when network type is detected
 *
 * @param context Existing phase context
 * @param networkType Network type string (e.g., 'wifi-4G', 'cellular-2G')
 * @returns Updated context with network info
 */
export function updatePhaseContextWithNetwork(
  context: PhaseContext,
  networkType: string
): PhaseContext {
  return {
    ...context,
    networkAvailable: true,
    networkType,
  };
}

/**
 * Create minimal context for dev/testing
 * Useful for testing phase execution order without full app config
 */
export function createMinimalPhaseContext(): PhaseContext {
  return {
    platform: "web",
    deviceType: "desktop",
    environment: "development",
    networkAvailable: false,
  };
}
