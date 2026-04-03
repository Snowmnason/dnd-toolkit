/**
 * Adaptive Phase Executor
 *
 * Handles phase execution with adaptive timeouts based on:
 * 1. Device slowdown (measured from config phase duration vs phaseTiming baseMs)
 * 2. Network conditions (detected by network phase)
 * 3. phaseTiming values (loaded from config as baselines)
 *
 * Adaptive timeout formula:
 * finalTimeout = phaseTiming[phase].baseMs * deviceSlowdown * networkMultiplier
 *
 * Usage:
 * - After config phase: calculate deviceSlowdownFactor from actual duration vs phaseTiming.config.baseMs
 * - Pass this factor to executePhaseWithTimeout for all remaining phases
 * - Network phase detects network type and sets networkMultiplier
 * - phaseTiming[phaseName].baseMs serves as both the baseline AND the guaranteed minimum timeout
 */

import { getAppConfig } from "@/config";
import type { PhaseState } from "@/type-definitions/kernel-types";
import { classifyPhaseError, isTimeout } from "./phase-error-classifier";

/**
 * Platform detection for analytics
 * Returns simplified platform identifier (e.g., 'web', 'ios', 'android')
 */
function detectDevicePlatform(): string {
  if (typeof window === "undefined") return "unknown";

  // Check for React Native
  if (typeof navigator !== "undefined" && navigator.product === "ReactNative") {
    // Check for platform specifics
    if (typeof process !== "undefined" && process.platform) {
      if (process.platform === "win32") return "windows";
      if (process.platform === "darwin") return "macos";
      if (process.platform === "linux") return "linux";
    }
    return "native"; // Generic React Native
  }

  // Web platform detection
  if (typeof navigator !== "undefined") {
    const ua = navigator.userAgent || "";
    if (/android/i.test(ua)) return "android";
    if (/iPhone|iPad|iPod/i.test(ua)) return "ios";
    if (/Windows/i.test(ua)) return "windows";
    if (/Macintosh/i.test(ua)) return "macos";
    if (/Linux/i.test(ua)) return "linux";
  }

  return "web";
}

/**
 * Analytics capture for a single phase execution
 */
export interface PhaseAnalytics {
  name: string;
  baselineMs: number; // From phaseTiming in config
  timeoutMs: number; // Final calculated timeout (baseMs * slowdown * networkMultiplier)
  actualDurationMs: number; // How long it actually took
  status: "success" | "skipped" | "failed";
  reason?: "unreachable" | "timeout" | "non-recoverable";
}

/**
 * Slowdown factor analytics (as percentage: 178 = 1.78x or 178%)
 */
export interface SlowdownAnalytics {
  configActualMs: number; // Actual config phase duration (e.g., 1950ms)
  configBaselineMs: number; // Config baseline from phaseTiming (e.g., 700ms)
  factor: number; // Decimal factor (e.g., 1.78)
  percentageOverBaseline: number; // As percentage (e.g., 178 = 78% slower)
}

/**
 * Complete kernel bootstrap analytics
 * Captures all timing, platform, and network information for analysis
 */
export interface KernelBootstrapAnalytics {
  // Device & Environment
  platform: string; // 'web', 'ios', 'android', 'windows', 'macos', 'linux', etc.
  timestamp: number; // Unix timestamp when analytics collected

  // Network
  networkType: string; // e.g., 'wifi-4G', 'cellular-2G'
  networkMultiplier: number; // e.g., 1.5 for 4G

  // Slowdown tracking
  slowdown: SlowdownAnalytics;

  // All phases
  phases: PhaseAnalytics[];

  // Overall
  totalDurationMs: number; // Sum of all phase actualDurationMs
  bootstrapStartedAt: number; // Unix timestamp
  bootstrapCompletedAt: number; // Unix timestamp
}

/**
 * Create slowdown analytics object
 * Calculates percentage representation for easier interpretation
 */
export function createSlowdownAnalytics(
  configActualMs: number,
  configBaselineMs: number
): SlowdownAnalytics {
  const factor = calculateSlowdownFactor(configActualMs, configBaselineMs);
  const percentageOverBaseline = Math.round((factor - 1) * 100);

  return {
    configActualMs,
    configBaselineMs,
    factor,
    percentageOverBaseline, // e.g., 78 means "78% slower" (1.78x)
  };
}

/**
 * Create phase analytics from execution state
 */
export function createPhaseAnalytics(
  phaseName: string,
  phaseState: PhaseState,
  baselineMs: number,
  timeoutMs: number
): PhaseAnalytics {
  return {
    name: phaseName,
    baselineMs,
    timeoutMs,
    actualDurationMs: phaseState.durationMs || 0,
    status: phaseState.status as "success" | "skipped" | "failed",
    reason: phaseState.reason,
  };
}

/**
 * Initialize bootstrap analytics tracking
 * Call this at the start of kernel execution
 */
export function initializeBootstrapAnalytics(): KernelBootstrapAnalytics {
  return {
    platform: detectDevicePlatform(),
    timestamp: Date.now(),
    networkType: "unknown",
    networkMultiplier: 1.0,
    slowdown: {
      configActualMs: 0,
      configBaselineMs: 0,
      factor: 1.0,
      percentageOverBaseline: 0,
    },
    phases: [],
    totalDurationMs: 0,
    bootstrapStartedAt: Date.now(),
    bootstrapCompletedAt: 0,
  };
}

/**
 * Finalize bootstrap analytics after all phases complete
 * Calculates summary metrics and timestamps
 */
