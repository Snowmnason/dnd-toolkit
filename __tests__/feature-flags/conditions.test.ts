/**
 * Tests for lib/feature-flags/conditions.ts
 *
 * Tests the condition evaluators and flag evaluation logic
 */

import * as configModule from "@/lib/config/loader";
import * as platformModule from "@/lib/config/platform-config";
import {
    evaluateConditions,
    matchEnvironment,
    matchPlatform,
    matchUserRole,
    type FlagConditions,
    type FlagContext,
} from "@/lib/feature-flags/conditions";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock config and platform modules
vi.mock("@/lib/config/loader", () => ({
  getAppConfig: vi.fn(),
}));

vi.mock("@/lib/config/platform-config", () => ({
  getPlatformName: vi.fn(),
}));

describe("Feature Flag Conditions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ==========================================
  // matchPlatform Tests
  // ==========================================

  describe("matchPlatform()", () => {
    it("should return true if no platform condition specified", () => {
      expect(matchPlatform(undefined, "web")).toBe(true);
      expect(matchPlatform(undefined, "ios")).toBe(true);
    });

    it("should match exact platform (case-insensitive)", () => {
      expect(matchPlatform("web", "web")).toBe(true);
      expect(matchPlatform("WEB", "web")).toBe(true);
      expect(matchPlatform("web", "WEB")).toBe(true);
    });

    it("should not match different platforms", () => {
      expect(matchPlatform("web", "ios")).toBe(false);
      expect(matchPlatform("web", "android")).toBe(false);
      expect(matchPlatform("ios", "desktop")).toBe(false);
    });
  });

  // ==========================================
  // matchEnvironment Tests
  // ==========================================

  describe("matchEnvironment()", () => {
    it("should return true if no environment condition specified", () => {
      expect(matchEnvironment(undefined, "production")).toBe(true);
      expect(matchEnvironment(undefined, "development")).toBe(true);
    });

    it("should match exact environment (case-insensitive)", () => {
      expect(matchEnvironment("production", "production")).toBe(true);
      expect(matchEnvironment("PRODUCTION", "production")).toBe(true);
      expect(matchEnvironment("development", "DEVELOPMENT")).toBe(true);
    });

    it("should not match different environments", () => {
      expect(matchEnvironment("production", "development")).toBe(false);
      expect(matchEnvironment("development", "production")).toBe(false);
    });
  });

  // ==========================================
  // matchUserRole Tests
  // ==========================================

  describe("matchUserRole()", () => {
    it("should return true if no role condition specified", () => {
      expect(matchUserRole(undefined, "admin")).toBe(true);
      expect(matchUserRole(undefined, undefined)).toBe(true);
    });

    it("should return false if condition requires role but none provided", () => {
      expect(matchUserRole("admin", undefined)).toBe(false);
      expect(matchUserRole("moderator", undefined)).toBe(false);
    });

    it("should match exact role (case-insensitive)", () => {
      expect(matchUserRole("admin", "admin")).toBe(true);
      expect(matchUserRole("ADMIN", "admin")).toBe(true);
      expect(matchUserRole("admin", "ADMIN")).toBe(true);
    });

    it("should not match different roles", () => {
      expect(matchUserRole("admin", "moderator")).toBe(false);
      expect(matchUserRole("admin", "user")).toBe(false);
    });
  });

  // ==========================================
  // evaluateConditions Tests
  // ==========================================

  describe("evaluateConditions()", () => {
    beforeEach(() => {
      vi.mocked(configModule.getAppConfig).mockReturnValue({
        environment: "production",
        featureFlags: {},
      } as any);

      vi.mocked(platformModule.getPlatformName).mockReturnValue("web");
    });

    it("should return true if no conditions specified", () => {
      const result = evaluateConditions(undefined, {});
      expect(result).toBe(true);
    });

    it("should return true if all conditions match", () => {
      const conditions: FlagConditions = {
        platform: "web",
        environment: "production",
        userRole: "admin",
      };

      const context: FlagContext = {
        platform: "web",
        environment: "production",
        userRole: "admin",
      };

      const result = evaluateConditions(conditions, context);
      expect(result).toBe(true);
    });

    it("should return false if platform condition fails", () => {
      const conditions: FlagConditions = {
        platform: "ios",
      };

      const context: FlagContext = {
        platform: "web",
      };

      const result = evaluateConditions(conditions, context);
      expect(result).toBe(false);
    });

    it("should return false if environment condition fails", () => {
      const conditions: FlagConditions = {
        environment: "development",
      };

      const context: FlagContext = {
        environment: "production",
      };

      const result = evaluateConditions(conditions, context);
      expect(result).toBe(false);
    });

    it("should return false if userRole condition fails", () => {
      const conditions: FlagConditions = {
        userRole: "admin",
      };

      const context: FlagContext = {
        userRole: "user",
      };

      const result = evaluateConditions(conditions, context);
      expect(result).toBe(false);
    });

    it("should use default platform from getPlatformName if not in context", () => {
      vi.mocked(platformModule.getPlatformName).mockReturnValue("ios");

      const conditions: FlagConditions = {
        platform: "ios",
      };

      const context: FlagContext = {};

      const result = evaluateConditions(conditions, context);
      expect(result).toBe(true);
    });

    it("should use default environment from config if not in context", () => {
      vi.mocked(configModule.getAppConfig).mockReturnValue({
        environment: "development",
        featureFlags: {},
      } as any);

      const conditions: FlagConditions = {
        environment: "development",
      };

      const context: FlagContext = {};

      const result = evaluateConditions(conditions, context);
      expect(result).toBe(true);
    });

    it("should use AND logic: all conditions must pass", () => {
      const conditions: FlagConditions = {
        platform: "web",
        environment: "production",
        userRole: "admin",
      };

      // Platform matches, environment matches, but role doesn't
      const context: FlagContext = {
        platform: "web",
        environment: "production",
        userRole: "user",
      };

      const result = evaluateConditions(conditions, context);
      expect(result).toBe(false);
    });

    it("should be case-insensitive for all conditions", () => {
      const conditions: FlagConditions = {
        platform: "WEB",
        environment: "PRODUCTION",
        userRole: "ADMIN",
      };

      const context: FlagContext = {
        platform: "web",
        environment: "production",
        userRole: "admin",
      };

      const result = evaluateConditions(conditions, context);
      expect(result).toBe(true);
    });

    it("should handle missing userRole in context", () => {
      const conditions: FlagConditions = {
        platform: "web",
      };

      const context: FlagContext = {
        platform: "web",
        userRole: undefined,
      };

      const result = evaluateConditions(conditions, context);
      expect(result).toBe(true); // No role condition, so it passes
    });
  });
});
