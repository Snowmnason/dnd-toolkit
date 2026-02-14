/**
 * Platform-specific Configuration Module
 *
 * Provides platform detection and config merging to enable per-platform overrides
 * for thresholds, timeouts, and other infrastructure settings.
 *
 * Design:
 * - `getPlatformName()` detects the current platform (web, ios, android, desktop)
 * - `mergeConfigForPlatform()` applies partial platform overrides to a base config
 * - Merge happens once at startup in getAppConfig() and result is cached
 * - No runtime cost; all overrides applied before config is returned to callers
 *
 * Platforms: "web", "ios", "android", "desktop" (not Expo style)
 */

import { Platform } from "react-native";
import type { AppSettings } from "./loader";

export type PlatformName = "web" | "ios" | "android" | "desktop";

/**
 * Detect the current platform
 *
 * Returns: "desktop" (Electron), "web", "ios", "android"
 * Throws: Never; defaults to "unknown" if detection fails
 *
 * Detection order (first match wins):
 * 1. Check for Electron (window.electron !== undefined)
 * 2. Platform.OS === "web" → "web"
 * 3. Platform.OS === "ios" → "ios"
 * 4. Platform.OS === "android" → "android"
 * 5. Otherwise → "unknown"
 */
export function getPlatformName(): PlatformName | "unknown" {
  try {
    // Detect Electron
    if (typeof window !== "undefined" && "electron" in window && window.electron !== undefined) {
      return "desktop";
    }

    // Detect via React Native Platform.OS
    const os = Platform.OS;
    if (os === "web") return "web";
    if (os === "ios") return "ios";
    if (os === "android") return "android";

    return "unknown";
  } catch {
    return "unknown";
  }
}

/**
 * Deep merge partial config override into base config
 *
 * Strategy:
 * - For each key in override:
 *   - If value is a plain object and base also has object at same key: recursively merge
 *   - Otherwise: replace with override value
 * - Arrays are replaced entirely (no merge)
 * - null/undefined in override are skipped (no removal)
 * - Result is a new object (non-mutating)
 *
 * @param base Base config (AppSettings or subset thereof)
 * @param override Partial config override (Partial<AppSettings> or subset)
 * @returns Merged config (same shape as base, with override values applied)
 */
function deepMergeConfigs<T extends Record<string, any>>(
  base: T,
  override: Partial<T> | undefined,
): T {
  if (!override) return { ...base };

  const result = { ...base };

  for (const key in override) {
    if (!Object.prototype.hasOwnProperty.call(override, key)) continue;

    const overrideValue = override[key];

    // Skip null/undefined in override (don't remove base value)
    if (overrideValue === null || overrideValue === undefined) continue;

    // If both values are plain objects, recursively merge; otherwise replace
    if (
      typeof overrideValue === "object" &&
      !Array.isArray(overrideValue) &&
      typeof result[key] === "object" &&
      !Array.isArray(result[key]) &&
      result[key] !== null
    ) {
      // eslint-disable-next-line security/detect-object-injection
      result[key] = deepMergeConfigs(result[key] as any, overrideValue as any);
    } else {
      // eslint-disable-next-line security/detect-object-injection
      result[key] = overrideValue as any;
    }
  }

  return result;
}

/**
 * Apply platform-specific config overrides to base config
 *
 * @param config Base AppSettings config
 * @param platform Platform name (web, ios, android, desktop). If not provided, uses getPlatformName()
 * @returns Config with platform overrides applied (merged into base)
 *
 * Example:
 * ```
 * const base = { thresholds: { slowScreenMs: 3000 }, network: { pingIntervalMs: 600000 } };
 * const overrides = {
 *   ios: { thresholds: { slowScreenMs: 2000 } }
 * };
 * const platform = "ios";
 * const merged = mergeConfigForPlatform({ ...base, platforms: overrides }, "ios");
 * // merged.thresholds.slowScreenMs === 2000 ✓
 * // merged.network.pingIntervalMs === 600000 ✓ (not overridden)
 * ```
 */
export function mergeConfigForPlatform(
  config: AppSettings,
  platform?: PlatformName | "unknown",
): AppSettings {
  // Use provided platform or detect the current platform
  const targetPlatform = platform || getPlatformName();

  // If no platforms section or unknown platform, return config as-is
  if (!config.platforms || targetPlatform === "unknown") {
    return { ...config };
  }

  // Get platform-specific overrides (if any)
  const platformOverrides = (config.platforms as Record<string, Partial<AppSettings> | undefined>)[
    targetPlatform as string
  ];

  if (!platformOverrides) {
    return { ...config };
  }

  // Merge base config + platform overrides
  const merged = deepMergeConfigs(config, platformOverrides);

  // Return merged config (including original platforms section for reference)
  return merged;
}