export function finalizeBootstrapAnalytics(
  analytics: KernelBootstrapAnalytics
): KernelBootstrapAnalytics {
  return {
    ...analytics,
    bootstrapCompletedAt: Date.now(),
    totalDurationMs: analytics.phases.reduce(
      (sum, phase) => sum + phase.actualDurationMs,
      0
    ),
  };
}

/**
 * Calculate device slowdown factor from actual vs baseline duration
 *
 * @param actualDurationMs How long the phase actually took
 * @param baselineMs The baseline timeout from phaseTiming (e.g., config: 700ms)
 * @returns Multiplier factor (e.g., 2.78 for "device is 2.78x slower than baseline")
 *
 * @example
 * // Config took 1950ms vs 700ms baseline = device is slow
 * const slowdown = calculateSlowdownFactor(1950, 700); // 2.78x
 * // All remaining phases: finalTimeout = phaseTiming.baseMs * 2.78 * networkMultiplier
 */
export function calculateSlowdownFactor(
  actualDurationMs: number,
  baselineMs: number
): number {
  if (baselineMs <= 0 || actualDurationMs <= 0) return 1.0;
  // Slowdown = actual / baseline
  // - If actual > baseline (slow device), slowdown > 1.0 (give more time) ✓
  // - If actual < baseline (fast device), slowdown < 1.0 → clamped to 1.0 (don't give less time) ✓
  return Math.max(1.0, actualDurationMs / baselineMs);
}

/**
 * Calculate effective timeout for a phase
 *
 * @param phaseName Name of the phase (e.g., "network", "services")
 * @param deviceSlowdown Device slowdown factor (e.g., 2.78x)
 * @param networkMultiplier Network speed multiplier (e.g., 1.5x for 4G)
 * @returns Final timeout in milliseconds
 *
 * @example
 * // services phase on slow device + 4G network
 * const timeout = calculateEffectiveTimeout("services", 2.78, 1.5);
 * // baseMs: 5500 * 2.78 * 1.5 = 22,935ms
 */
export function calculateEffectiveTimeout(
  phaseName: string,
  deviceSlowdown: number = 1.0,
  networkMultiplier: number = 1.0
): number {
  const config = getAppConfig();
  const phaseConfig = config.kernel?.phaseTiming?.[phaseName as keyof typeof config.kernel.phaseTiming];

  if (!phaseConfig) {
    // Fallback if phase not found in config
    return Math.ceil(3000 * deviceSlowdown * networkMultiplier);
  }

  const baseMs = phaseConfig.baseMs || 3000;
  return Math.ceil(baseMs * deviceSlowdown * networkMultiplier);
}

/**
 * Execute a phase with timeout and adaptive scaling
 *
 * Wraps phase execution with adaptive timeout and error classification.
 * finalTimeout = phaseTiming[phaseName].baseMs * deviceSlowdown * networkMultiplier
 *
 * @param phaseName Name of the phase (used to lookup phaseTiming.baseMs)
 * @param fn The async function to execute
 * @param deviceSlowdown Measured device slowdown factor (default 1.0 = normal speed)
 * @param networkMultiplier Network speed multiplier (default 1.0 = wifi 4G)
 * @returns PhaseState with status, reason, retriable flag, etc.
 *
 * @example
 * // Config phase took 1950ms vs 700ms baseline = 2.78x slowdown
 * // Network detected 4G = 1.5x multiplier
 * // services phaseTiming.baseMs = 5500
 * const result = await executePhaseWithTimeout(
 *   "services",
 *   () => servicesPhase(),
 *   2.78,  // device slowdown (actual / baseline)
 *   1.5    // network multiplier (4G)
 * );
 * // finalTimeout = 5500 * 2.78 * 1.5 = 22,935ms
 *
 * if (result.status === "success") {
 *   // Phase succeeded within timeout
 * } else if (result.retriable) {
 *   // Phase failed due to timeout, can retry
 * } else {
 *   // Phase failed non-recoverably
 *   throw result.error;
 * }
 */
export async function executePhaseWithTimeout(
  phaseName: string,
  fn: (signal: AbortSignal) => Promise<void>,
  deviceSlowdown: number = 1.0,
  networkMultiplier: number = 1.0
): Promise<PhaseState> {
  const timeout = calculateEffectiveTimeout(phaseName, deviceSlowdown, networkMultiplier);
  const startTime = Date.now();
  const controller = new AbortController();

  return new Promise((resolve) => {
    let completed = false;

    // Set a timeout that will fire after the duration
    const timeoutHandle = setTimeout(() => {
      if (!completed) {
        completed = true;
        controller.abort(); // cancel the phase fn — prevent post-timeout state mutations
        resolve({
          status: "skipped",
          reason: "timeout",
          retriable: true,
          durationMs: timeout,
          error: `Phase timed out after ${timeout}ms`,
        });
      }
    }, timeout);

    // Execute the phase, passing the abort signal so it can stop on timeout
    Promise.resolve()
      .then(() => fn(controller.signal))
      .then(() => {
        if (!completed) {
          completed = true;
          clearTimeout(timeoutHandle);
          const duration = Date.now() - startTime;

          resolve({
            status: "success",
            durationMs: duration,
          });
        }
      })
      .catch((error) => {
        if (!completed) {
          completed = true;
          clearTimeout(timeoutHandle);
          const duration = Date.now() - startTime;
          const failureType = classifyPhaseError(error);

          resolve({
            status: "skipped",
            reason: failureType,
            retriable: isTimeout(failureType),
            durationMs: duration,
            error,
          });
        }
      });
  });
}
