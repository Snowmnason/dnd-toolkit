/**
 * Integration tests for lib/config/loader.ts platform merging
 *
 * Tests that getAppConfig() properly applies platform-specific overrides.
 */

import type { AppSettings } from "@/lib/config/loader";
import { getAppConfig } from "@/lib/config/loader";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { getPlatformName } from "@/lib/config/platform-config";

// Mock the platform detection
vi.mock("@/lib/config/platform-config", () => ({
  getPlatformName: vi.fn(),
}));

describe("getAppConfig - platform merging integration", () => {
  const mockGetPlatformName = vi.mocked(getPlatformName);

  // Mock the config files
  const mockConfig: AppSettings = {
    version: 1,
    description: "Test config",
    environment: "development",
    features: { consoleLogging: true, devBypass: false, mockData: false, performanceMonitoring: false, sentryEnabled: false },
    overrides: { mockSupabase: false, verboseErrorMessages: false },
    devTools: { enableConsoleLogger: true, enableNetworkLogger: false, enablePerformanceLogger: false, enableReduxDevTools: false, enableReactDevTools: false },
    featureFlags: { testFlag: { enabled: true, description: "Test flag" } },
    thresholds: { slowScreenMs: 3000, slowRequestMs: 5000 },
    platforms: {
      ios: {
        thresholds: { slowScreenMs: 2000 },
        description: "iOS: stricter thresholds for slower devices",
      },
      android: {
        thresholds: { slowScreenMs: 2000 },
        description: "Android: stricter thresholds for slower devices",
      },
      web: {
        thresholds: { slowScreenMs: 5000 },
        description: "Web: more lenient thresholds for desktop browsers",
      },
      desktop: {
        thresholds: { slowScreenMs: 4000 },
        description: "Desktop: moderate thresholds for native performance",
      },
    },
  };

  beforeEach(() => {
    // Mock the config loading to return our test config
    vi.doMock("@/lib/config/appsettings.json", () => ({ default: mockConfig }), { virtual: true });
    vi.doMock("@/lib/config/appsettings.dev.json", () => ({ default: mockConfig }), { virtual: true });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("merges iOS platform overrides correctly", () => {
    mockGetPlatformName.mockReturnValue("ios");

    const config = getAppConfig();

    expect(config.thresholds.slowScreenMs).toBe(2000); // Overridden
    expect(config.thresholds.slowRequestMs).toBe(5000); // Unchanged
    expect(config.description).toBe("Test config"); // Unchanged
  });

  it("merges Android platform overrides correctly", () => {
    mockGetPlatformName.mockReturnValue("android");

    const config = getAppConfig();

    expect(config.thresholds.slowScreenMs).toBe(2000); // Overridden
    expect(config.thresholds.slowRequestMs).toBe(5000); // Unchanged
  });

  it("merges Web platform overrides correctly", () => {
    mockGetPlatformName.mockReturnValue("web");

    const config = getAppConfig();

    expect(config.thresholds.slowScreenMs).toBe(5000); // Overridden
    expect(config.thresholds.slowRequestMs).toBe(5000); // Unchanged
  });

  it("merges Desktop platform overrides correctly", () => {
    mockGetPlatformName.mockReturnValue("desktop");

    const config = getAppConfig();

    expect(config.thresholds.slowScreenMs).toBe(4000); // Overridden
    expect(config.thresholds.slowRequestMs).toBe(5000); // Unchanged
  });

  it("returns base config when no platform overrides exist", () => {
    const configWithoutPlatforms = { ...mockConfig };
    delete configWithoutPlatforms.platforms;

    // Re-mock without platforms
    vi.doMock("@/lib/config/appsettings.json", () => ({ default: configWithoutPlatforms }), { virtual: true });
    vi.doMock("@/lib/config/appsettings.dev.json", () => ({ default: configWithoutPlatforms }), { virtual: true });

    mockGetPlatformName.mockReturnValue("ios");

    const config = getAppConfig();

    expect(config.thresholds.slowScreenMs).toBe(3000); // Base value
    expect(config.thresholds.slowRequestMs).toBe(5000); // Base value
  });

  it("handles deep object merging in platform overrides", () => {
    const configWithDeepOverrides: AppSettings = {
      ...mockConfig,
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

    vi.doMock("@/lib/config/appsettings.json", () => ({ default: configWithDeepOverrides }), { virtual: true });
    vi.doMock("@/lib/config/appsettings.dev.json", () => ({ default: configWithDeepOverrides }), { virtual: true });

    mockGetPlatformName.mockReturnValue("ios");

    const config = getAppConfig();

    expect(config.featureFlags.testFlag.enabled).toBe(false); // Overridden
    expect(config.featureFlags.testFlag.description).toBe("Test flag"); // Preserved
    expect(config.featureFlags.anotherFlag.enabled).toBe(false); // Unchanged
  });

  it("handles array replacement in platform overrides", () => {
    const configWithArrayOverrides: AppSettings = {
      ...mockConfig,
      someArray: ["base", "values"],
      platforms: {
        ios: {
          someArray: ["ios", "override"] as any, // Arrays are replaced, not merged
        },
      },
    };

    vi.doMock("@/lib/config/appsettings.json", () => ({ default: configWithArrayOverrides }), { virtual: true });
    vi.doMock("@/lib/config/appsettings.dev.json", () => ({ default: configWithArrayOverrides }), { virtual: true });

    mockGetPlatformName.mockReturnValue("ios");

    const config = getAppConfig();

    expect(config.someArray).toEqual(["ios", "override"]); // Completely replaced
  });

  it("ignores null and undefined values in platform overrides", () => {
    const configWithNulls: AppSettings = {
      ...mockConfig,
      thresholds: { slowScreenMs: 3000, slowRequestMs: 5000 },
      platforms: {
        ios: {
          thresholds: { slowScreenMs: null as any, slowRequestMs: undefined as any },
        },
      },
    };

    vi.doMock("@/lib/config/appsettings.json", () => ({ default: configWithNulls }), { virtual: true });
    vi.doMock("@/lib/config/appsettings.dev.json", () => ({ default: configWithNulls }), { virtual: true });

    mockGetPlatformName.mockReturnValue("ios");

    const config = getAppConfig();

    expect(config.thresholds.slowScreenMs).toBe(3000); // Null ignored, base preserved
    expect(config.thresholds.slowRequestMs).toBe(5000); // Undefined ignored, base preserved
  });
});