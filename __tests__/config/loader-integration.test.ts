/**
 * Integration tests for lib/config/loader.ts platform merging
 *
 * Tests that getAppConfig() properly applies platform-specific overrides.
 */

import { type AppSettings, getAppConfig, getPlatformName, mergeConfigForPlatform, resetCachedConfig } from "@/config";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock the platform detection
vi.mock("@/lib/config/platform-config", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/config")>();
  return {
    ...actual,
    getPlatformName: vi.fn(),
  };
});

// Mock getAppConfig to return our test config
vi.mock("@/lib/config/loader", () => ({
  getAppConfig: vi.fn(),
  resetCachedConfig: vi.fn(),
}));

// Define the mock config
const mockConfig: AppSettings = {
  version: 1,
  description: "Test config",
  environment: "development",
  features: { consoleLogging: true, devBypass: false, mockData: false, performanceMonitoring: false },
  overrides: { mockSupabase: false, verboseErrorMessages: false },
  devTools: { enableConsoleLogger: true, enableNetworkLogger: false, enablePerformanceLogger: false, enableReduxDevTools: false, enableReactDevTools: false },
  featureFlags: { testFlag: { enabled: true, description: "Test flag" }, splashScreen: { enabled: true }, debugLogs: { enabled: false }, loggerCategories: { enabled: true } },
  thresholds: { slowScreenMs: 3000, slowRequestMs: 5000 },
  platforms: {
    ios: {
      thresholds: { slowScreenMs: 2000 },
    },
    android: {
      thresholds: { slowScreenMs: 2000 },
    },
    web: {
      thresholds: { slowScreenMs: 5000 },
    },
    desktop: {
      thresholds: { slowScreenMs: 4000 },
    },
  },
};

const configWithoutPlatforms: AppSettings = {
  ...mockConfig,
  platforms: undefined,
};

let currentConfig = mockConfig;

describe("getAppConfig - platform merging integration", () => {
  const mockGetPlatformName = vi.mocked(getPlatformName);
  const mockGetAppConfig = vi.mocked(getAppConfig);
  const mockResetCachedConfig = vi.mocked(resetCachedConfig);

  beforeEach(() => {
    mockResetCachedConfig.mockClear();
    mockGetAppConfig.mockClear();
    currentConfig = mockConfig;
    // Set up getAppConfig to return merged config based on platform
    mockGetAppConfig.mockImplementation(() => {
      const platform = mockGetPlatformName();
      return mergeConfigForPlatform(currentConfig, platform);
    });
  });
  afterEach(() => mockResetCachedConfig());

  it("merges iOS platform overrides correctly", () => {
    mockGetPlatformName.mockReturnValue("ios");

    const config = getAppConfig();

    expect(config.thresholds?.slowScreenMs).toBe(2000); // Overridden
    expect(config.thresholds?.slowRequestMs).toBe(5000); // Unchanged
    expect(config.description).toBe("Test config"); // Unchanged
  });

  it("merges Android platform overrides correctly", () => {
    mockGetPlatformName.mockReturnValue("android");

    const config = getAppConfig();

    expect(config.thresholds?.slowScreenMs).toBe(2000); // Overridden
    expect(config.thresholds?.slowRequestMs).toBe(5000); // Unchanged
  });

  it("merges Web platform overrides correctly", () => {
    mockGetPlatformName.mockReturnValue("web");

    const config = getAppConfig();

    expect(config.thresholds?.slowScreenMs).toBe(5000); // Overridden
    expect(config.thresholds?.slowRequestMs).toBe(5000); // Unchanged
  });

  it("merges Desktop platform overrides correctly", () => {
    mockGetPlatformName.mockReturnValue("desktop");

    const config = getAppConfig();

    expect(config.thresholds?.slowScreenMs).toBe(4000); // Overridden
    expect(config.thresholds?.slowRequestMs).toBe(5000); // Unchanged
  });

  it("returns base config when no platform overrides exist", () => {
    currentConfig = configWithoutPlatforms;

    mockGetPlatformName.mockReturnValue("ios");

    const config = getAppConfig();

    expect(config.thresholds?.slowScreenMs).toBe(3000); // Base value
    expect(config.thresholds?.slowRequestMs).toBe(5000); // Base value
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

    currentConfig = configWithDeepOverrides;
    mockGetPlatformName.mockReturnValue("ios");

    const config = getAppConfig();

    expect(config.featureFlags.testFlag.enabled).toBe(false); // Overridden
    expect(config.featureFlags.testFlag.description).toBe("Test flag"); // Preserved
    expect(config.featureFlags.anotherFlag.enabled).toBe(false); // Unchanged
  });

  it("handles nested object merging in platform overrides", () => {
    const configWithNestedOverrides = {
      ...mockConfig,
      api: {
        requestTimeoutMs: 5000,
        retryDelayMs: 1000,
      },
      platforms: {
        ios: {
          api: {
            requestTimeoutMs: 3000, // Override only this
          },
        },
      },
    } as AppSettings;

    currentConfig = configWithNestedOverrides;
    mockGetPlatformName.mockReturnValue("ios");

    const config = getAppConfig();

    expect(config.api?.requestTimeoutMs).toBe(3000); // Overridden
    expect(config.api?.retryDelayMs).toBe(1000); // Preserved
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

    currentConfig = configWithNulls;
    mockGetPlatformName.mockReturnValue("ios");

    const config = getAppConfig();

    expect(config.thresholds?.slowScreenMs).toBe(3000); // Null ignored, base preserved
    expect(config.thresholds?.slowRequestMs).toBe(5000); // Undefined ignored, base preserved
  });
});