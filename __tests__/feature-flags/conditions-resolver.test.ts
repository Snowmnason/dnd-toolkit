/**
 * Tests for FeatureFlagsManager.isEnabledWithContext()
 *
 * Tests the context-aware flag evaluation with conditions and dependencies
 * Note: These are unit tests focused on the internal resolution logic
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// Now import modules under test after mocks are in place
import * as configModule from "@/lib/config/loader";
import * as platformModule from "@/lib/config/platform-config";
import { FeatureFlagsManager } from "@/lib/feature-flags/server-sync";
import { SecureStorage } from "@/lib/storage";

// Hoist and provide safe mocks before importing modules that read config at import-time
vi.mock("@/lib/config/loader", () => ({
  getAppConfig: vi.fn(() => ({ environment: "production", featureFlags: {}, analytics: { consent: { defaultLevel: 'basic' } } })),
  isDevelopment: vi.fn(() => false),
}));
vi.mock("@/lib/config/platform-config", () => ({ getPlatformName: vi.fn(() => "web") }));
vi.mock("@/lib/storage", () => ({
  SecureStorage: {
    setJSON: vi.fn(),
    getJSON: vi.fn(),
    removeItem: vi.fn(),
    getAllKeys: vi.fn().mockResolvedValue([]),
    setItem: vi.fn(),
    getItem: vi.fn(),
  },
  STORAGE_KEYS: {
    FEATURE_FLAGS: "dnd:feature_flags:v1",
    ENTITLEMENTS: "dnd:entitlements:v1",
    CLOCK_INVALID: "dnd:clock_invalid",
  },
}));
vi.mock("@/lib/utils/logger", () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    category: vi.fn(() => ({
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

describe("Flag Resolution Logic (Conditions + Dependencies)", () => {
  beforeEach(async () => {
    vi.clearAllMocks();

    // Mock SecureStorage methods to return null by default (no cached data)
    (SecureStorage.getJSON as any).mockResolvedValue(null);
    (SecureStorage.setJSON as any).mockResolvedValue(undefined);
    (SecureStorage.removeItem as any).mockResolvedValue(undefined);

    // Reset manager state
    await FeatureFlagsManager.clearCache();
    FeatureFlagsManager.clearAllOverrides();
    (FeatureFlagsManager as any).bootstrapped = false;
    (FeatureFlagsManager as any).currentFlags = new Map();
    // Clear evaluation cache to prevent cross-test pollution
    (FeatureFlagsManager as any).evaluationCache.cache.clear();
    (FeatureFlagsManager as any).evaluationCache.accessOrder = [];

    vi.mocked(configModule.getAppConfig).mockReturnValue({
      environment: "production",
      featureFlags: {},
    } as any);
    vi.mocked(platformModule.getPlatformName).mockReturnValue("web");
  });

  // ==========================================
  // Dependency Resolution Logic
  // ==========================================

  describe("Dependency resolution scenarios", () => {
    it("should evaluate direct dependency relationship", () => {
      // Set up flags directly in currentFlags to simulate server-backed flags
      (FeatureFlagsManager as any).currentFlags = new Map([
        ["featureA", { enabled: true, kind: "feature", source: "server", depends_on: null }],
        ["featureB", { enabled: true, kind: "feature", source: "server", depends_on: ["featureA"] }],
      ]);

      // Both features should be enabled since featureA is enabled
      expect(FeatureFlagsManager.isEnabledWithContext("featureA")).toBe(true);
      expect(FeatureFlagsManager.isEnabledWithContext("featureB")).toBe(true);
    });

    it("should handle chained dependencies A -> B -> C", () => {
      // Set up flags directly in currentFlags
      (FeatureFlagsManager as any).currentFlags = new Map([
        ["featureA", { enabled: true, kind: "feature", source: "server", depends_on: null }],
        ["featureB", { enabled: true, kind: "feature", source: "server", depends_on: ["featureA"] }],
        ["featureC", { enabled: true, kind: "feature", source: "server", depends_on: ["featureB"] }],
      ]);

      // Resolution chain: C -> B -> A
      // All must be enabled for C to be enabled
      expect(FeatureFlagsManager.isEnabledWithContext("featureA")).toBe(true);
      expect(FeatureFlagsManager.isEnabledWithContext("featureB")).toBe(true);
      expect(FeatureFlagsManager.isEnabledWithContext("featureC")).toBe(true);
    });

    it("should disable feature if any dependency is disabled", () => {
      // Set up flags directly in currentFlags
      (FeatureFlagsManager as any).currentFlags = new Map([
        ["engine", { enabled: false, kind: "feature", source: "server", depends_on: null }],
        ["advancedFeature", { enabled: true, kind: "feature", source: "server", depends_on: ["engine"] }],
      ]);

      // advancedFeature depends on engine, which is disabled
      // So advancedFeature should be disabled
      expect(FeatureFlagsManager.isEnabledWithContext("engine")).toBe(false);
      expect(FeatureFlagsManager.isEnabledWithContext("advancedFeature")).toBe(false);
    });

    it("should handle multiple dependencies", () => {
      // Set up flags directly in currentFlags
      (FeatureFlagsManager as any).currentFlags = new Map([
        ["featureA", { enabled: true, kind: "feature", source: "server", depends_on: null }],
        ["featureB", { enabled: true, kind: "feature", source: "server", depends_on: null }],
        ["featureC", { enabled: true, kind: "feature", source: "server", depends_on: ["featureA", "featureB"] }],
      ]);

      // C requires both A and B
      // All are enabled, so C should be enabled
      expect(FeatureFlagsManager.isEnabledWithContext("featureA")).toBe(true);
      expect(FeatureFlagsManager.isEnabledWithContext("featureB")).toBe(true);
      expect(FeatureFlagsManager.isEnabledWithContext("featureC")).toBe(true);
    });
  });

  // ==========================================
  // Conditions + Dependencies Combined
  // ==========================================

  describe("Combined conditions and dependencies", () => {
    it("should combine platform condition with dependency check", () => {
      // Set up flags in currentFlags with condition data (server format)
      (FeatureFlagsManager as any).currentFlags = new Map([
        ["mapEngine", { enabled: true, kind: "feature", source: "server", depends_on: null, condition_logic: { type: "platform", value: "web" } }],
        ["advancedMaps", { enabled: true, kind: "feature", source: "server", depends_on: ["mapEngine"], condition_logic: { type: "platform", value: "web" } }],
      ]);

      // advancedMaps requires:
      // 1. Platform condition to match (web)
      // 2. mapEngine dependency to be enabled
      expect(FeatureFlagsManager.isEnabledWithContext("mapEngine")).toBe(true);
      expect(FeatureFlagsManager.isEnabledWithContext("advancedMaps")).toBe(true);
    });

    it("should short-circuit if condition fails before checking dependencies", () => {
      // Set up flags in currentFlags with condition data
      (FeatureFlagsManager as any).currentFlags = new Map([
        ["baseFeature", { enabled: true, kind: "feature", source: "server", depends_on: null }],
        ["restrictedFeature", { enabled: true, kind: "feature", source: "server", depends_on: ["baseFeature"], condition_logic: { type: "platform", value: "ios" } }],
      ]);

      // Platform condition fails (web != ios)
      // Should return false without checking dependencies
      expect(FeatureFlagsManager.isEnabledWithContext("restrictedFeature")).toBe(false);
    });

    it("should evaluate dependencies only if conditions pass", () => {
      // Set up flags in currentFlags with condition data
      (FeatureFlagsManager as any).currentFlags = new Map([
        ["optionalDependency", { enabled: false, kind: "feature", source: "server", depends_on: null }],
        ["featureWithCondition", { enabled: true, kind: "feature", source: "server", depends_on: ["optionalDependency"], condition_logic: { environment: "development" } }],
      ]);

      // Since environment is "production", not "development"
      // Should return false due to condition, not due to missing dependency
      expect(FeatureFlagsManager.isEnabledWithContext("featureWithCondition")).toBe(false);
    });
  });

  // ==========================================
  // Circular Dependency Detection
  // ==========================================

  describe("Circular dependency detection", () => {
    it("should detect simple circular dependency A -> B -> A", () => {
      // Set up flags with circular dependency
      (FeatureFlagsManager as any).currentFlags = new Map([
        ["featureA", { enabled: true, kind: "feature", source: "server", depends_on: ["featureB"] }],
        ["featureB", { enabled: true, kind: "feature", source: "server", depends_on: ["featureA"] }],
      ]);

      // A depends on B, B depends on A
      // This is a circular dependency that should be detected and return false
      expect(FeatureFlagsManager.isEnabledWithContext("featureA")).toBe(false);
      expect(FeatureFlagsManager.isEnabledWithContext("featureB")).toBe(false);
    });

    it("should detect complex circular dependency A -> B -> C -> A", () => {
      // Set up flags with complex circular dependency
      (FeatureFlagsManager as any).currentFlags = new Map([
        ["featureA", { enabled: true, kind: "feature", source: "server", depends_on: ["featureB"] }],
        ["featureB", { enabled: true, kind: "feature", source: "server", depends_on: ["featureC"] }],
        ["featureC", { enabled: true, kind: "feature", source: "server", depends_on: ["featureA"] }],
      ]);

      // A depends on B, B depends on C, C depends on A
      // This forms a cycle and should be detected, returning false
      expect(FeatureFlagsManager.isEnabledWithContext("featureA")).toBe(false);
      expect(FeatureFlagsManager.isEnabledWithContext("featureB")).toBe(false);
      expect(FeatureFlagsManager.isEnabledWithContext("featureC")).toBe(false);
    });

    it("should handle missing dependency without crashing", () => {
      // Set up flags with missing dependency
      (FeatureFlagsManager as any).currentFlags = new Map([
        ["featureA", { enabled: true, kind: "feature", source: "server", depends_on: ["nonExistentFeature"] }],
      ]);

      // Feature depends on a feature that doesn't exist
      // Should warn but not crash, returning false
      expect(FeatureFlagsManager.isEnabledWithContext("featureA")).toBe(false);
    });
  });

  // ==========================================
  // Context-Aware Resolution
  // ==========================================

  describe("Context-aware resolution", () => {
    it("should pass context through dependency chain", () => {
      // Set up flags in currentFlags with condition data
      (FeatureFlagsManager as any).currentFlags = new Map([
        ["baseEngine", { enabled: true, kind: "feature", source: "server", depends_on: null, condition_logic: { type: "platform", value: "web" } }],
        ["advancedFeature", { enabled: true, kind: "feature", source: "server", depends_on: ["baseEngine"], condition_logic: { type: "platform", value: "web" } }],
      ]);

      // When evaluating advancedFeature with platform context
      // Should pass the same context to baseEngine evaluation
      expect(FeatureFlagsManager.isEnabledWithContext("advancedFeature")).toBe(true);
    });

    it("should use default context values for dependencies", () => {
      // Set up flags in currentFlags with condition data
      (FeatureFlagsManager as any).currentFlags = new Map([
        ["baseFeature", { enabled: true, kind: "feature", source: "server", depends_on: null, condition_logic: { type: "environment", value: "production" } }],
        ["dependentFeature", { enabled: true, kind: "feature", source: "server", depends_on: ["baseFeature"] }],
      ]);

      // When checking dependentFeature without specifying environment
      // Should use default "production" from config for baseFeature check
      expect(FeatureFlagsManager.isEnabledWithContext("dependentFeature")).toBe(true);
    });
  });

  // ==========================================
  // Edge Cases
  // ==========================================

  describe("Edge cases", () => {
    it("should handle flag with empty dependsOn array", () => {
      // Set up flag in currentFlags with empty dependencies
      (FeatureFlagsManager as any).currentFlags = new Map([
        ["featureWithEmptyDeps", { enabled: true, kind: "feature", source: "server", depends_on: [] }],
      ]);

      // Empty deps array should be treated as no dependencies
      expect(FeatureFlagsManager.isEnabledWithContext("featureWithEmptyDeps")).toBe(true);
    });

    it("should handle flag with undefined conditions", () => {
      // Set up flag in currentFlags without conditions
      (FeatureFlagsManager as any).currentFlags = new Map([
        ["simpleFeature", { enabled: true, kind: "feature", source: "server", depends_on: null }],
      ]);

      // Undefined conditions should not cause issues
      expect(FeatureFlagsManager.isEnabledWithContext("simpleFeature")).toBe(true);
    });

    it("should handle flag with null values in dependsOn array", () => {
      // Set up flags in currentFlags with null dependency
      (FeatureFlagsManager as any).currentFlags = new Map([
        ["featureWithNullDep", { enabled: true, kind: "feature", source: "server", depends_on: ["validFlag", null] }],
      ]);

      // Should handle gracefully without crashing, but return false due to missing dependency
      expect(FeatureFlagsManager.isEnabledWithContext("featureWithNullDep")).toBe(false);
    });

    it("should return false for non-existent flags", () => {
      // currentFlags is empty, so non-existent flags should return false
      expect(FeatureFlagsManager.isEnabledWithContext("nonExistentFlag")).toBe(false);
    });

    it("should handle disabled flags", () => {
      // Set up disabled flag in currentFlags
      (FeatureFlagsManager as any).currentFlags = new Map([
        ["disabledFlag", { enabled: false, kind: "feature", source: "server", depends_on: null }],
      ]);

      // Disabled flags should return false
      expect(FeatureFlagsManager.isEnabledWithContext("disabledFlag")).toBe(false);
    });
  });
});

