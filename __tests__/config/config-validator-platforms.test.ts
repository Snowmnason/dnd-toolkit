/**
 * Tests for lib/config/config-validator.ts platform validation
 *
 * Tests that the validator properly handles the new platforms section.
 */

import { validateAppSettings } from "@/lib/config/config-validator";
import type { AppSettings } from "@/lib/config/loader";
import { describe, expect, it } from "vitest";

describe("validateAppSettings - platforms section", () => {
  const baseConfig: AppSettings = {
    version: 1,
    description: "Test config",
    environment: "development",
    features: { consoleLogging: true, devBypass: false, mockData: false, performanceMonitoring: false, sentryEnabled: false },
    overrides: { mockSupabase: false, verboseErrorMessages: false },
    devTools: { enableConsoleLogger: true, enableNetworkLogger: false, enablePerformanceLogger: false, enableReduxDevTools: false, enableReactDevTools: false },
    featureFlags: { testFlag: { enabled: true, description: "Test flag" } },
    thresholds: { slowScreenMs: 3000, slowRequestMs: 5000 },
  };

  it("accepts config without platforms section", () => {
    const config = { ...baseConfig };
    const result = validateAppSettings(config);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("accepts valid platforms section with all supported platforms", () => {
    const config = {
      ...baseConfig,
      platforms: {
        web: { thresholds: { slowScreenMs: 5000 } },
        ios: { thresholds: { slowScreenMs: 2000 } },
        android: { thresholds: { slowScreenMs: 2000 } },
        desktop: { thresholds: { slowScreenMs: 4000 } },
      },
    };
    const result = validateAppSettings(config);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("accepts valid platforms section with partial overrides", () => {
    const config = {
      ...baseConfig,
      platforms: {
        ios: { thresholds: { slowScreenMs: 2000 } },
        web: { network: { pingIntervalMs: 30000 } },
      },
    };
    const result = validateAppSettings(config);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects platforms section that is not an object", () => {
    const config = {
      ...baseConfig,
      platforms: "not an object" as any,
    };
    const result = validateAppSettings(config);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("platforms must be an object");
  });

  it("rejects invalid platform names", () => {
    const config = {
      ...baseConfig,
      platforms: {
        "web-mobile": { thresholds: { slowScreenMs: 4000 } }, // Invalid name
        ios: { thresholds: { slowScreenMs: 2000 } },
      },
    };
    const result = validateAppSettings(config);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Invalid platform name: "web-mobile". Valid platforms are: web, ios, android, desktop.');
  });

  it("rejects multiple invalid platform names with clear messages", () => {
    const config = {
      ...baseConfig,
      platforms: {
        "iphone": { thresholds: { slowScreenMs: 2000 } },
        "android-tablet": { thresholds: { slowScreenMs: 2500 } },
        web: { thresholds: { slowScreenMs: 5000 } },
      },
    };
    const result = validateAppSettings(config);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Invalid platform name: "iphone". Valid platforms are: web, ios, android, desktop.');
    expect(result.errors).toContain('Invalid platform name: "android-tablet". Valid platforms are: web, ios, android, desktop.');
  });

  it("rejects platform config that is not an object", () => {
    const config = {
      ...baseConfig,
      platforms: {
        ios: "not an object" as any,
      },
    };
    const result = validateAppSettings(config);

    expect(result.valid).toBe(false);
    expect(result.errors).toContain("platforms.ios must be an object (Partial<AppSettings>)");
  });

  it("accepts empty platforms object", () => {
    const config = {
      ...baseConfig,
      platforms: {},
    };
    const result = validateAppSettings(config);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("validates platform configs are Partial<AppSettings> (allows unknown fields)", () => {
    const config = {
      ...baseConfig,
      platforms: {
        ios: {
          customField: "allowed", // Partial<AppSettings> allows extra fields
          thresholds: { slowScreenMs: 2000 },
        },
      },
    };
    const result = validateAppSettings(config);

    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});