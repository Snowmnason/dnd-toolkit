/**
 * Tests for lib/config/platform-config.ts
 *
 * Tests platform detection and config merging functionality.
 */

import type { AppSettings } from "@/lib/config/loader";
import { getPlatformName, mergeConfigForPlatform } from "@/lib/config/platform-config";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

describe("getPlatformName", () => {
  const originalWindow = (globalThis as any).window;
  const originalPlatform = (globalThis as any).Platform;

  beforeEach(() => {
    // Reset globals
    delete (globalThis as any).window;
    delete (globalThis as any).Platform;
  });

  afterEach(() => {
    // Restore globals
    if (originalWindow !== undefined) {
      (globalThis as any).window = originalWindow;
    }
    if (originalPlatform !== undefined) {
      (globalThis as any).Platform = originalPlatform;
    }
  });

  it("detects desktop (Electron) when window.electron exists", () => {
    (globalThis as any).window = { electron: {} };
    (globalThis as any).Platform = { OS: "web" };

    expect(getPlatformName()).toBe("desktop");
  });

  it("detects web when Platform.OS is web", () => {
    (globalThis as any).Platform = { OS: "web" };

    expect(getPlatformName()).toBe("web");
  });

  it("detects ios when Platform.OS is ios", () => {
    (globalThis as any).Platform = { OS: "ios" };

    expect(getPlatformName()).toBe("ios");
  });

  it("detects android when Platform.OS is android", () => {
    (globalThis as any).Platform = { OS: "android" };

    expect(getPlatformName()).toBe("android");
  });

  it("returns unknown for unrecognized Platform.OS", () => {
    (globalThis as any).Platform = { OS: "unknown" };

    expect(getPlatformName()).toBe("unknown");
  });

  it("returns unknown when Platform is not available", () => {
    expect(getPlatformName()).toBe("unknown");
  });

  it("returns unknown when Platform.OS throws", () => {
    (globalThis as any).Platform = {
      get OS() {
        throw new Error("Platform unavailable");
      },
    };

    expect(getPlatformName()).toBe("unknown");
  });
});

describe("mergeConfigForPlatform", () => {
  const baseConfig: AppSettings = {
    version: 1,
    description: "Test config",
    environment: "development",
    features: { consoleLogging: true, devBypass: false, mockData: false, performanceMonitoring: false, sentryEnabled: false },
    overrides: { mockSupabase: false, verboseErrorMessages: false },
    devTools: { enableConsoleLogger: true, enableNetworkLogger: false, enablePerformanceLogger: false, enableReduxDevTools: false, enableReactDevTools: false },
    featureFlags: { testFlag: { enabled: true, description: "Test flag" } },
    thresholds: { slowScreenMs: 3000, slowRequestMs: 5000 },
    network: { pingIntervalMs: 600000, pingTimeoutMs: 5000, statusCheckTimeoutMs: 30000, description: "Network settings" },
  };

  it("returns config unchanged when no platforms section", () => {
    const config = { ...baseConfig };
    const result = mergeConfigForPlatform(config);

    expect(result).toEqual(config);
    expect(result).not.toBe(config); // Should be a new object
  });

  it("returns config unchanged when platform is unknown", () => {
    const config = {
      ...baseConfig,
      platforms: {
        ios: { thresholds: { slowScreenMs: 2000 } },
      },
    } as AppSettings;
    const result = mergeConfigForPlatform(config, "unknown");

    expect(result.thresholds?.slowScreenMs).toBe(3000); // Base value
  });

  it("applies platform overrides for ios", () => {
    const config = {
      ...baseConfig,
      platforms: {
        ios: {
          thresholds: { slowScreenMs: 2000 },
          network: { pingIntervalMs: 30000 },
        },
      },
    };
    const result = mergeConfigForPlatform(config, "ios");

    expect(result.thresholds?.slowScreenMs).toBe(2000); // Overridden
    expect(result.thresholds?.slowRequestMs).toBe(5000); // Not overridden
    expect(result.network?.pingIntervalMs).toBe(30000); // Overridden
    expect(result.network?.pingTimeoutMs).toBe(5000); // Not overridden
  });

  it("applies platform overrides for web", () => {
    const config = {
      ...baseConfig,
      platforms: {
        web: {
          thresholds: { slowScreenMs: 5000, slowRequestMs: 7000 },
        },
      },
    };
    const result = mergeConfigForPlatform(config, "web");

    expect(result.thresholds?.slowScreenMs).toBe(5000);
    expect(result.thresholds?.slowRequestMs).toBe(7000);
  });

  it("deep merges nested objects", () => {
    const config = {
      ...baseConfig,
      featureFlags: {
        testFlag: { enabled: true, description: "Test flag" },
        anotherFlag: { enabled: false, description: "Another flag" },
      },
      platforms: {
        ios: {
          featureFlags: {
            testFlag: { enabled: false }, // Override only enabled, keep description
          },
        },
      },
    };
    const result = mergeConfigForPlatform(config, "ios");

    expect(result.featureFlags?.testFlag?.enabled).toBe(false); // Overridden
    expect(result.featureFlags?.testFlag?.description).toBe("Test flag"); // Preserved
    expect(result.featureFlags?.anotherFlag?.enabled).toBe(false); // Unchanged
  });

  it("replaces arrays entirely (no merge)", () => {
    const config = {
      ...baseConfig,
      someArray: [1, 2, 3],
      platforms: {
        ios: {
          someArray: [4, 5],
        },
      },
    };
    const result = mergeConfigForPlatform(config, "ios");

    expect(result.someArray).toEqual([4, 5]); // Replaced, not merged
  });

  it("ignores null/undefined values in overrides", () => {
    const config = {
      ...baseConfig,
      thresholds: { slowScreenMs: 3000 },
      platforms: {
        ios: {
          thresholds: { slowScreenMs: null as any, slowRequestMs: undefined },
        },
      },
    };
    const result = mergeConfigForPlatform(config, "ios");

    expect(result.thresholds?.slowScreenMs).toBe(3000); // Not overridden
    expect(result.thresholds?.slowRequestMs).toBe(5000); // Not overridden
  });

  it("preserves original platforms section in result", () => {
    const config = {
      ...baseConfig,
      platforms: {
        ios: { thresholds: { slowScreenMs: 2000 } },
      },
    };
    const result = mergeConfigForPlatform(config, "ios");

    expect(result.platforms).toEqual(config.platforms); // Preserved
  });

  it("handles multiple platforms correctly", () => {
    const config = {
      ...baseConfig,
      platforms: {
        ios: { thresholds: { slowScreenMs: 2000 } },
        web: { thresholds: { slowScreenMs: 5000 } },
      },
    };

    const iosResult = mergeConfigForPlatform(config, "ios");
    const webResult = mergeConfigForPlatform(config, "web");

    expect(iosResult.thresholds?.slowScreenMs).toBe(2000);
    expect(webResult.thresholds?.slowScreenMs).toBe(5000);
  });
});